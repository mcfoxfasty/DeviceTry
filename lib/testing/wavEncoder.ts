/**
 * Genuine WAV byte encoding — extracted so the header layout and sample
 * conversion are regression-testable without a browser.
 *
 * Two encoders live here:
 *
 * - `encodePcm16Wav` is the one the voice recorder uses. It writes samples that
 *   were captured live from the microphone straight out as a real RIFF/WAVE
 *   file, with no decode step in the path at all.
 * - `encodePcmWav` / `convertRecordingToWav` decode an existing compressed blob
 *   with the Web Audio API and re-encode it. These are retained as general
 *   utilities (and are exercised by tests), but they are deliberately NOT part
 *   of the recorder: Safari refuses to decode the `audio/mp4` its own
 *   MediaRecorder produces, so depending on that decode is what broke playback
 *   on iPhone in the first place. The recorder captures PCM directly instead.
 *
 * The files written here are genuine WAVE: a 44-byte canonical RIFF header
 * followed by interleaved little-endian 16-bit PCM samples. Nothing is ever
 * renamed — a container that cannot be decoded reports its failure rather than
 * being given a .wav name it does not deserve.
 */

import { mimeContainer } from './recordingFormat';

/** Canonical MIME type for a PCM WAVE file. */
export const WAV_MIME_TYPE = 'audio/wav';

/** Bytes in the canonical RIFF/WAVE header (PCM, 16-bit). */
const WAV_HEADER_BYTES = 44;

/** Minimal structural view of a decoded AudioBuffer. */
export interface DecodedAudioLike {
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

/** Minimal structural view of the Web Audio context we need. */
export interface AudioContextLike {
  decodeAudioData(data: ArrayBuffer): Promise<DecodedAudioLike>;
  close(): Promise<void> | void;
}

export type AudioContextConstructor = new () => AudioContextLike;

export type WavFailureReason =
  | 'no-audio-context'
  | 'decode-failed'
  | 'empty-audio';

export type WavConversion =
  | { ok: true; blob: Blob; sourceBytes: number }
  | { ok: false; reason: WavFailureReason };

/**
 * True when the recording is already a WAVE container, in which case there is
 * nothing to convert and re-encoding would only add loss and cost.
 */
export function isWavContainer(mimeType: string | undefined | null): boolean {
  const container = mimeContainer(mimeType);
  return container === 'wav' || container === 'wave' || container === 'x-wav';
}

/**
 * Resolve the Web Audio constructor for this browser. Safari historically
 * exposed it as `webkitAudioContext`, so both spellings are accepted. Returns
 * null when the browser has no Web Audio support at all — the caller then keeps
 * the recorder's own output rather than failing the recording.
 */
export function resolveAudioContextConstructor(
  scope: unknown,
): AudioContextConstructor | null {
  if (!scope || typeof scope !== 'object') return null;
  const holder = scope as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  for (const candidate of [holder.AudioContext, holder.webkitAudioContext]) {
    if (typeof candidate === 'function') {
      return candidate as AudioContextConstructor;
    }
  }
  return null;
}

/**
 * Build a canonical 44-byte RIFF/WAVE header for 16-bit linear PCM.
 * Exported for tests that assert the byte layout directly.
 */
export function buildWavHeader(params: {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
}): DataView {
  const { channels, sampleRate, bitsPerSample, dataBytes } = params;
  const view = new DataView(new ArrayBuffer(WAV_HEADER_BYTES));
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  // 4 bytes of 'WAVE' + the rest of the fmt chunk + 8 bytes of data header.
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format 1 = linear PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  return view;
}

/** Clamp a normalized sample to [-1, 1] then scale to signed 16-bit. */
export function floatToPcm16(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

/**
 * Encode deinterleaved float channels into a real 16-bit PCM WAVE file.
 * Channels of differing lengths are truncated to the shortest so the file can
 * never claim more frames than it actually carries.
 */
export function encodePcmWav(
  channels: readonly Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  if (!channels.length) {
    throw new Error('encodePcmWav requires at least one channel');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`encodePcmWav requires a positive sample rate, got ${sampleRate}`);
  }
  const frameCount = channels.reduce(
    (min, channel) => Math.min(min, channel.length),
    channels[0].length,
  );
  const bytesPerSample = 2;
  const dataBytes = frameCount * channels.length * bytesPerSample;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const bytes = new Uint8Array(buffer);

  bytes.set(
    new Uint8Array(
      buildWavHeader({
        channels: channels.length,
        sampleRate: Math.round(sampleRate),
        bitsPerSample: 16,
        dataBytes,
      }).buffer,
    ),
    0,
  );

  const view = new DataView(buffer);
  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      const data = channels[channel];
      const sample = frame < data.length ? data[frame] : 0;
      view.setInt16(offset, floatToPcm16(sample), true);
      offset += bytesPerSample;
    }
  }
  return buffer;
}

/** Wrap an encoded WAVE buffer in a Blob with the canonical WAVE MIME type. */
export function createWavBlob(wav: ArrayBuffer): Blob {
  return new Blob([wav], { type: WAV_MIME_TYPE });
}

/**
 * Encode mono 16-bit PCM samples straight into a WAVE file.
 *
 * This is the path used when audio is captured sample-by-sample during
 * recording: the samples are already integers in [-32768, 32767], so they are
 * copied through untouched rather than being re-quantised from floats. No
 * decode step is involved, which is what makes it work on iOS Safari — Safari
 * cannot decode the MP4 that its own MediaRecorder produces, but it never has
 * to here.
 */
export function encodePcm16Wav(
  samples: Int16Array,
  sampleRate: number,
  channels = 1,
): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`encodePcm16Wav requires a positive sample rate, got ${sampleRate}`);
  }
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(`encodePcm16Wav requires at least one channel, got ${channels}`);
  }
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const bytes = new Uint8Array(buffer);

  bytes.set(
    new Uint8Array(
      buildWavHeader({
        channels,
        sampleRate: Math.round(sampleRate),
        bitsPerSample: 16,
        dataBytes,
      }).buffer,
    ),
    0,
  );

  // The Int16Array and the target share the platform's byte order on every
  // engine we target, but copy explicitly so the file is little-endian by
  // construction rather than by accident.
  const view = new DataView(buffer);
  let offset = WAV_HEADER_BYTES;
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(offset, samples[index], true);
    offset += 2;
  }
  return buffer;
}

function closeQuietly(context: AudioContextLike): Promise<void> {
  try {
    return Promise.resolve(context.close()).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

/**
 * Decode a recorded blob and re-encode it as a genuine WAVE file.
 *
 * `createContext` is called at most once and the context is always closed
 * afterwards, so a rejected decode can never leak an AudioContext. Every
 * failure path returns a typed reason instead of throwing: when a container
 * cannot be decoded the caller keeps the recorder's own output and labels it
 * honestly instead of mislabelling it as WAV.
 */
export async function convertRecordingToWav(
  bytes: ArrayBuffer,
  createContext: () => AudioContextLike | null,
): Promise<WavConversion> {
  let context: AudioContextLike | null = null;
  try {
    context = createContext();
  } catch {
    context = null;
  }
  if (!context) {
    return { ok: false, reason: 'no-audio-context' };
  }

  try {
    const decoded = await context.decodeAudioData(bytes);
    if (
      !decoded ||
      decoded.numberOfChannels < 1 ||
      decoded.length < 1 ||
      !Number.isFinite(decoded.sampleRate) ||
      decoded.sampleRate <= 0
    ) {
      return { ok: false, reason: 'empty-audio' };
    }
    const channels: Float32Array[] = [];
    for (let index = 0; index < decoded.numberOfChannels; index += 1) {
      channels.push(decoded.getChannelData(index));
    }
    return {
      ok: true,
      blob: createWavBlob(encodePcmWav(channels, decoded.sampleRate)),
      sourceBytes: bytes.byteLength,
    };
  } catch {
    return { ok: false, reason: 'decode-failed' };
  } finally {
    await closeQuietly(context);
  }
}
