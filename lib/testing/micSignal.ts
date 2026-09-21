/**
 * Microphone signal observation — extracted from MicrophoneTester so the
 * "stream connection is not a passed observation" rule is regression-testable.
 *
 * A live analyser (or an RMS of exactly zero, i.e. digital silence) proves
 * only that the browser receives SOME stream — not that a usable microphone
 * signal is arriving. Silence can mean a muted hardware switch, a disabled
 * device, or OS privacy muting, none of which is a hardware failure verdict.
 *
 * The observer therefore requires a SUSTAINED non-trivial RMS level across
 * consecutive analysis frames before it credits a usable signal, and maps:
 * - sustained signal            → passed (relative level observed)
 * - permission granted, silence → inconclusive (honest, not failed)
 */
export interface SignalWindowConfig {
  /** RMS percent (0–100 scale used by the meter) considered non-trivial. */
  thresholdPercent: number;
  /** How many consecutive frames must exceed the threshold. */
  requiredFrames: number;
}

export const DEFAULT_SIGNAL_WINDOW: SignalWindowConfig = {
  thresholdPercent: 1,
  requiredFrames: 10,
};

export class MicSignalObserver {
  private config: SignalWindowConfig;
  private consecutive = 0;
  private observed = false;
  private maxLevel = 0;
  /** Set by the consumer once the "usable signal" verdict has been emitted. */
  observedReported = false;

  constructor(config: SignalWindowConfig = DEFAULT_SIGNAL_WINDOW) {
    this.config = config;
  }

  /** Feed one analysis frame's RMS percent (0–100). */
  observe(levelPercent: number): void {
    if (levelPercent > this.maxLevel) {
      this.maxLevel = levelPercent;
    }
    if (levelPercent > this.config.thresholdPercent) {
      this.consecutive += 1;
      if (this.consecutive >= this.config.requiredFrames) {
        this.observed = true;
      }
    } else {
      this.consecutive = 0;
    }
  }

  /** True once a sustained usable signal has been observed this run. */
  get hasUsableSignal(): boolean {
    return this.observed;
  }

  get peakLevelPercent(): number {
    return this.maxLevel;
  }

  /** Reset for a new observation run (fresh token). */
  reset(): void {
    this.consecutive = 0;
    this.observed = false;
    this.maxLevel = 0;
    this.observedReported = false;
  }
}
