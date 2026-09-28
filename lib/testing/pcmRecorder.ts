/**
 * Direct PCM capture for the voice recorder.
 *
 * Why this replaces decoding
 * -------------------------
 * The first attempt recorded with MediaRecorder and then decoded the result to
 * re-encode it as WAV. That cannot work on iOS Safari: Safari's MediaRecorder
 * emits `audio/mp4`, and Safari's own `decodeAudioData` refuses to decode it
 * ("Unable to decode audio data"), so the conversion always fell back and the
 * user was handed the original container. The fix is to never depend on that
 * decode at all — tap the microphone's raw PCM while recording, and write the
 * WAVE file straight from those samples on Stop.
 *
 * Memory safety
 * -------------
 * Five minutes of audio is the cap, and samples are held as Int16 rather than
 * Float32 (half the bytes) in a list of chunks so nothing is repeatedly
 * reallocated or copied during recording. `maxFrames` is a hard ceiling: once
 * the buffer is full, further input is dropped and counted rather than growing
 * without limit. The caller can then report the drop honestly instead of
 * quietly truncating.
 *
 * Nothing here touches the DOM or Web Audio, so it is all unit-testable.
 */

import { encodePcm16Wav } from './wavEncoder';

/** Hard recording duration cap, shared with the recorder UI (seconds). */
export const PCM_MAX_RECORDING_SECONDS = 300; // 5 minutes

/** Convert one Float32 sample in [-1, 1] to a signed 16-bit integer. */
export function floatToInt16(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

/**
 * Accumulates mono PCM as Int16 chunks and emits a genuine WAVE file.
 *
 * `append` is called from the audio callback, so it does the minimum work
 * possible: one pass of float-to-int16 conversion into a single chunk, with no
 * concatenation until `toWav` is asked for the finished file.
 */
export class PcmAccumulator {
  private readonly sampleRate: number;
  private readonly maxFrames: number;
  private chunks: Int16Array[] = [];
  private frames = 0;
  private dropped = 0;

  constructor(sampleRate: number, maxSeconds = PCM_MAX_RECORDING_SECONDS) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error(`PcmAccumulator requires a positive sample rate, got ${sampleRate}`);
    }
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) {
      throw new Error(`PcmAccumulator requires a positive duration cap, got ${maxSeconds}`);
    }
    this.sampleRate = sampleRate;
    this.maxFrames = Math.ceil(sampleRate * maxSeconds);
  }

  get sampleRateHz(): number {
    return this.sampleRate;
  }

  /** Frames actually captured (excludes dropped input). */
  get frameCount(): number {
    return this.frames;
  }

  /** Frames refused because the cap was reached. */
  get droppedFrames(): number {
    return this.dropped;
  }

  /** True when the cap is reached and further input is being discarded. */
  get isFull(): boolean {
    return this.frames >= this.maxFrames;
  }

  /** Captured duration in seconds. */
  get durationSeconds(): number {
    return this.frames / this.sampleRate;
  }

  /** Bytes the finished WAVE will occupy (44-byte header + PCM data). */
  get estimatedByteLength(): number {
    return 44 + this.frames * 2;
  }

  /**
   * Add one block of mono float samples. Anything past the cap is dropped and
   * counted; passing an empty/absent block is a no-op.
   */
  append(samples: Float32Array | null | undefined): void {
    if (!samples || samples.length === 0) return;
    const remaining = this.maxFrames - this.frames;
    if (remaining <= 0) {
      this.dropped += samples.length;
      return;
    }
    const take = Math.min(samples.length, remaining);
    if (take < samples.length) {
      this.dropped += samples.length - take;
    }
    const chunk = new Int16Array(take);
    for (let index = 0; index < take; index += 1) {
      chunk[index] = floatToInt16(samples[index]);
    }
    this.chunks.push(chunk);
    this.frames += take;
  }

  /**
   * Write the captured audio out as a mono 16-bit PCM WAVE file.
   * Returns null when nothing was captured — the caller must treat that as a
   * failure rather than presenting an empty file as a success.
   */
  toWav(): ArrayBuffer | null {
    if (this.frames <= 0) return null;
    return encodePcm16Wav(this.toPcm16(), this.sampleRate, 1);
  }

  /** All captured frames concatenated into one Int16 array. */
  toPcm16(): Int16Array {
    if (this.chunks.length === 1) return this.chunks[0];
    const merged = new Int16Array(this.frames);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  /** Release every retained buffer. */
  reset(): void {
    this.chunks = [];
    this.frames = 0;
    this.dropped = 0;
  }
}

/** Result of probing whether this browser can capture raw PCM from a mic. */
export interface PcmCaptureSupport {
  supported: boolean;
  hasAudioContext: boolean;
  hasMediaStreamSource: boolean;
  hasScriptProcessor: boolean;
  /**
   * The real, specific reason capture is unavailable, phrased for the user.
   * Empty when supported.
   */
  detail: string;
}

/**
 * Probe Web Audio capability without instantiating an AudioContext, so this
 * runs before any microphone prompt. Every branch names the exact missing API
 * rather than guessing at a cause.
 */
export function detectPcmCaptureSupport(scope: unknown): PcmCaptureSupport {
  const holder = (scope ?? {}) as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  const ctor =
    typeof holder.AudioContext === 'function'
      ? (holder.AudioContext as { prototype?: Record<string, unknown> })
      : typeof holder.webkitAudioContext === 'function'
        ? (holder.webkitAudioContext as { prototype?: Record<string, unknown> })
        : null;

  if (!ctor) {
    return {
      supported: false,
      hasAudioContext: false,
      hasMediaStreamSource: false,
      hasScriptProcessor: false,
      detail:
        'This browser does not expose the Web Audio API (window.AudioContext), which is required to capture microphone audio.',
    };
  }

  const proto = ctor.prototype ?? {};
  const hasMediaStreamSource = typeof proto.createMediaStreamSource === 'function';
  const hasScriptProcessor = typeof proto.createScriptProcessor === 'function';

  if (!hasMediaStreamSource) {
    return {
      supported: false,
      hasAudioContext: true,
      hasMediaStreamSource: false,
      hasScriptProcessor,
      detail:
        'This browser\'s AudioContext has no createMediaStreamSource(), so a microphone stream cannot be routed into Web Audio.',
    };
  }
  if (!hasScriptProcessor) {
    return {
      supported: false,
      hasAudioContext: true,
      hasMediaStreamSource: true,
      hasScriptProcessor: false,
      detail:
        'This browser\'s AudioContext has no createScriptProcessor(), so raw PCM cannot be tapped from the microphone.',
    };
  }

  return {
    supported: true,
    hasAudioContext: true,
    hasMediaStreamSource: true,
    hasScriptProcessor: true,
    detail: '',
  };
}

/** Turn any thrown value into the most specific message available. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
    return `${name}${error.message || 'no message'}`;
  }
  if (typeof error === 'string' && error) return error;
  try {
    const text = JSON.stringify(error);
    if (text && text !== '{}') return text;
  } catch {
    // fall through to the generic form
  }
  return String(error);
}
