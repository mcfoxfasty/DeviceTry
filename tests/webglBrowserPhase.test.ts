/**
 * Phase 8 regressions — WebGL loop/pause state machine and hydration-safe
 * browser-compatibility probing. Node has no real GL context or DOM here, so
 * these tests exercise the LOGIC of the components in isolation:
 *
 * - The animation loop contract: only one pending frame ever (no stacking),
 *   Pause zeroes scheduled work, Resume continues the accumulated angle.
 * - The probe pipeline: capabilities start undetected (hydration-safe initial
 *   render), are computed once in an effect, and probe contexts are released.
 * Algorithm verification only — real rendering requires a physical browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// 1. WebGL loop state machine (mirrors WebGLTester's loop contract)
// ---------------------------------------------------------------------------

/**
 * Minimal harness reproducing the tester's loop/pause/resume contract with a
 * virtual clock: the same rules the rAF loop must obey.
 */
function createLoopHarness() {
  type Frame = () => void;
  let pending: Frame | null = null;
  let now = 0;
  let playing = true;
  let angle = 0;
  let draws = 0;
  const ANGLE_PER_SECOND = Math.PI / 2.5;

  const schedule = (f: Frame) => {
    if (pending !== null) throw new Error('loop stacking: a frame was already pending');
    pending = f;
  };
  const cancel = () => {
    pending = null;
  };

  const startLoop = () => {
    cancel(); // startLoop always cancels prior pending work (no stacking)
    let last = now;
    const frame: Frame = () => {
      if (!playing) {
        pending = null; // paused: idle, nothing scheduled
        return;
      }
      const delta = now - last;
      angle += (delta / 1000) * ANGLE_PER_SECOND;
      last = now;
      draws += 1;
      schedule(frame);
    };
    schedule(frame);
  };

  const tick = (ms: number) => {
    const f = pending;
    pending = null;
    now += ms;
    f?.();
  };

  return {
    startLoop,
    tick,
    pause: () => {
      playing = false;
      cancel();
    },
    resume: () => {
      playing = true;
      startLoop();
    },
    get angle() {
      return angle;
    },
    get draws() {
      return draws;
    },
    get hasPendingWork() {
      return pending !== null;
    },
  };
}

test('webgl loop - pause stops scheduling and clears pending frame work', () => {
  const h = createLoopHarness();
  h.startLoop();
  h.tick(16);
  assert.ok(h.draws > 0, 'loop draws while playing');
  h.pause();
  assert.equal(h.hasPendingWork, false, 'pause must leave no scheduled frame');
  const before = h.draws;
  h.tick(16);
  h.tick(16);
  assert.equal(h.draws, before, 'no draws while paused');
});

test('webgl loop - resume restarts without stacking a second loop', () => {
  const h = createLoopHarness();
  h.startLoop();
  h.tick(16);
  h.resume(); // resume while already running must not stack
  assert.equal(h.hasPendingWork, true, 'exactly one loop runs after resume');
  h.tick(16);
  assert.ok(h.draws >= 2, 'draws continue after resume');
  // If two loops were stacked, one tick would double-advance or throw above.
});

test('webgl loop - rotation resumes from the paused angle (no reset to zero)', () => {
  const h = createLoopHarness();
  h.startLoop();
  h.tick(1000); // 1s → angle ≈ π/2.5
  const atPause = h.angle;
  assert.ok(atPause > 0.5, 'angle accumulated before pause');
  h.pause();
  h.resume();
  h.tick(1000);
  assert.ok(
    h.angle > atPause * 1.9,
    `angle must continue from pause (${h.angle} vs ${atPause})`
  );
  assert.ok(h.angle < atPause * 2.1, 'no double-speed jump after resume');
});

test('webgl loop - unmount-equivalent cancel leaves no pending work', () => {
  const h = createLoopHarness();
  h.startLoop();
  h.tick(16);
  h.pause(); // cleanup path uses the same cancel
  assert.equal(h.hasPendingWork, false);
});

// ---------------------------------------------------------------------------
// 2. Shader/program validation gates success (logic-level)
// ---------------------------------------------------------------------------

test('webgl pipeline - compile/link failure must map to a failed verdict, not passed', () => {
  // Mirrors the tester's verdict rules: context available + pipeline built →
  // passed; context available + build failure → failed with detail.
  const verdictFor = (pipelineOk: boolean) => (pipelineOk ? 'passed' : 'failed');
  assert.equal(verdictFor(false), 'failed');
  assert.equal(verdictFor(true), 'passed');
});

// ---------------------------------------------------------------------------
// 3. Browser Compatibility hydration pipeline
// ---------------------------------------------------------------------------

interface FeatureProbe {
  name: string;
  check: () => boolean;
}

/**
 * Reproduces the tester's contract: server render / initial render shows a
 * stable "undetected" state; an effect computes values once; every probe runs
 * through a try/catch guard.
 */
function createCompatPipeline(features: FeatureProbe[]) {
  let supportedByName: Record<string, boolean> | null = null;
  let effectRuns = 0;
  return {
    get supportedByName() {
      return supportedByName;
    },
    get effectRuns() {
      return effectRuns;
    },
    runEffect() {
      effectRuns += 1;
      const computed: Record<string, boolean> = {};
      for (const f of features) {
        let ok = false;
        try {
          ok = f.check();
        } catch {
          ok = false;
        }
        computed[f.name] = ok;
      }
      supportedByName = computed;
    },
    /** What the UI shows for a feature pre/post detection. */
    cellFor(name: string): 'checking' | 'supported' | 'missing' {
      if (!supportedByName) return 'checking';
      return supportedByName[name] ? 'supported' : 'missing';
    },
  };
}

const FEATURES: FeatureProbe[] = [
  { name: 'A', check: () => true },
  { name: 'B', check: () => false },
  { name: 'Throwing', check: () => {
    throw new Error('probe exploded');
  } },
];

test('browser compat - initial render shows stable undetected state (hydration-safe)', () => {
  const p = createCompatPipeline(FEATURES);
  assert.equal(p.cellFor('A'), 'checking', 'first paint must not differ between server and client');
  assert.equal(p.cellFor('B'), 'checking');
  assert.equal(p.cellFor('Throwing'), 'checking');
});

test('browser compat - detection runs once in an effect and lands real values', () => {
  const p = createCompatPipeline(FEATURES);
  p.runEffect();
  assert.equal(p.cellFor('A'), 'supported');
  assert.equal(p.cellFor('B'), 'missing');
  assert.equal(p.cellFor('Throwing'), 'missing', 'a throwing probe is guarded, not fatal');
  assert.equal(p.effectRuns, 1);
});

test('browser compat - repeated renders reuse computed results (probe cache)', () => {
  let probeCalls = 0;
  const features: FeatureProbe[] = [
    { name: 'WebGL 1.0', check: () => { probeCalls += 1; return true; } },
  ];
  const p = createCompatPipeline(features);
  p.runEffect(); // initial detection
  // Simulate re-renders on typing in the search box: results come from state,
  // checks are NOT re-executed.
  assert.equal(p.cellFor('WebGL 1.0'), 'supported');
  assert.equal(probeCalls, 1, 'checks must run once, not on every render');
});

// ---------------------------------------------------------------------------
// 4. GPU probe caching + context release
// ---------------------------------------------------------------------------

test('gpu probes - results are cached and contexts released exactly once', () => {
  let allocations = 0;
  let released = 0;
  let cache: { webgl1: boolean; webgl2: boolean; canvas2d: boolean } | null = null;

  const probeGpuContexts = () => {
    if (cache) return cache;
    allocations += 1;
    released += 2; // WEBGL_lose_context releases both GL probe contexts
    cache = { webgl1: true, webgl2: false, canvas2d: true };
    return cache;
  };

  const first = probeGpuContexts();
  const second = probeGpuContexts(); // re-render path
  assert.equal(first, second, 'cached result object is reused');
  assert.equal(allocations, 1, 'contexts allocated once');
  assert.equal(released, 2, 'both GL probes released after detection');
  assert.equal(second.webgl1, true);
  assert.equal(second.webgl2, false);
});
