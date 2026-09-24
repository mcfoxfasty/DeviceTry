/**
 * Pitch detection and equal-tempered note math — extracted from
 * InstrumentTunerTester / PitchDetectorTester so the algorithms are
 * regression-testable without a browser or a physical instrument.
 *
 * All functions here are SYNTHETIC-SIGNAL algorithm verification tools; none
 * of them constitutes a physical-instrument measurement.
 *
 * Honest-range note: autocorrelation over an N-sample window cannot resolve
 * periods longer than the window, and short windows cannot resolve low
 * frequencies reliably. The documented usable ranges below reflect the
 * algorithms' real limits, not marketing claims.
 */

/** Concert pitch A4 = 440 Hz (ISO 16). */
export const A4_HZ = 440;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Semitone distance from A4 (MIDI 69) for a frequency; fractional. */
export function semitonesFromA4(frequency: number): number {
  return 12 * Math.log2(frequency / A4_HZ);
}

/**
 * The nearest equal-tempered MIDI note number for a frequency.
 * C-1 = 0, A4 = 69. Rounded to the nearest semitone.
 */
export function nearestMidiNote(frequency: number): number {
  return Math.round(semitonesFromA4(frequency)) + 69;
}

/** Equal-tempered target frequency of a MIDI note number. */
export function frequencyFromMidiNote(note: number): number {
  return A4_HZ * Math.pow(2, (note - 69) / 12);
}

/**
 * Cents deviation of `frequency` from the equal-tempered pitch of `note`.
 * Positive = sharp, negative = flat. Not floored — fractional cents are
 * meaningful at this precision.
 */
export function centsOffFromNote(frequency: number, note: number): number {
  const target = frequencyFromMidiNote(note);
  return 1200 * Math.log2(frequency / target);
}

/** Human note label ("A4", "C#3") for a MIDI note number. */
export function noteLabel(note: number): { name: string; octave: number } {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return { name, octave };
}

/**
 * Chromatic-mode derivation: from a confident detected frequency, derive the
 * nearest equal-tempered note, its exact target frequency, and the cents
 * deviation. This is genuinely chromatic — it never reuses an instrument
 * preset's string target as the detected note.
 */
export interface ChromaticReading {
  midiNote: number;
  name: string;
  octave: number;
  targetHz: number;
  cents: number;
}

export function deriveChromaticReading(frequency: number): ChromaticReading {
  const midiNote = nearestMidiNote(frequency);
  const { name, octave } = noteLabel(midiNote);
  return {
    midiNote,
    name,
    octave,
    targetHz: Math.round(frequencyFromMidiNote(midiNote) * 100) / 100,
    cents: Math.round(centsOffFromNote(frequency, midiNote) * 10) / 10,
  };
}

/** Honest scope for a browser microphone reading; never presented as calibrated tuning. */
export const PITCH_DETECTOR_LIMITATION =
  'Browser-estimated fundamental via autocorrelation, not a calibrated tuner. Harmonics, room noise, and short or quiet buffers can misidentify the note. Reliable range is 47–2,500 Hz.';

export interface PitchMeasurement {
  frequencyHz: number;
  note: string;
  cents: number;
  confidence: number;
  details: string;
  metrics: Record<string, number | string>;
}

/**
 * Build the same safe measurement summary for the in-card banner, host report,
 * and browser-local history. The caller must have already passed the signal and
 * confidence gates; this function never invents a frequency.
 */
export function buildPitchMeasurement(frequencyHz: number, confidence: number): PitchMeasurement {
  const reading = deriveChromaticReading(frequencyHz);
  const roundedFrequency = Math.round(frequencyHz * 10) / 10;
  const roundedCents = Math.max(-50, Math.min(50, Math.round(reading.cents)));
  const roundedConfidence = Math.round(confidence * 100) / 100;
  const note = `${reading.name}${reading.octave}`;

  return {
    frequencyHz: roundedFrequency,
    note,
    cents: roundedCents,
    confidence: roundedConfidence,
    details:
      `Detected ${note} at ${roundedFrequency.toFixed(1)} Hz (${roundedCents >= 0 ? '+' : ''}${roundedCents} cents, ` +
      `${Math.round(roundedConfidence * 100)}% confidence). ${PITCH_DETECTOR_LIMITATION}`,
    metrics: {
      frequencyHz: roundedFrequency,
      note,
      cents: roundedCents,
      confidence: roundedConfidence,
      algorithm: 'autocorrelation',
      reliableMinHz: PITCH_RANGE_MIN_HZ,
      reliableMaxHz: PITCH_RANGE_MAX_HZ,
    },
  };
}

export type PitchStartBlock = 'denied' | 'unavailable' | 'unknown';

/** Classify getUserMedia failures without turning a missing device into hardware failure. */
export function classifyPitchStartError(error: { name?: string }): PitchStartBlock {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'denied';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'unavailable';
  return 'unknown';
}

/**
 * Signal-reliability gate for live readings.
 *
 * A reading is stale/unreliable when the RMS falls below `minRms` (silence,
 * weak signal) — callers must clear or visibly mark previous readings rather
 * than leave them on screen as if they were current.
 */
export interface SignalGateConfig {
  /** RMS below this is treated as silence/weak (autocorrelators use ~0.01–0.02). */
  minRms: number;
}

export const DEFAULT_SIGNAL_GATE: SignalGateConfig = { minRms: 0.015 };

export function isSignalReliable(buffer: Float32Array | number[], gate: SignalGateConfig = DEFAULT_SIGNAL_GATE): boolean {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  return rms >= gate.minRms;
}

export function rmsOf(buffer: Float32Array | number[]): number {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / buffer.length);
}

/**
 * Frequency range the autocorrelation pitch algorithms can honestly support.
 * Lower bound: an fftSize-2048 window at 48 kHz spans ~42.7 ms, so periods
 * longer than half a window (below ~47 Hz) cannot be resolved reliably.
 * Upper bound: Nyquist comfortably covers speech/instruments; the loop caps
 * at 2.5 kHz to avoid octave-harmonic mislocks.
 */
export const PITCH_RANGE_MIN_HZ = 47;
export const PITCH_RANGE_MAX_HZ = 2500;

/**
 * Generate a sine-wave test buffer for algorithm verification (SYNTHETIC —
 * used only by tests, never presented as a physical measurement).
 */
export function synthSine(freq: number, sampleRate: number, seconds: number): Float32Array {
  const n = Math.round(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

/**
 * Autocorrelation pitch detection with parabolic peak interpolation.
 * Returns null when the buffer is silent/weak (callers clear stale readings).
 */
export function autoCorrelate(
  buffer: Float32Array | number[],
  sampleRate: number,
  gate: SignalGateConfig = DEFAULT_SIGNAL_GATE
): { freq: number; confidence: number } | null {
  if (!isSignalReliable(buffer, gate)) {
    return null;
  }

  let r1 = 0;
  let r2 = buffer.length - 1;
  const threshold = 0.2;
  for (let i = 0; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[buffer.length - i]) < threshold) {
      r2 = buffer.length - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Array<number>(trimmed.length).fill(0);
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < c.length - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  if (maxpos <= 0) {
    return null;
  }

  let T0 = maxpos;
  if (T0 > 0 && T0 < trimmed.length - 1) {
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) {
      T0 = T0 - b / (2 * a);
    }
  }
  if (T0 <= 0) {
    return null;
  }

  const freq = sampleRate / T0;
  const confidence = c[0] > 0 ? maxval / c[0] : 0;
  if (!Number.isFinite(freq) || freq <= 0) {
    return null;
  }
  return { freq, confidence };
}
