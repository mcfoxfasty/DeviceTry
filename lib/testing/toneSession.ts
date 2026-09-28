/**
 * Audio-graph bookkeeping and honest verdicts for the tone generator.
 *
 * The previous component had three defects this module exists to fix:
 *
 * 1. Self-killing tone. `playTone` began by calling `stopTone`, whose cleanup
 *    ran in a `setTimeout(…, 60)`. That timer fired AFTER the new oscillator
 *    existed and stopped whatever the refs pointed at at that moment — the
 *    brand-new tone. Every play was therefore a ~60 ms blip followed by
 *    silence. Timers here capture the exact nodes they tear down, so a
 *    deferred finalize can never touch a newer session (a generation counter
 *    guards in-flight starts as well).
 * 2. No mobile activation handling. iOS Safari creates AudioContexts in a
 *    suspended state until a user gesture resumes them. Start now awaits
 *    `resume()` inside the click and reports honestly when the context did
 *    not reach the running state.
 * 3. Dishonest result. The component emitted `'passed'` the moment Play was
 *    clicked, over silence. Verdicts are now derived from what the audio
 *    graph actually did.
 *
 * Overlapping tones are impossible: starting always tears the previous graph
 * down synchronously first, and every teardown touches only captured nodes.
 */

/** Gain ramp-in duration, seconds. */
export const TONE_RAMP_IN_SECONDS = 0.04;
/** Gain ramp-out duration, seconds. Short enough to feel like an instant stop. */
export const TONE_RAMP_OUT_SECONDS = 0.05;
/** Fallback finalize delay, ms — covers suspended clocks where `onended` never fires. */
export const TONE_FINALIZE_FALLBACK_MS = 200;

export const TONE_FREQUENCY_MIN = 20;
export const TONE_FREQUENCY_MAX = 12000;
export const TONE_VOLUME_MIN = 0.01;
export const TONE_VOLUME_MAX = 0.5;

/** Clamp a requested frequency into the generator's supported band. */
export function clampToneFrequency(hz: number): number {
  if (!Number.isFinite(hz)) return TONE_FREQUENCY_MIN;
  return Math.min(TONE_FREQUENCY_MAX, Math.max(TONE_FREQUENCY_MIN, hz));
}

/** Clamp a requested gain into the generator's conservative range. */
export function clampToneVolume(v: number): number {
  if (!Number.isFinite(v)) return TONE_VOLUME_MIN;
  return Math.min(TONE_VOLUME_MAX, Math.max(TONE_VOLUME_MIN, v));
}

/**
 * Create the browser's AudioContext, accepting the `webkitAudioContext`
 * spelling older Safari uses. Returns null when Web Audio is unavailable so
 * callers can report an honest failure instead of throwing.
 */
export function createToneAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export interface ToneStartOutcome {
  started: boolean;
  /** True when the context reached the `running` state after start. */
  running: boolean;
  contextState: string;
  error?: string;
}

interface ToneGraph {
  context: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
}

/**
 * Owns one tone at a time. Every teardown captures its nodes, so deferred
 * finalization is safe, and a generation counter invalidates starts that are
 * overtaken by a stop or a newer start.
 */
export class ToneSession {
  private graph: ToneGraph | null = null;
  private generation = 0;
  private disposed = false;

  get isPlaying(): boolean {
    return this.graph !== null;
  }

  /**
   * Start a tone, replacing any current one. Must be called from a user
   * gesture on mobile browsers so the context may leave `suspended`.
   */
  async start(params: {
    frequency: number;
    volume: number;
    waveform: OscillatorType;
  }): Promise<ToneStartOutcome> {
    if (this.disposed) {
      return { started: false, running: false, contextState: 'closed', error: 'session disposed' };
    }

    // Invalidate any in-flight start and tear the previous tone down
    // synchronously — this is what makes overlapping tones impossible.
    this.generation += 1;
    const gen = this.generation;
    this.teardownCurrent();

    const context = createToneAudioContext();
    if (!context) {
      return { started: false, running: false, contextState: 'missing', error: 'Web Audio unavailable' };
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    try {
      oscillator.type = params.waveform;
      oscillator.frequency.setValueAtTime(clampToneFrequency(params.frequency), context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.linearRampToValueAtTime(clampToneVolume(params.volume), context.currentTime + TONE_RAMP_IN_SECONDS);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
    } catch (error) {
      this.finalizeGraph({ context, oscillator, gain });
      return { started: false, running: false, contextState: context.state, error: describeError(error) };
    }

    const graph: ToneGraph = { context, oscillator, gain };
    this.graph = graph;

    // Mobile browsers suspend new contexts until a gesture resumes them.
    let state = context.state;
    if (state === 'suspended') {
      try {
        await context.resume();
      } catch (error) {
        // resume() rejecting is reported through the state check below.
        void error;
      }
      state = context.state;
    }

    // A stop or newer start overtook us while awaiting resume(): discard this
    // graph entirely rather than leave a ghost tone playing. Finalize the
    // LOCAL graph — `this.graph` may already have been nulled or replaced by
    // the stop/newer start that overtook us.
    if (gen !== this.generation) {
      this.graph = null;
      this.finalizeGraph(graph);
      return { started: false, running: false, contextState: state, error: 'superseded' };
    }

    return { started: true, running: state === 'running', contextState: state };
  }

  /** Change the frequency of the current tone. Ignored when not playing. */
  updateFrequency(hz: number): void {
    const graph = this.graph;
    if (!graph) return;
    try {
      graph.oscillator.frequency.setValueAtTime(clampToneFrequency(hz), graph.context.currentTime);
    } catch {
      // A graph being torn down can reject param writes; that is fine.
    }
  }

  /** Change the waveform of the current tone. Ignored when not playing. */
  updateWaveform(waveform: OscillatorType): void {
    const graph = this.graph;
    if (!graph) return;
    try {
      graph.oscillator.type = waveform;
    } catch {
      // Same teardown race as updateFrequency.
    }
  }

  /** Change the gain of the current tone. Ignored when not playing. */
  updateVolume(volume: number): void {
    const graph = this.graph;
    if (!graph) return;
    try {
      graph.gain.gain.setValueAtTime(clampToneVolume(volume), graph.context.currentTime);
    } catch {
      // Same teardown race as updateFrequency.
    }
  }

  /**
   * Stop the current tone immediately (a short de-click ramp aside) and
   * release every node. Safe to call when nothing is playing.
   */
  stop(): void {
    this.generation += 1;
    this.teardownCurrent();
  }

  /** Stop and forbid further starts — unmount path. */
  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  /** Current context state, for honest reporting. */
  contextState(): string {
    return this.graph?.context.state ?? 'not-created';
  }

  /**
   * Ramp the current graph out and schedule its finalize. Captures the nodes
   * so a later start/stop can never redirect this cleanup at newer ones.
   */
  private teardownCurrent(): void {
    const graph = this.graph;
    this.graph = null;
    if (!graph) return;

    try {
      const t = graph.context.currentTime;
      graph.gain.gain.cancelScheduledValues(t);
      graph.gain.gain.setValueAtTime(graph.gain.gain.value, t);
      graph.gain.gain.linearRampToValueAtTime(0, t + TONE_RAMP_OUT_SECONDS);
      graph.oscillator.stop(t + TONE_RAMP_OUT_SECONDS + 0.01);
    } catch {
      // Already stopped or the context is closed; finalize still runs below.
    }

    this.scheduleFinalize(graph);
  }

  /** Finalize exactly these nodes, once, by hook and by fallback timer. */
  private scheduleFinalize(graph: ToneGraph): void {
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      this.finalizeGraph(graph);
    };
    // `onended` is the natural cleanup point while the clock runs; the timer
    // covers suspended/interrupted clocks where `onended` never fires. Both
    // are idempotent and touch only these captured nodes.
    graph.oscillator.onended = finalize;
    setTimeout(finalize, TONE_FINALIZE_FALLBACK_MS);
  }

  /** Disconnect every node and close the context, swallowing double teardown. */
  private finalizeGraph(graph: ToneGraph): void {
    try {
      graph.oscillator.onended = null;
    } catch {
      // Node already gone.
    }
    try {
      graph.oscillator.disconnect();
    } catch {
      // Already disconnected.
    }
    try {
      graph.gain.disconnect();
    } catch {
      // Already disconnected.
    }
    if (graph.context.state !== 'closed') {
      graph.context.close().catch(() => {
        // Closing is best-effort; a failed close leaves the GC to collect.
      });
    }
  }
}

/** The verdict the tone generator reports, derived from observed graph state. */
export function toneSessionVerdict(outcome: {
  started: boolean;
  running: boolean;
  contextState: string;
  frequency: number;
  waveform: string;
  /** Present when the start failed and the reason should be reported. */
  error?: string;
}): { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string } {
  if (outcome.contextState === 'missing') {
    return {
      status: 'failed',
      details:
        'Web Audio is not available in this browser, so no tone can be generated. This is a browser capability limitation, not a speaker result.',
    };
  }

  if (!outcome.started) {
    if (outcome.error === 'superseded') {
      return {
        status: 'inconclusive',
        details: 'The tone was replaced or stopped before it could start. Press Play to sound a tone.',
      };
    }
    return {
      status: 'inconclusive',
      details: `The audio session did not start (context state: ${outcome.contextState}). On mobile browsers the first start must come from a tap — press Play again.`,
    };
  }

  if (!outcome.running) {
    return {
      status: 'inconclusive',
      details: `The oscillator was created but the audio context stayed "${outcome.contextState}", so the tone may be silent. Press Play again — mobile browsers require the gesture that resumes audio.`,
    };
  }

  return {
    status: 'passed',
    details: `Playing a ${outcome.frequency} Hz ${outcome.waveform} tone through the audio context (state: running). Confirm audibility by ear — this verifies tone generation, not speaker quality.`,
  };
}

/** Best-effort error text for reporting a failed graph setup. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
