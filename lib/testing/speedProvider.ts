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

export class CloudflareSpeedTestController {
  private engine: CloudflareSpeedTestEngineLike | null = null;
  private events: SpeedTestEvents;
  private phase: SpeedPhase = 'idle';
  private generation = 0; // obsolete-run guard

  constructor(events: SpeedTestEvents) {
    this.events = events;
  }

  get currentPhase(): SpeedPhase {
    return this.phase;
  }

  async start(): Promise<void> {
    if (this.phase === 'running') return;
    const gen = ++this.generation;
    this.setPhase('running');
    try {
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
        this.setPhase('error', error);
      };
      engine.onFinish = () => {
        if (gen !== this.generation) return;
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
