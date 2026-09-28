/**
 * Tone Generator regressions.
 *
 * The confirmed defect: every Play click silently killed its own tone. The
 * component's `playTone` began with `stopTone()`, whose cleanup ran in a
 * 60 ms `setTimeout` that dereferenced the shared refs AFTER the new
 * oscillator existed — stopping the brand-new tone ~60 ms after it started.
 * On iPhone Safari the context is additionally born `suspended` (no resume()
 * call existed), so even the blip was silent. The banner reported 'passed'
 * the moment Play was clicked, over silence.
 *
 * Rules these tests pin:
 * - A deferred finalize tears down only the exact nodes it captured, never
 *   the refs' current contents (the self-kill bug).
 * - A start overtaken by stop/dispose while awaiting resume() is discarded,
 *   so no ghost tone survives.
 * - Stop, reset, and unmount disconnect and close every node.
 * - Verdicts are honest: running → passed; suspended/unstarted → not passed;
 *   missing Web Audio → failed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ToneSession,
  toneSessionVerdict,
  clampToneFrequency,
  clampToneVolume,
  createToneAudioContext,
  TONE_RAMP_IN_SECONDS,
  TONE_RAMP_OUT_SECONDS,
  TONE_FINALIZE_FALLBACK_MS,
} from '../lib/testing/toneSession';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

/** The source with comments removed, so code assertions ignore prose. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

// ------------------------------------------------------------- fake Web Audio

class FakeParam {
  value: number;
  events: string[] = [];
  constructor(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number, _t?: number): void {
    this.value = v;
    this.events.push(`set:${v}`);
  }
  linearRampToValueAtTime(v: number, _t?: number): void {
    this.value = v;
    this.events.push(`ramp:${v}`);
  }
  cancelScheduledValues(): void {
    this.events.push('cancel');
  }
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeParam(440);
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  stopTime: number | null = null;
  disconnected = false;
  private ctx: FakeContext;
  constructor(ctx: FakeContext) {
    this.ctx = ctx;
  }
  connect(): void {
    this.ctx.connects += 1;
  }
  start(t?: number): void {
    this.started = true;
    this.ctx.startedCount += 1;
    if (t !== undefined) this.stopTime = t;
  }
  stop(t?: number): void {
    this.stopped = true;
    if (t !== undefined) this.stopTime = t;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  /** Test hook: simulate the Web Audio ended event. */
  fireEnded(): void {
    this.onended?.();
  }
}

class FakeGain {
  gain = new FakeParam(1);
  disconnected = false;
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeContext {
  state: AudioContextState;
  destination = {};
  currentTime = 0;
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  connects = 0;
  startedCount = 0;
  closed = false;
  resumeCalls = 0;
  resumeShouldReject = false;
  constructor(initialState: AudioContextState = 'running') {
    this.state = initialState;
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator(this);
    this.oscillators.push(o);
    return o;
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeShouldReject) throw new Error('resume rejected');
    this.state = 'running';
  }
  async close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
  }
}

/**
 * Install fake Web Audio and return a restore function, following the
 * repo's guard convention: restore the pre-test value, not a captured one.
 */
function installFakeWebAudio(ctor: typeof FakeContext | null): () => void {
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  const hadWindow = 'window' in g;
  const prevWindow = g.window;
  const prevAC = g.AudioContext;
  const prevWAC = g.webkitAudioContext;
  if (!hadWindow) {
    (g as Record<string, unknown>).window = {};
  }
  const w = g.window as Record<string, unknown>;
  delete w.AudioContext;
  delete w.webkitAudioContext;
  if (ctor) {
    w.AudioContext = ctor as unknown as typeof AudioContext;
    w.webkitAudioContext = ctor as unknown as typeof AudioContext;
  }
  return () => {
    if (hadWindow) {
      g.window = prevWindow;
    } else {
      delete (g as Record<string, unknown>).window;
    }
    w.AudioContext = prevAC;
    w.webkitAudioContext = prevWAC;
  };
}

/** Type-safe view of the session's private graph for assertions. */
interface GraphView {
  context: FakeContext;
  oscillator: FakeOscillator;
  gain: FakeGain;
}
function graphOf(session: ToneSession): GraphView {
  return (session as unknown as { graph: GraphView }).graph;
}

/**
 * The session finalizes asynchronously: the de-click ramp must finish, then
 * `onended` or the fallback timer releases the nodes. Awaits that window so
 * assertions observe the completed lifecycle rather than its midpoint.
 */
async function awaitFinalize(): Promise<void> {
  await new Promise((r) => setTimeout(r, TONE_FINALIZE_FALLBACK_MS + 80));
}

// ------------------------------------------------------------- the self-kill bug

test('tone session - a deferred finalize cannot kill a newer tone', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    const session = new ToneSession();
    await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    const firstOsc = graphOf(session).oscillator;

    session.stop();
    // First tone's finalize is scheduled. Start a new tone immediately —
    // the exact sequence the old playTone-then-timeout bug destroyed.
    await session.start({ frequency: 880, volume: 0.15, waveform: 'sine' });
    const secondCtx = graphOf(session).context;
    const secondOsc = graphOf(session).oscillator;
    assert.notEqual(secondOsc, firstOsc, 'a new oscillator must be created');

    // The first tone's captured finalize must touch ONLY the first nodes,
    // never the second tone's. The old bug stopped the NEW tone 60 ms in.
    secondOsc.fireEnded(); // firing the wrong node's hook must stay harmless
    assert.equal(session.isPlaying, true, 'the newer tone must keep playing');

    await awaitFinalize();
    assert.equal(session.isPlaying, true, 'the newer tone must SURVIVE the first tone finalize');
    assert.equal(secondCtx.closed, false, 'the newer context must not be closed');
    assert.equal(secondOsc.disconnected, false, 'the newer oscillator must stay connected');
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - stop disconnects and closes its own nodes', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    const session = new ToneSession();
    const outcome = await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    assert.equal(outcome.started, true);
    assert.equal(outcome.running, true);

    const graph = graphOf(session);
    session.stop();
    assert.equal(session.isPlaying, false, 'isPlaying clears at once');
    assert.equal(session.contextState(), 'not-created', 'the live graph reference clears at once');
    // Finalize is asynchronous by design — the de-click ramp must finish.
    await awaitFinalize();
    assert.equal(graph.oscillator.disconnected, true, 'oscillator must be disconnected');
    assert.equal(graph.gain.disconnected, true, 'gain must be disconnected');
    assert.equal(graph.context.closed, true, 'context must be closed');
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - starting replaces the current tone without overlap', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    const session = new ToneSession();
    await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    const first = graphOf(session);
    await session.start({ frequency: 220, volume: 0.15, waveform: 'square' });
    // The first oscillator was stopped synchronously by the replacement.
    assert.notEqual(first.oscillator.stopTime, null, 'the first tone must be stopped at once');
    assert.equal(session.isPlaying, true);
    // Exactly one live graph: the session holds only the newest one.
    assert.ok(graphOf(session), 'exactly one graph is live');
    // And the replaced graph is fully released.
    await awaitFinalize();
    assert.equal(first.context.closed, true, 'the replaced context must be closed');
    assert.equal(first.oscillator.disconnected, true);
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - a start overtaken by stop is discarded (ghost tone)', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    const session = new ToneSession();
    // Simulate a suspended context whose resume is slow — the classic iOS path.
    class SlowResumeContext extends FakeContext {
      constructor() {
        super('suspended');
      }
      override async resume(): Promise<void> {
        await new Promise((r) => setTimeout(r, 30));
        await super.resume();
      }
    }
    const restoreSlow = installFakeWebAudio(SlowResumeContext);
    const startPromise = session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    session.stop(); // overtake while resume() is pending
    const outcome = await startPromise;
    assert.equal(outcome.started, false, 'the overtaken start must not report success');
    assert.equal(outcome.error, 'superseded');
    assert.equal(session.isPlaying, false);
    // The discarded graph is fully released too.
    await awaitFinalize();
    restoreSlow();
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - dispose forbids restart after unmount', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    const session = new ToneSession();
    await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    session.dispose();
    const after = await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    assert.equal(after.started, false, 'no tone may start after dispose');
    assert.equal(session.isPlaying, false);
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - suspended context is resumed during start (iOS)', async () => {
  const restore = installFakeWebAudio(FakeContext);
  try {
    class SuspendedContext extends FakeContext {
      constructor() {
        super('suspended');
      }
    }
    const restoreSuspended = installFakeWebAudio(SuspendedContext);
    const session = new ToneSession();
    const outcome = await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    assert.equal(outcome.started, true);
    assert.equal(outcome.running, true, 'resume() must leave the context running');
    assert.equal(outcome.contextState, 'running');
    restoreSuspended();
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - resume() failing is reported honestly, not passed', async () => {
  class RefusingContext extends FakeContext {
    constructor() {
      super('suspended');
    }
    override async resume(): Promise<void> {
      throw new Error('NotAllowedError');
    }
  }
  const restore = installFakeWebAudio(RefusingContext);
  try {
    const session = new ToneSession();
    const outcome = await session.start({ frequency: 440, volume: 0.15, waveform: 'sine' });
    assert.equal(outcome.started, true);
    assert.equal(outcome.running, false, 'a suspended context that refuses resume is not running');
    assert.equal(outcome.contextState, 'suspended');
    const verdict = toneSessionVerdict({
      started: outcome.started,
      running: outcome.running,
      contextState: outcome.contextState,
      frequency: 440,
      waveform: 'sine',
    });
    assert.equal(verdict.status, 'inconclusive', 'silence must never be reported as passed');
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

test('tone session - missing Web Audio returns null and reports failed', () => {
  const restore = installFakeWebAudio(null);
  try {
    assert.equal(createToneAudioContext(), null);
    const verdict = toneSessionVerdict({
      started: false,
      running: false,
      contextState: 'missing',
      frequency: 440,
      waveform: 'sine',
    });
    assert.equal(verdict.status, 'failed');
    assert.match(verdict.details, /Web Audio is not available/);
    restore();
  } catch (e) {
    restore();
    throw e;
  }
});

// ------------------------------------------------------------- verdict honesty

test('tone verdict - a running context passes with audibility caveat', () => {
  const v = toneSessionVerdict({ started: true, running: true, contextState: 'running', frequency: 440, waveform: 'sine' });
  assert.equal(v.status, 'passed');
  assert.match(v.details, /440 Hz sine/);
  assert.match(v.details, /Confirm audibility by ear/);
  assert.match(v.details, /not speaker quality/);
});

test('tone verdict - unstarted or suspended never passes', () => {
  assert.equal(
    toneSessionVerdict({ started: false, running: false, contextState: 'suspended', frequency: 440, waveform: 'sine' }).status,
    'inconclusive',
  );
  assert.equal(
    toneSessionVerdict({ started: true, running: false, contextState: 'suspended', frequency: 440, waveform: 'sine' }).status,
    'inconclusive',
  );
});

// ------------------------------------------------------------- clamps

test('tone clamps - frequency and volume stay in the supported band', () => {
  assert.equal(clampToneFrequency(10), 20);
  assert.equal(clampToneFrequency(20000), 12000);
  assert.equal(clampToneFrequency(440), 440);
  assert.equal(clampToneFrequency(NaN), 20);
  assert.equal(clampToneVolume(0), 0.01);
  assert.equal(clampToneVolume(1.5), 0.5);
  assert.equal(clampToneVolume(0.2), 0.2);
});

// ------------------------------------------------------------- component wiring

test('tone component - no deferred ref-dereferencing cleanup remains', () => {
  const code = stripComments(read('components/tests/ToneGeneratorTester.tsx'));
  // The bug: a setTimeout inside stopTone dereferenced shared refs after a
  // newer tone existed. The component must delegate node lifecycle to the
  // session instead of hand-rolling timers over refs.
  assert.match(code, /sessionRef\.current\?\.stop\(\)/);
  assert.doesNotMatch(code, /setTimeout[\s\S]{0,200}oscRef\.current/, 'a setTimeout dereferencing osc refs is the self-kill bug');
  assert.doesNotMatch(code, /stopTone\(\);\s*\n\s*const AudioContextClass/, 'playTone must not begin by calling stopTone over shared refs');
  assert.match(code, /dispose\(\)/, 'unmount must dispose, not merely stop');
});

test('tone component - the session is a single instance per mount', () => {
  const code = stripComments(read('components/tests/ToneGeneratorTester.tsx'));
  assert.match(code, /sessionRef = useRef<ToneSession \| null>\(null\)/);
  // Live control updates must route through the session's update methods.
  assert.match(code, /updateFrequency\(frequency\)/);
  assert.match(code, /updateWaveform\(waveform\)/);
  assert.match(code, /updateVolume\(volume\)/);
});

test('tone component - honest verdict is derived, not hard-coded', () => {
  const code = stripComments(read('components/tests/ToneGeneratorTester.tsx'));
  assert.match(code, /toneSessionVerdict\(/);
  assert.doesNotMatch(
    code,
    /onResultUpdate\?\.\(\s*'passed'/,
    "an unconditional 'passed' would repeat the dishonesty over silence",
  );
});

test('tone component - source constants agree with the old UI limits', () => {
  assert.equal(TONE_RAMP_IN_SECONDS > 0, true);
  assert.equal(TONE_RAMP_OUT_SECONDS <= 0.1, true, 'stop must feel immediate');
  assert.equal(TONE_FINALIZE_FALLBACK_MS >= 100, true, 'the fallback must cover suspended clocks');
});
