// WebKit Resource Timing race guard for the Internet Speed Test.
//
// The provider engine reads `performance.getEntriesByName(url)` synchronously
// in the same microtask chain as `response.text()`. Blink always has the
// entry by then; WebKit records it on a later task, so the read returns
// nothing, the engine's `perf.transferSize` dereference throws, and the whole
// run aborts with a misleading "Connection failed to https://…". The guard
// delays only the moment the engine is handed the response, and only while
// the entry is genuinely missing, so no timing value is ever fabricated.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const MEASUREMENT = 'https://speed.cloudflare.com/__down?bytes=1000000';
const PROBE = 'https://speed.cloudflare.com/__down?during=download&bytes=0';
const OTHER = 'https://devicetry.mcfoxfasty.workers.dev/logo.png';

interface Restore {
  (): void;
}

/** Stubs getEntriesByName so a url only has an entry once `appear(url)` runs. */
function stubTiming(urlsWithEntry: Set<string>): Restore {
  const original = performance.getEntriesByName.bind(performance);
  performance.getEntriesByName = ((name: string) =>
    urlsWithEntry.has(name)
      ? ([{ name, transferSize: 1000 }] as unknown as PerformanceEntry[])
      : []
  ) as typeof performance.getEntriesByName;
  return () => {
    performance.getEntriesByName = original;
  };
}

function stubFetch(
  handler: (url: string, init?: unknown) => Promise<unknown>
): { calls: string[]; restore: Restore } {
  const g = globalThis as unknown as { fetch: unknown };
  const original = g.fetch;
  const calls: string[] = [];
  g.fetch = (input: unknown, init?: unknown) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    calls.push(url);
    return handler(url, init);
  };
  return {
    calls,
    restore: () => {
      g.fetch = original;
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// The guard itself
// ---------------------------------------------------------------------------

test('speed guard - a measurement response is not handed over until its timing entry exists', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  const timed = new Set<string>();
  const restoreTiming = stubTiming(timed);
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));
  const phases: string[] = [];

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: unknown = null;
    results = { getSummary: () => ({ download: 1_000_000 }) };
    play() {
      // Exactly what the engine does: fetch, read the body, then read timing
      // synchronously and dereference it without checking.
      void globalThis
        .fetch(MEASUREMENT)
        .then((r) => (r as { text: () => Promise<string> }).text())
        .then(() => {
          const perf = performance.getEntriesByName(MEASUREMENT).slice(-1)[0];
          // This is the line that throws in Safari when the entry is late.
          if (!perf) throw new TypeError("undefined is not an object (evaluating 'perf.transferSize')");
          (this.onFinish as () => void)();
        })
        .catch((e: Error) => (this.onError as (e: string) => void)(e.message));
    }
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({
      onPhase: (p) => phases.push(p),
      onProgress: () => {},
    });
    await controller.start();

    // WebKit publishes the entry a few ms AFTER the response settles.
    setTimeout(() => timed.add(MEASUREMENT), 25);

    for (let i = 0; i < 200 && !phases.includes('finished') && !phases.includes('error'); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    // Without the guard the engine reads the entry synchronously, finds
    // nothing, and the whole run dies with a TypeError.
    assert.deepEqual(phases, ['running', 'finished'], `phases were ${phases.join(',')}`);
    controller.dispose();
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});

test('speed guard - the wait is bounded and never rejects, so a real failure still surfaces', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  // The entry NEVER appears — the engine must still be able to run and report
  // its own error rather than hanging forever.
  const restoreTiming = stubTiming(new Set());
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));
  const errors: string[] = [];

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: ((e: string) => void) | null = null;
    results = { getSummary: () => ({}) };
    play() {
      void globalThis
        .fetch(PROBE)
        .then((r) => (r as { text: () => Promise<string> }).text())
        .then(() => this.onError?.('Connection failed to ' + PROBE));
    }
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({
      onPhase: (p) => { if (p === 'error') errors.push('error'); },
      onProgress: () => {},
    });
    await controller.start();
    for (let i = 0; i < 200 && !errors.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(errors, ['error'], 'a genuinely unusable request must still report an error');
    controller.dispose();
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});

test('speed guard - non-measurement requests are never delayed', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  const timed = new Set<string>();
  const restoreTiming = stubTiming(timed);
  let elapsed = -1;
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: unknown = null;
    results = { getSummary: () => ({}) };
    play() {
      const started = Date.now();
      // No timing entry for this url — the guard must still not wait on it.
      void globalThis.fetch(OTHER).then(() => {
        elapsed = Date.now() - started;
      });
    }
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({ onPhase: () => {}, onProgress: () => {} });
    await controller.start();
    for (let i = 0; i < 40 && elapsed < 0; i++) await new Promise((r) => setTimeout(r, 5));
    assert.ok(elapsed >= 0, 'the request must complete');
    assert.ok(elapsed < 100, `an unrelated request must not be delayed, took ${elapsed}ms`);
    controller.dispose();
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});

test('speed guard - an entry survives the engine wiping the shared buffer', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  // The engine clears performance's shared buffer at every step boundary,
  // which can wipe the entry its concurrent probe engine is about to read.
  // The guard keeps a per-run copy so the entry is still findable.
  const live = new Set<string>();
  const restoreTiming = stubTiming(live);
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: unknown = null;
    results = { getSummary: () => ({}) };
    play() {}
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({ onPhase: () => {}, onProgress: () => {} });
    await controller.start();

    // The request completes and the entry is in the shared buffer.
    live.add(MEASUREMENT);
    assert.equal(performance.getEntriesByName(MEASUREMENT).length, 1, 'entry is readable first');

    // The engine now clears the shared buffer underneath a concurrent read.
    live.clear();
    assert.equal(performance.getEntriesByName(MEASUREMENT).length, 1,
      'the guard must still resolve the entry after the buffer is cleared');

    controller.dispose();
    // Once the run ends the guard is gone: no stale entry may survive it.
    assert.equal(performance.getEntriesByName(MEASUREMENT).length, 0,
      'the cache must be discarded with the run, never leaking into the next one');
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});

test('speed guard - fetch is restored once the run ends', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  const g = globalThis as unknown as { fetch: unknown };
  const restoreTiming = stubTiming(new Set());
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));
  // What fetch was immediately BEFORE the run started — the guard must put
  // back exactly this, not the value from before the test stubbed fetch.
  const pristine = g.fetch;

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: unknown = null;
    results = { getSummary: () => ({}) };
    play() {}
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({ onPhase: () => {}, onProgress: () => {} });
    await controller.start();
    assert.notEqual(g.fetch, pristine, 'the guard is installed while a run is active');
    controller.dispose();
    assert.equal(g.fetch, pristine, 'the guard must be removed when the run ends');
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});

// ---------------------------------------------------------------------------
// Result honesty
// ---------------------------------------------------------------------------

test('speed provider - a failed run can never later report a finished result', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  interface Captured {
    onError: ((e: string) => void) | null;
    onFinish: (() => void) | null;
    onResultsChange: (() => void) | null;
  }
  let engine: Captured | null = null;

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: (() => void) | null = null;
    onPhaseChange: unknown = null;
    onFinish: (() => void) | null = null;
    onError: ((e: string) => void) | null = null;
    results = { getSummary: () => ({ download: 900_000_000 }) };
    constructor() {
      engine = this as unknown as Captured;
    }
    play() {}
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const phases: string[] = [];
    const controller = new CloudflareSpeedTestController({
      onPhase: (p) => phases.push(p),
      onProgress: () => {},
    });
    await controller.start();

    const eng = engine!;
    eng.onError?.('Connection failed to https://speed.cloudflare.com/__up?bytes=10000000.');
    // The engine then tries to finish with its partial numbers anyway, in the
    // window before the failure message has been finalised.
    eng.onResultsChange?.();
    eng.onFinish?.();
    assert.deepEqual(phases, ['running'], 'finishing must be refused as soon as a failure is known');

    for (let i = 0; i < 900 && !phases.includes('error'); i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(phases, ['running', 'error'], `phases were ${phases.join(',')}`);
    assert.ok(!phases.includes('finished'), 'an incomplete run must never be presented as a result');
    controller.dispose();
  } finally {
    restoreEngine();
  }
});

test('speed provider - cancelling records no result at all', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  interface Captured {
    onError: ((e: string) => void) | null;
    onFinish: (() => void) | null;
  }
  let engine: Captured | null = null;

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: (() => void) | null = null;
    onError: ((e: string) => void) | null = null;
    results = { getSummary: () => ({ download: 900_000_000 }) };
    constructor() {
      engine = this as unknown as Captured;
    }
    play() {}
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const phases: string[] = [];
    const controller = new CloudflareSpeedTestController({
      onPhase: (p) => phases.push(p),
      onProgress: () => {},
    });
    await controller.start();
    controller.cancel();

    const eng = engine!;
    eng.onError?.('late error');
    eng.onFinish?.();

    assert.deepEqual(phases, ['running', 'aborted'], `phases were ${phases.join(',')}`);
    assert.ok(!phases.includes('finished') && !phases.includes('error'));
  } finally {
    restoreEngine();
  }
});

// ---------------------------------------------------------------------------
// Error text the user actually reads
// ---------------------------------------------------------------------------

test('speed provider - engine errors report the real cause the engine only logged', async () => {
  const { describeEngineError } = await import('../lib/testing/speedProvider');

  // A rejected fetch alone proves nothing: Safari uses the SAME error text
  // for a CORS block and a dead network, so the adapter must not claim a
  // cause it has not established by probing.
  const ambiguous = describeEngineError(
    'Connection failed to https://speed.cloudflare.com/__down?during=idle&bytes=0.',
    'TypeError: Failed to fetch'
  );
  assert.doesNotMatch(ambiguous, /never reached Cloudflare/,
    'an unverified rejection must not be reported as a network failure');
  assert.doesNotMatch(ambiguous, /CORS rejection/,
    'an unverified rejection must not be reported as a CORS block');
  assert.match(ambiguous, /no speed result was recorded/i);

  // The timing race IS verifiable from the log: the engine only reaches that
  // line after the response body was read successfully.
  const timing = describeEngineError(
    'Connection failed to https://speed.cloudflare.com/__down?during=idle&bytes=0.',
    "TypeError: undefined is not an object (evaluating 'perf.transferSize')"
  );
  assert.match(timing, /timing quirk/);
  assert.match(timing, /not a problem with your connection/);

  const upload = describeEngineError('Connection failed to https://speed.cloudflare.com/__up?bytes=1000000.');
  assert.match(upload, /upload transfer did not complete/);
  assert.match(upload, /no speed result was recorded/);

  const download = describeEngineError('Connection failed to https://speed.cloudflare.com/__down?bytes=10000000');
  assert.match(download, /download transfer did not complete/);

  // Rate limiting is a real, distinct, actionable outcome.
  const limited = describeEngineError('Request failed with 429: https://speed.cloudflare.com/__down?bytes=1');
  assert.match(limited, /HTTP 429/);
  assert.match(limited, /rate limited/);
  assert.match(limited, /No speed result was recorded/);

  assert.equal(describeEngineError('Something else entirely'), 'Something else entirely');
  assert.equal(describeEngineError(undefined), 'The speed-test engine reported a failure.');
});

test('speed guard - a CORS rejection is told apart from a real network failure by probing', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  const restoreTiming = stubTiming(new Set());
  const g = globalThis as unknown as { fetch: unknown };
  const seen: (string | undefined)[] = [];

  // The engine's own view: a rejected fetch. It logs "TypeError: Failed to
  // fetch", which Safari uses for BOTH a CORS block and a dead network.
  const makeEngine = () =>
    class FakeEngine {
      onRunningChange: unknown = null;
      onResultsChange: unknown = null;
      onPhaseChange: unknown = null;
      onFinish: unknown = null;
      onError: ((e: string) => void) | null = null;
      results = { getSummary: () => ({}) };
      play() {
        void globalThis.fetch(MEASUREMENT).catch((e: Error) => {
          console.warn(`Error fetching ${MEASUREMENT}: TypeError: ${e.message}`);
          this.onError?.(`Connection failed to ${MEASUREMENT}.`);
        });
      }
      pause() {}
      restart() {}
    };

  // (a) CORS: the plain request fails, but the same URL answers with no-cors.
  const restoreCors = stubFetch(async (url, init) => {
    if ((init as { mode?: string } | undefined)?.mode === 'no-cors') return { type: 'opaque' };
    if (url === MEASUREMENT) throw Object.assign(new Error('Failed to fetch'), { name: 'TypeError' });
    return { type: 'opaque' };
  });

  const restoreEngineA = __setEngineFactoryForTests(async () => makeEngine() as unknown as never);
  try {
    const c = new CloudflareSpeedTestController({
      onPhase: (p, e) => { if (p === 'error') seen.push(e); },
      onProgress: () => {},
    });
    await c.start();
    for (let i = 0; i < 300 && !seen.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(seen.length, 1, 'the failure must be reported');
    assert.match(seen[0]!, /blocked the response to this cross-origin measurement request \(a CORS rejection\)/,
      `a reachable-but-blocked request must be reported as CORS, got: ${seen[0]}`);
    assert.doesNotMatch(seen[0]!, /never reached Cloudflare/);
    c.dispose();
  } finally {
    restoreEngineA();
    restoreCors.restore();
  }

  // (b) A genuinely unreachable endpoint: the no-cors probe fails too.
  seen.length = 0;
  const restoreNet = stubFetch(async () => {
    throw Object.assign(new Error('Load failed'), { name: 'TypeError' });
  });
  const restoreEngineB = __setEngineFactoryForTests(async () => makeEngine() as unknown as never);
  try {
    const c = new CloudflareSpeedTestController({
      onPhase: (p, e) => { if (p === 'error') seen.push(e); },
      onProgress: () => {},
    });
    await c.start();
    for (let i = 0; i < 300 && !seen.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(seen.length, 1, 'the failure must be reported');
    assert.match(seen[0]!, /never reached Cloudflare/,
      `an unreachable endpoint must be reported as a network failure, got: ${seen[0]}`);
    c.dispose();
  } finally {
    restoreEngineB();
    restoreNet.restore();
    restoreTiming();
    void g;
  }
});

test('speed guard - the engine\'s logged cause is captured and used, url colon and all', async () => {
  const { CloudflareSpeedTestController, __setEngineFactoryForTests } = await import(
    '../lib/testing/speedProvider'
  );

  const restoreTiming = stubTiming(new Set([MEASUREMENT]));
  const restoreFetch = stubFetch(async () => ({ ok: true, text: async () => '' }));
  const seen: (string | undefined)[] = [];

  class FakeEngine {
    onRunningChange: unknown = null;
    onResultsChange: unknown = null;
    onPhaseChange: unknown = null;
    onFinish: unknown = null;
    onError: ((e: string) => void) | null = null;
    results = { getSummary: () => ({}) };
    play() {
      // Exactly the engine's own log line, including the https: colon and the
      // trailing punctuation difference vs the message it passes to onError.
      // This cause IS verifiable from the log: the engine only reaches it
      // after the response body was read successfully.
      console.warn(
        `Error fetching ${MEASUREMENT}: TypeError: undefined is not an object (evaluating 'perf.transferSize')`
      );
      this.onError?.(`Connection failed to ${MEASUREMENT}.`);
    }
    pause() {}
    restart() {}
  }

  const restoreEngine = __setEngineFactoryForTests(async () => FakeEngine as unknown as never);
  try {
    const controller = new CloudflareSpeedTestController({
      onPhase: (p, error) => { if (p === 'error') seen.push(error); },
      onProgress: () => {},
    });
    await controller.start();
    for (let i = 0; i < 900 && !seen.length; i++) await new Promise((r) => setTimeout(r, 5));

    assert.equal(seen.length, 1, 'the failure must be reported');
    assert.match(seen[0]!, /timing quirk/,
      'the cause captured from the engine\'s own log must reach the user');
    assert.doesNotMatch(seen[0]!, /never reached Cloudflare/,
      'a completed request must not be blamed on the network');
    controller.dispose();
  } finally {
    restoreEngine();
    restoreFetch.restore();
    restoreTiming();
  }
});
