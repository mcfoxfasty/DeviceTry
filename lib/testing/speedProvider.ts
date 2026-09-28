/**
 * Speed-test provider adapter (Phase 9, item H).
 *
 * Provider: Cloudflare's official measurement engine (@cloudflare/speedtest,
 * MIT license) running against the public speed.cloudflare.com endpoints.
 * Source of record:
 *   - https://github.com/cloudflare/speedtest (README: API, defaults, config)
 *   - https://www.npmjs.com/package/@cloudflare/speedtest
 * Known conditions (documented honestly):
 *   - "Measurement results are collected by Cloudflare on completion for the
 *     purpose of calculating aggregated insights regarding Internet
 *     connection quality." (engine README)
 *   - No published per-user usage limits or pricing for the public endpoints
 *     were found at implementation time; if that changes, this adapter is the
 *     single file to replace.
 *   - Latency here is HTTP round-trip TTFB timing, NOT ICMP ping.
 *   - Packet loss requires a TURN server and is NOT measured (excluded below).
 *
 * The rest of the app depends only on the SpeedTestController interface, so
 * the provider can be replaced without touching UI code.
 */

export interface SpeedSummary {
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  downLoadedLatencyMs: number | null;
  upLoadedLatencyMs: number | null;
}

export type SpeedPhase = 'idle' | 'running' | 'finished' | 'error' | 'aborted';

/**
 * Real, engine-provided progress: the measurement step currently running
 * (from the engine's own onPhaseChange) — never a fabricated or extrapolated
 * value. `bytes`/`count` come from the step config; a human label is derived
 * in the UI, not invented here.
 */
export interface SpeedPhaseInfo {
  /** Engine measurement type of the ACTIVE step. */
  type: 'latency' | 'download' | 'upload';
  /** Step payload size in bytes (bandwidth steps only; undefined for latency). */
  bytes?: number;
  /** Number of requests in this step (bandwidth steps only). */
  count?: number;
  /** 1-based step index within the configured sequence. */
  step: number;
  /** Total number of configured steps. */
  totalSteps: number;
}

/**
 * Short, honest progress label for the running speed test.
 *
 * Concise by design (it sits in a narrow toolbar next to the buttons on a
 * phone), but never vague: the engine's own step type and position are shown
 * so the user can see WHICH phase is active. Nothing is invented — the input
 * is exactly what the engine reported via onPhaseChange.
 */
export function describeSpeedPhase(info: SpeedPhaseInfo | null): string {
  if (!info) return 'Measuring…';
  const phase =
    info.type === 'latency' ? 'Latency' : info.type === 'download' ? 'Download' : 'Upload';
  return `Measuring ${phase.toLowerCase()} — ${info.step}/${info.totalSteps}`;
}

export interface SpeedTestEvents {
  onPhase(phase: SpeedPhase, error?: string): void;
  onProgress(summary: SpeedSummary): void;
  /** Engine-reported active measurement step (real progress, no invention). */
  onPhaseInfo?(info: SpeedPhaseInfo): void;
}

/**
 * Bounded, provider-supported measurement set: latency + a stepped
 * download/upload ramp that stops early once a set reaches the engine's
 * bandwidthFinishRequestDuration. Excludes packetLoss (needs a TURN server).
 * Total transfer stays well under the default engine suite.
 */
const MEASUREMENTS = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 12 },
  { type: 'download', bytes: 1e6, count: 6 },
  { type: 'upload', bytes: 1e5, count: 6 },
  { type: 'download', bytes: 1e7, count: 5 },
  { type: 'upload', bytes: 1e6, count: 5 },
  { type: 'download', bytes: 2.5e7, count: 3 },
  { type: 'upload', bytes: 1e7, count: 3 },
] as const;

type EngineCtor = new (config: Record<string, unknown>) => CloudflareSpeedTestEngineLike;

interface CloudflareSpeedTestEngineLike {
  results: {
    getSummary(): Record<string, number | boolean | undefined>;
    s2cDownload?: { bps: number }[];
    c2sUpload?: { bps: number }[];
    getUnloadedLatency(): number | null;
    getUnloadedJitter(): number | null;
    getDownLoadedLatency(): number | null;
    getUpLoadedLatency(): number | null;
  };
  play(): void;
  pause(): void;
  restart(): void;
  onRunningChange: ((running: boolean) => void) | null;
  onResultsChange: ((info: { type: string }) => void) | null;
  /** Engine hook: fires when a new measurement step begins. */
  onPhaseChange: ((info: { measurementId: number; measurement: { type: string; bytes?: number; count?: number } }) => void) | null;
  onFinish: ((results: unknown) => void) | null;
  onError: ((error: string) => void) | null;
}

let enginePromise: Promise<EngineCtor> | null = null;

/**
 * Test seam: tests may replace this to inject a fake engine constructor so
 * controller lifecycle behavior (callback detachment, stale-callback guards)
 * is verified without the real network engine. Production code never touches
 * this variable. When unset, loadEngine falls back to the real provider.
 */
let engineFactoryOverride: (() => Promise<EngineCtor>) | undefined = undefined;

/** Lazily import the provider so it never loads until a test starts. */
async function loadEngine(): Promise<EngineCtor> {
  const override = engineFactoryOverride;
  if (override) {
    return override();
  }
  if (!enginePromise) {
    enginePromise = import('@cloudflare/speedtest').then((mod) => {
      return (mod.default ?? mod) as unknown as EngineCtor;
    });
  }
  return enginePromise;
}

const BPS_PER_MBPS = 1_000_000;

/* -------------------------------------------------------------------------- */
/* Resource Timing guard (Safari / iOS Safari, and any concurrent run)        */
/* -------------------------------------------------------------------------- */
/**
 * Why this exists.
 *
 * The engine derives every number from the Resource Timing entry for the
 * request it just made, and it reads that entry SYNCHRONOUSLY in the same
 * microtask chain, immediately after `response.text()` resolves:
 *
 *     const perf = performance.getEntriesByName(url).slice(-1)[0];
 *     ... perf.transferSize ...            // throws when perf is undefined
 *
 * There is no existence check, so a missing entry is a fatal TypeError. The
 * engine's catch then reports it as a CONNECTION failure and aborts the
 * entire run, which is why the test "did not work" in Safari. Two distinct
 * mechanisms put that entry out of reach, both reproduced below.
 *
 * 1. LATE RECORDING (WebKit / Safari). Blink records the entry before the
 *    fetch promise settles. WebKit records it on a LATER task, so for the
 *    first few milliseconds the read finds nothing. Measured in Playwright
 *    WebKit 26.0: entries arrive late (up to ~50 ms / ~22 macrotasks) but
 *    never go missing for good — 30/30 late, 0 never.
 *
 * 2. THE BUFFER BEING CLEARED MID-FLIGHT (any browser). The engine runs its
 *    bandwidth engine and a separate "loaded latency" probe engine at the
 *    same time, and at the end of EVERY measurement step it calls
 *    `performance.clearResourceTimings()` (dist/speedtest.js:505). The two
 *    engines share one global buffer, so that call can wipe the entry the
 *    other engine is about to read. The buffer collapses to 0-1 entries
 *    mid-run and stays there, and the affected entry is then gone for good
 *    — waiting cannot bring it back. This is why waiting alone was not
 *    enough, and why the same abort was also seen in Chromium.
 *
 *    The guard therefore keeps its OWN copy of every entry it sees, via a
 *    `PerformanceObserver`, and falls back to that copy when the shared
 *    buffer no longer holds the entry. The engine keeps its normal
 *    behaviour: the live buffer is still consulted first and is still
 *    cleared at step boundaries, so a finished run can never be mistaken
 *    for a fresh one. The cache is created per run and discarded with it.
 *
 * (Related but separate: WebKit also force-zeroes `transferSize` for
 * cross-origin resources, w3c/resource-timing#222. The upstream engine
 * already works around the zeroing, which is why the numbers themselves
 * were never wrong — only the missing entry was fatal.)
 *
 * The guard never fabricates a timing value, never changes how the body is
 * read, and never alters the numbers. Every value the engine ends up with
 * is the browser's own `PerformanceResourceTiming` for that exact URL. It
 * only (a) retains entries long enough to survive the engine's own buffer
 * clear and (b) hands the engine its response once the entry it is about to
 * read synchronously is actually there. Where the entry is already
 * available — every other request, and most WebKit requests — nothing is
 * delayed at all.
 */

/** Only the Cloudflare measurement endpoints need the guard. */
const MEASUREMENT_URL_RE = /^https:\/\/speed\.cloudflare\.com\/__(?:down|up)(?:[/?]|$)/;

/**
 * Bounded wait for a late-recorded entry. Measured worst case is ~50 ms;
 * 300 ms is a wide margin that still guarantees a run cannot hang. On expiry
 * we resolve anyway and let the engine's own error path run, so a genuinely
 * broken request still fails loudly rather than silently succeeding.
 */
const TIMING_WAIT_BUDGET_MS = 300;
const TIMING_POLL_MS = 4;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

/**
 * The engine reports every failure as a bare "Connection failed to <url>"
 * and logs the real cause only to `console.warn` (dist/speedtest.js:625).
 * That is the difference between a genuine network failure, a 429, and the
 * timing TypeError above — three problems with three different fixes, which
 * the user cannot tell apart. This records the engine's own detail so the
 * UI can report what actually went wrong instead of guessing.
 */
/**
 * The engine logs `Error fetching <url>: <detail>`. The url is captured
 * literally from the scheme so the colon inside "https:" cannot be mistaken
 * for the separator.
 */
const ENGINE_WARN_RE = /Error fetching (https?:\/\/\S+?):\s*([\s\S]*)$/;

/** Live detail captured from the engine's own warning, keyed by request URL. */
const engineFailureDetail = new Map<string, string>();

/**
 * What actually went wrong, established by probing rather than guessing.
 *
 * The engine collapses every failure into "Connection failed to <url>". That
 * single string covers four problems with four completely different fixes,
 * and Safari makes two of them look identical on purpose: a CORS rejection
 * and a genuine network failure both surface as `TypeError: Failed to fetch`
 * / "Load failed", by design, so a page cannot probe a third party to learn
 * whether a request was blocked. Guessing between them — which is what this
 * adapter used to do — sends the user chasing the wrong problem.
 */
type SpeedFailureKind =
  /** The request completed; the browser had not published its timing entry. */
  | 'timing'
  /** Rejected, but the same URL is reachable when CORS is not applied. */
  | 'cors'
  /** Rejected even with CORS not applied — the request never reached Cloudflare. */
  | 'network'
  /** The request was cancelled (engine cancel, or the page/tab going away). */
  | 'abort'
  /** The endpoint answered with a non-2xx status. */
  | 'http';

interface SpeedFailureDetail {
  kind: SpeedFailureKind;
  /** The browser's own error text, kept verbatim for the message. */
  message: string;
}

const speedFailureDetail = new Map<string, SpeedFailureDetail>();

function recordSpeedFailure(url: string, detail: SpeedFailureDetail): void {
  speedFailureDetail.set(url, detail);
}

function takeSpeedFailure(url: string): SpeedFailureDetail | undefined {
  return speedFailureDetail.get(url);
}

function recordEngineFailureDetail(url: string, detail: string): void {
  engineFailureDetail.set(url, detail.trim());
}

function takeEngineFailureDetail(url: string): string | undefined {
  return engineFailureDetail.get(url);
}

/**
 * Waits for the reachability probe to settle so the user is told what
 * actually happened rather than a guess. Bounded, and never rejects.
 */
function awaitSpeedFailureClassification(url: string, timeoutMs: number): Promise<void> {
  if (takeSpeedFailure(url)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      if (takeSpeedFailure(url) || Date.now() - startedAt >= timeoutMs) return resolve();
      setTimeout(poll, TIMING_POLL_MS);
    };
    setTimeout(poll, TIMING_POLL_MS);
  });
}

function errorUrl(error: string | undefined): string {
  return (error?.match(/https?:\/\/\S+/)?.[0] ?? '').replace(/[.,;:]+$/, '');
}

export function describeSpeedFailureKind(kind: SpeedFailureKind, httpStatus?: number): string {
  switch (kind) {
    case 'cors':
      return 'the browser blocked the response to this cross-origin measurement request (a CORS rejection), even though the request reached Cloudflare';
    case 'network':
      return 'the request never reached Cloudflare, so this is a real network failure on this connection';
    case 'abort':
      return 'the request was cancelled before it completed';
    case 'timing':
      return 'the measurement completed, but the browser had not published its timing data yet';
    case 'http':
      return `Cloudflare's measurement endpoint answered with HTTP ${httpStatus ?? '???'}`;
  }
}

/**
 * Installs the guard for the lifetime of one run. Returns an idempotent
 * uninstall function that restores `fetch`, `getEntriesByName` and
 * `console.warn` exactly as they were. Only measurement responses are ever
 * delayed; every other request the app makes passes straight through.
 */
function installResourceTimingGuard(): () => void {
  const w = globalThis as unknown as { fetch?: typeof fetch };
  const perf = globalThis.performance as Performance | undefined;
  if (typeof w.fetch !== 'function' || !perf || typeof perf.getEntriesByName !== 'function') {
    return () => {};
  }

  const originalFetch = w.fetch;
  const originalGetEntriesByName = perf.getEntriesByName.bind(perf);
  const originalWarn = console.warn;

  // Per-run copy of every entry the browser records, so an entry survives
  // the engine clearing the shared buffer underneath it.
  const cache = new Map<string, PerformanceEntry>();
  const remember = (entry: PerformanceEntry) => {
    try {
      cache.set(entry.name, entry);
    } catch {
      // An exotic entry shape is not worth failing a measurement over.
    }
  };

  let observer: PerformanceObserver | undefined;
  try {
    if (typeof PerformanceObserver === 'function') {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) remember(entry);
      });
      observer.observe({ type: 'resource', buffered: true } as PerformanceObserverInit);
    }
  } catch {
    // No observer support — the wait below still covers late entries.
  }

  const lookup = (url: string): PerformanceEntry[] => {
    const live = originalGetEntriesByName(url);
    if (live.length) {
      remember(live[live.length - 1]);
      return live;
    }
    const cached = cache.get(url);
    return cached ? [cached] : live;
  };

  // (2) Fall back to our copy when the shared buffer no longer has it.
  const guardedGetEntries: Performance['getEntriesByName'] = (name: string) => lookup(name);
  try {
    perf.getEntriesByName = guardedGetEntries;
  } catch {
    // A read-only performance object is fine — the wait below still helps.
  }

  const guardedWarn: typeof console.warn = (...args: unknown[]) => {
    try {
      const match = ENGINE_WARN_RE.exec(args.map(String).join(' '));
      if (match) recordEngineFailureDetail(match[1], match[2]);
    } catch {
      // Never let diagnostics break the run.
    }
    originalWarn.apply(console, args as []);
  };
  console.warn = guardedWarn;

  const hasEntry = (url: string): boolean => {
    try {
      return lookup(url).length > 0;
    } catch {
      return true; // no Resource Timing support — never make a run wait
    }
  };

  /**
   * Is this URL reachable at all? A `no-cors` request is not subject to the
   * same-origin policy, so it still completes when the only thing that
   * stopped the real request was a CORS rejection, and still fails when the
   * request genuinely could not be made. Uses the ORIGINAL fetch so the
   * guard cannot recurse into itself, and no caller signal so a cancelled
   * run still gets its answer.
   */
  const probeReachability = (url: string): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    return originalFetch
      .call(globalThis, url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
      .then(() => true)
      .catch(() => false)
      .finally(() => clearTimeout(timer));
  };

  /**
   * Resolves once the entry the engine is about to read synchronously is
   * available, or once the budget is spent, reporting which happened. Never
   * rejects: cancellation is handled by the caller's abort signal and must
   * not become a spurious measurement failure.
   */
  const waitForEntry = (url: string, signal?: AbortSignal | null): Promise<boolean> => {
    if (hasEntry(url)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const startedAt = Date.now();
      let settled = false;
      const onAbort = () => finish(hasEntry(url));
      const finish = (found: boolean) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        resolve(found);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const poll = () => {
        if (settled) return;
        if (hasEntry(url)) return finish(true);
        if (Date.now() - startedAt >= TIMING_WAIT_BUDGET_MS) return finish(false);
        setTimeout(poll, TIMING_POLL_MS);
      };
      setTimeout(poll, TIMING_POLL_MS);
    });
  };

  const guardedFetch: typeof fetch = (input, init) => {
    const url = requestUrl(input as RequestInfo);
    if (!MEASUREMENT_URL_RE.test(url)) return originalFetch.call(globalThis, input, init);
    const signal =
      init?.signal ??
      ((typeof input === 'object' && input !== null ? (input as Request).signal : null) ?? null);

    return originalFetch.call(globalThis, input, init).then(
      (response) => {
        if (!response.ok) {
          recordSpeedFailure(url, { kind: 'http', message: `HTTP ${response.status}` });
        }
        // (1) Hand the engine its response only once the entry it is about to
        // read synchronously is actually available.
        return waitForEntry(url, signal).then((found) => {
          if (!found) {
            recordSpeedFailure(url, { kind: 'timing', message: 'no Resource Timing entry' });
          }
          return response;
        });
      },
      (error: unknown) => {
        // Classify by probing, not by guessing: Safari reports a CORS
        // rejection and a real network failure with the SAME error, so the
        // only way to tell them apart is to ask whether the same URL is
        // reachable when CORS is not applied.
        const name = (error as { name?: string })?.name ?? '';
        const message = (error as { message?: string })?.message ?? String(error);
        if (name === 'AbortError') {
          recordSpeedFailure(url, { kind: 'abort', message });
        } else {
          void probeReachability(url).then((reachable) => {
            recordSpeedFailure(url, {
              kind: reachable ? 'cors' : 'network',
              message,
            });
          });
        }
        throw error;
      }
    );
  };
  w.fetch = guardedFetch;

  let uninstalled = false;
  return () => {
    if (uninstalled) return;
    uninstalled = true;
    cache.clear();
    if (w.fetch === guardedFetch) w.fetch = originalFetch;
    if (console.warn === guardedWarn) console.warn = originalWarn;
    if (perf.getEntriesByName !== guardedGetEntries) {
      try {
        perf.getEntriesByName = originalGetEntriesByName as Performance['getEntriesByName'];
      } catch {
        // Nothing to restore if the property was never writable.
      }
    }
    try {
      observer?.disconnect();
    } catch {
      // Already disconnected.
    }  };
}



/**
 * bps → Mbps with one decimal. Zero, negative, non-finite, or absurdly
 * sub-resolution values map to null rather than a fabricated number.
 * Exported for focused regression tests.
 */
export function bpsToMbps(bps: number | undefined): number | null {
  if (typeof bps !== 'number' || !Number.isFinite(bps) || bps < 0) return null;
  return Math.round((bps / BPS_PER_MBPS) * 10) / 10;
}

/** Non-finite/negative ms values map to null, never fabricated. Exported for tests. */
export function msOrNull(v: number | undefined | null): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 10) / 10;
}

/**
 * The engine reports every failure as a bare "Connection failed to <url>",
 * whatever the real cause was, and only logs the detail to the console. That
 * collapses three very different problems — a genuine network failure, an
 * HTTP status, and the Resource Timing TypeError described above — into one
 * message, so the user cannot tell what to do about it.
 *
 * `detail` is the engine's own logged cause when the guard captured one.
 * Without it we must not invent a cause: we only say what is certain, that
 * the phase did not complete and no result was recorded. Exported for tests.
 */
export function describeEngineError(error: string | undefined, detail?: string): string {
  const raw = typeof error === 'string' && error.trim() ? error.trim() : 'The speed-test engine reported a failure.';
  if (!/^(Connection failed to|Request failed with \d+:)/.test(raw)) return raw;
  const url = errorUrl(raw);
  const established = takeSpeedFailure(url);
  const logged = (typeof detail === 'string' ? detail.trim() : '') || takeEngineFailureDetail(url) || '';

  // The timing race: the request SUCCEEDED, only the browser's timing entry
  // was not there yet. The engine's own log line is the proof.
  if (/transferSize|is not an object|undefined is not/i.test(logged)) {
    return `${raw} The measurement completed, but this browser had not published its timing data yet, so the run was stopped rather than report a number it could not stand behind. Run it again — this is a browser timing quirk, not a problem with your connection.`;
  }

  // Otherwise report only what was actually established by probing. If
  // nothing was established, say exactly that rather than inventing a cause.
  if (established) {
    const how = describeSpeedFailureKind(established.kind);
    return `${raw} Stopped because ${how}. No speed result was recorded.`;
  }

  const status = raw.match(/Request failed with (\d+)/)?.[1];
  if (status) {
    return `${raw} Cloudflare's measurement endpoint returned HTTP ${status}${
      status === '429' ? ' (rate limited — wait a minute and run it again)' : ''
    }. No speed result was recorded.`;
  }
  const phase = url.includes('__up') ? 'upload' : url.includes('__down') ? 'download' : null;
  return phase
    ? `${raw} The ${phase} transfer did not complete, so no speed result was recorded.`
    : raw;
}

export class CloudflareSpeedTestController {
  private engine: CloudflareSpeedTestEngineLike | null = null;
  private events: SpeedTestEvents;
  private phase: SpeedPhase = 'idle';
  private generation = 0; // obsolete-run guard
  /**
   * Set the instant the engine reports a failure, BEFORE the message is
   * finalised. The cause is established asynchronously, and without this the
   * engine could call onFinish in that window and present a partial run as a
   * completed measurement.
   */
  private failurePending = false;
  private releaseTimingGuard: (() => void) | null = null;

  constructor(events: SpeedTestEvents) {
    this.events = events;
  }

  get currentPhase(): SpeedPhase {
    return this.phase;
  }

  async start(): Promise<void> {
    if (this.phase === 'running') return;
    const gen = ++this.generation;
    // A previous run's diagnosis must never be attributed to this one.
    speedFailureDetail.clear();
    engineFailureDetail.clear();
    this.failurePending = false;
    this.setPhase('running');
    try {
      // Installed BEFORE play() so the very first measurement request is
      // already covered by the WebKit Resource Timing race guard.
      this.releaseTimingGuard?.();
      this.releaseTimingGuard = installResourceTimingGuard();
      const Engine = await loadEngine();
      if (gen !== this.generation) return; // superseded while loading
      const engine = new Engine({
        autoStart: false,
        measurements: MEASUREMENTS,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
      });
      this.engine = engine;

      engine.onRunningChange = (running) => {
        if (gen !== this.generation) return;
        if (!running && this.phase === 'running') {
          // Engine finished naturally.
        }
      };
      engine.onResultsChange = () => {
        if (gen !== this.generation) return;
        this.events.onProgress(this.readSummary(engine));
      };
      engine.onPhaseChange = (info) => {
        if (gen !== this.generation) return;
        const type = info?.measurement?.type;
        if (type !== 'latency' && type !== 'download' && type !== 'upload') return;
        this.events.onPhaseInfo?.({
          type,
          bytes: info.measurement.bytes,
          count: info.measurement.count,
          step: (info.measurementId ?? 0) + 1,
          totalSteps: MEASUREMENTS.length,
        });
      };
      engine.onError = (error) => {
        if (gen !== this.generation) return;
        // Block a 'finished' transition synchronously; only the message waits.
        this.failurePending = true;
        // The reachability probe that distinguishes a CORS rejection from a
        // real network failure is asynchronous, so wait briefly for it. The
        // run is already over; only the accuracy of the message is pending.
        void awaitSpeedFailureClassification(errorUrl(error), 3000).then(() => {
          if (gen !== this.generation) return;
          this.setPhase('error', describeEngineError(error));
        });
      };
      engine.onFinish = () => {
        if (gen !== this.generation) return;
        // An engine that already reported a failure or was cancelled must
        // never be able to present its partial data as a finished result.
        if (this.failurePending || this.phase === 'error' || this.phase === 'aborted') return;
        this.events.onProgress(this.readSummary(engine));
        this.setPhase('finished');
      };

      engine.play();
    } catch (err) {
      if (gen !== this.generation) return;
      this.setPhase('error', err instanceof Error ? err.message : 'The speed-test engine failed to load.');
    }
  }

  /** Best-effort cancel: pause now and invalidate all future callbacks. */
  cancel(): void {
    this.generation += 1;
    this.releaseTimingGuard?.();
    this.releaseTimingGuard = null;
    try {
      this.engine?.pause();
    } catch {
      // engine may be mid-flight; generation guard discards its callbacks
    }
    this.engine = null;
    if (this.phase === 'running') this.setPhase('aborted');
  }

  /**
   * Departure: detach engine callbacks BEFORE cancel() clears the engine
   * reference. The previous order (cancel first) nulled this.engine and made
   * the detach block dead code — the engine could then fire a callback into
   * an already-disposed controller between pause() and teardown.
   */
  dispose(): void {
    const engine = this.engine;
    if (engine) {
      engine.onRunningChange = null;
      engine.onResultsChange = null;
      engine.onPhaseChange = null;
      engine.onFinish = null;
      engine.onError = null;
    }
    this.cancel();
  }

  private readSummary(engine: CloudflareSpeedTestEngineLike): SpeedSummary {
    const s = engine.results.getSummary();
    return {
      downloadMbps: bpsToMbps(s.download as number | undefined),
      uploadMbps: bpsToMbps(s.upload as number | undefined),
      latencyMs: msOrNull(s.latency as number | undefined),
      jitterMs: msOrNull(s.jitter as number | undefined),
      downLoadedLatencyMs: msOrNull(s.downLoadedLatency as number | undefined),
      upLoadedLatencyMs: msOrNull(s.upLoadedLatency as number | undefined),
    };
  }

  private setPhase(phase: SpeedPhase, error?: string): void {
    // The run is over once it leaves 'running': the guard is only needed
    // while measurement requests are in flight.
    if (phase !== 'running' && phase !== 'idle') {
      this.releaseTimingGuard?.();
      this.releaseTimingGuard = null;
    }
    this.phase = phase;
    this.events.onPhase(phase, error);
  }
}

/**
 * Install a fake engine factory for regression tests. Returns a restore
 * function. NOT used by production code paths.
 */
export function __setEngineFactoryForTests(
  factory: (() => Promise<EngineCtor>) | null
): () => void {
  const previous = engineFactoryOverride;
  engineFactoryOverride = factory ?? undefined;
  return () => {
    engineFactoryOverride = previous;
  };
}
