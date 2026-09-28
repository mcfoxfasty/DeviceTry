/**
 * WAV export regressions for the voice recorder.
 *
 * These cover lib/testing/wavEncoder.ts, the module that turns whatever
 * MediaRecorder captured (an `audio/mp4` blob on iOS Safari, which Safari
 * refuses to play) into a genuine 16-bit PCM RIFF/WAVE file for both inline
 * playback and download.
 *
 * The properties that matter:
 * - The bytes really are a RIFF/WAVE file with a correct 44-byte header.
 * - Samples are interleaved, little-endian, signed 16-bit, and clamped.
 * - A container that cannot be decoded is reported honestly and NEVER
 *   relabelled as .wav — that would be renaming, not converting.
 * - The AudioContext is always closed, including on failure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWavHeader,
  convertRecordingToWav,
  createWavBlob,
  encodePcm16Wav,
  encodePcmWav,
  floatToPcm16,
  isWavContainer,
  resolveAudioContextConstructor,
  WAV_MIME_TYPE,
  type AudioContextLike,
  type DecodedAudioLike,
} from '../lib/testing/wavEncoder';

const SR = 48000;

function asciiOf(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...Array.from(bytes.slice(offset, offset + length)));
}

function fakeAudioBuffer(
  channels: Float32Array[],
  sampleRate = SR,
): DecodedAudioLike {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0]?.length ?? 0,
    getChannelData: (channel: number) => channels[channel],
  };
}

/** A context whose decodeAudioData resolves with `decoded`. */
function contextReturning(
  decoded: DecodedAudioLike,
  log: { closed: number },
): AudioContextLike {
  return {
    async decodeAudioData() {
      return decoded;
    },
    close() {
      log.closed += 1;
    },
  };
}

// ------------------------------------------------------------- header bytes

test('wav - the written file is a real RIFF/WAVE container, not a renamed blob', () => {
  const wav = encodePcmWav([new Float32Array([0, 0.5, -0.5, 1])], SR);
  const bytes = new Uint8Array(wav);

  assert.equal(asciiOf(bytes, 0, 4), 'RIFF');
  assert.equal(asciiOf(bytes, 8, 4), 'WAVE');
  assert.equal(asciiOf(bytes, 12, 4), 'fmt ');
  assert.equal(asciiOf(bytes, 36, 4), 'data');
});

test('wav - the header declares 16-bit linear PCM with correct sizes', () => {
  const frames = 100;
  const channels = [new Float32Array(frames), new Float32Array(frames)];
  const wav = encodePcmWav(channels, SR);
  const view = new DataView(wav);
  const dataBytes = frames * 2 * 2; // frames * channels * 2 bytes

  assert.equal(view.getUint16(20, true), 1, 'audioFormat 1 = linear PCM');
  assert.equal(view.getUint16(22, true), 2, 'channel count');
  assert.equal(view.getUint32(24, true), SR, 'sample rate');
  assert.equal(view.getUint16(34, true), 16, 'bits per sample');
  assert.equal(view.getUint16(32, true), 4, 'block align = channels * bytes/sample');
  assert.equal(view.getUint32(28, true), SR * 4, 'byte rate = sample rate * block align');
  assert.equal(view.getUint32(40, true), dataBytes, 'data chunk size');
  // RIFF size counts everything after the first 8 bytes.
  assert.equal(view.getUint32(4, true), 36 + dataBytes);
  assert.equal(wav.byteLength, 44 + dataBytes, 'file is exactly header + data');
});

test('wav - samples are interleaved little-endian signed 16-bit', () => {
  const left = new Float32Array([1, -1]);
  const right = new Float32Array([0.5, -0.5]);
  const view = new DataView(encodePcmWav([left, right], SR));

  // frame 0: left then right, frame 1: left then right.
  assert.equal(view.getInt16(44, true), 0x7fff);
  assert.equal(view.getInt16(46, true), 0x4000);
  assert.equal(view.getInt16(48, true), -0x8000);
  assert.equal(view.getInt16(50, true), -0x4000);
});

test('wav - out-of-range samples are clamped instead of wrapping', () => {
  const view = new DataView(encodePcmWav([new Float32Array([2, -2, 9, -9])], SR));
  assert.equal(view.getInt16(44, true), 0x7fff, 'positive overshoot clamps to max');
  assert.equal(view.getInt16(46, true), -0x8000, 'negative overshoot clamps to min');
});

test('wav - floatToPcm16 handles silence, non-finite input, and range', () => {
  assert.equal(floatToPcm16(0), 0);
  assert.equal(floatToPcm16(1), 0x7fff);
  assert.equal(floatToPcm16(-1), -0x8000);
  assert.equal(floatToPcm16(0.5), 0x4000);
  assert.equal(floatToPcm16(2), 0x7fff, 'finite overshoot clamps, it does not wrap');
  assert.equal(floatToPcm16(-2), -0x8000);
  // Non-finite input becomes silence rather than full scale: a corrupt decode
  // should not punch a full-scale click into the recording.
  assert.equal(floatToPcm16(Number.NaN), 0, 'NaN must not corrupt the file');
  assert.equal(floatToPcm16(Number.POSITIVE_INFINITY), 0);
  assert.equal(floatToPcm16(Number.NEGATIVE_INFINITY), 0);
});

test('wav - mismatched channel lengths truncate to the shortest', () => {
  const long = new Float32Array(10).fill(1);
  const short = new Float32Array(4).fill(-1);
  const wav = encodePcmWav([long, short], SR);
  // 4 frames * 2 channels * 2 bytes + 44-byte header.
  assert.equal(wav.byteLength, 44 + 4 * 2 * 2);
});

test('wav - encoding rejects impossible inputs rather than writing a broken file', () => {
  assert.throws(() => encodePcmWav([], SR), /at least one channel/);
  assert.throws(() => encodePcmWav([new Float32Array(4)], 0), /positive sample rate/);
  assert.throws(() => encodePcmWav([new Float32Array(4)], Number.NaN), /positive sample rate/);
});

// ----------------------------------------------- direct 16-bit PCM encoding
//
// This is the path the recorder now uses on Stop: samples captured live from
// the microphone, written straight out with no decode step. It is the reason
// the tool no longer depends on Safari decoding its own MediaRecorder output.

test('wav - 16-bit PCM samples encode directly into a genuine WAVE file', () => {
  const pcm = new Int16Array([0, 0x7fff, -0x8000, 0x4000]);
  const wav = encodePcm16Wav(pcm, 48000);
  const bytes = new Uint8Array(wav);
  const view = new DataView(wav);

  assert.equal(asciiOf(bytes, 0, 4), 'RIFF');
  assert.equal(asciiOf(bytes, 8, 4), 'WAVE');
  assert.equal(asciiOf(bytes, 36, 4), 'data');
  assert.equal(view.getUint16(20, true), 1, 'linear PCM');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(wav.byteLength, 44 + 8);
});

test('wav - 16-bit PCM values pass through unmodified', () => {
  const pcm = new Int16Array([1234, -1234, 32767, -32768]);
  const view = new DataView(encodePcm16Wav(pcm, 8000));
  assert.equal(view.getInt16(44, true), 1234);
  assert.equal(view.getInt16(46, true), -1234);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(view.getInt16(50, true), -32768);
});

test('wav - 16-bit PCM encoding rejects an impossible sample rate', () => {
  assert.throws(() => encodePcm16Wav(new Int16Array(4), 0), /positive sample rate/);
  assert.throws(() => encodePcm16Wav(new Int16Array(4), Number.NaN), /positive sample rate/);
  assert.throws(() => encodePcm16Wav(new Int16Array(4), 44100, 0), /at least one channel/);
});

test('wav - an empty PCM capture still yields a valid, if silent, header', () => {
  // The recorder guards against publishing this; the encoder itself stays
  // honest and writes a structurally valid empty file rather than garbage.
  const wav = encodePcm16Wav(new Int16Array(0), 48000);
  assert.equal(wav.byteLength, 44);
  assert.equal(new DataView(wav).getUint32(40, true), 0);
});

test('wav - a blob built from the direct PCM path is playable-typed', async () => {
  const blob = createWavBlob(encodePcm16Wav(new Int16Array([1, 2, 3]), 48000));
  assert.equal(blob.type, WAV_MIME_TYPE);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(asciiOf(bytes, 0, 4), 'RIFF');
  assert.equal(bytes.byteLength, 44 + 6);
});

test('wav - the blob is stamped with the canonical WAVE MIME type', async () => {
  const blob = createWavBlob(encodePcmWav([new Float32Array([0.1])], SR));
  assert.equal(blob.type, WAV_MIME_TYPE);
  const header = new Uint8Array(await blob.arrayBuffer());
  assert.equal(asciiOf(header, 0, 4), 'RIFF');
});

test('wav - header helper reports the sizes it was given', () => {
  const view = buildWavHeader({
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    dataBytes: 8,
  });
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getUint32(4, true), 44);
});

// ------------------------------------------------------- container detection

test('wav - already-WAVE containers are detected so nothing is re-encoded', () => {
  assert.equal(isWavContainer('audio/wav'), true);
  assert.equal(isWavContainer('audio/x-wav'), true);
  assert.equal(isWavContainer('audio/wave'), true);
  assert.equal(isWavContainer('AUDIO/WAV;codecs=1'), true);
});

test('wav - the compressed containers MediaRecorder actually emits are not WAV', () => {
  // These are the iOS Safari / Chromium / Firefox cases the conversion exists for.
  assert.equal(isWavContainer('audio/mp4'), false);
  assert.equal(isWavContainer('audio/mp4;codecs=aac'), false);
  assert.equal(isWavContainer('audio/webm;codecs=opus'), false);
  assert.equal(isWavContainer('audio/ogg;codecs=opus'), false);
  assert.equal(isWavContainer(null), false);
  assert.equal(isWavContainer(undefined), false);
});

test('wav - the Web Audio constructor is resolved from either spelling', () => {
  class Ctx {}
  class WebkitCtx {}
  assert.equal(resolveAudioContextConstructor({ AudioContext: Ctx }), Ctx);
  assert.equal(resolveAudioContextConstructor({ webkitAudioContext: WebkitCtx }), WebkitCtx);
  // Standard spelling wins when both are present.
  assert.equal(
    resolveAudioContextConstructor({ AudioContext: Ctx, webkitAudioContext: WebkitCtx }),
    Ctx,
  );
  assert.equal(resolveAudioContextConstructor({}), null, 'no Web Audio support');
  assert.equal(resolveAudioContextConstructor(null), null);
  assert.equal(resolveAudioContextConstructor(undefined), null);
  assert.equal(
    resolveAudioContextConstructor({ AudioContext: 'not a function' }),
    null,
    'a non-callable global must not be treated as support',
  );
});

// ------------------------------------------------------------- conversion

test('wav - a recorded mp4-style blob converts to a genuine playable WAVE', async () => {
  const log = { closed: 0 };
  const decoded = fakeAudioBuffer([new Float32Array([0, 1, -1, 0.25])], SR);
  const bytes = new ArrayBuffer(128);

  const result = await convertRecordingToWav(bytes, () => contextReturning(decoded, log));

  assert.equal(result.ok, true);
  assert.equal(log.closed, 1, 'the AudioContext is always closed');
  if (!result.ok) return;
  assert.equal(result.blob.type, WAV_MIME_TYPE);
  assert.equal(result.sourceBytes, 128);

  const written = new Uint8Array(await result.blob.arrayBuffer());
  assert.equal(asciiOf(written, 0, 4), 'RIFF');
  assert.equal(asciiOf(written, 8, 4), 'WAVE');
  // 4 frames * 1 channel * 2 bytes + 44 header.
  assert.equal(written.byteLength, 44 + 4 * 2);
  const view = new DataView(written.buffer);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 0x7fff);
  assert.equal(view.getInt16(48, true), -0x8000);
});

test('wav - every decoded channel is written, not just the first', async () => {
  const log = { closed: 0 };
  const decoded = fakeAudioBuffer([new Float32Array([1, 1]), new Float32Array([-1, -1])], SR);

  const result = await convertRecordingToWav(new ArrayBuffer(8), () => contextReturning(decoded, log));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const view = new DataView(await result.blob.arrayBuffer());
  assert.equal(view.getUint16(22, true), 2, 'both channels are declared');
  assert.equal(view.getInt16(44, true), 0x7fff, 'frame 0 left');
  assert.equal(view.getInt16(46, true), -0x8000, 'frame 0 right');
  assert.equal(view.getInt16(48, true), 0x7fff, 'frame 1 left');
  assert.equal(view.getInt16(50, true), -0x8000, 'frame 1 right');
});

test('wav - the recorder sample rate is preserved, not hard-coded', async () => {
  const log = { closed: 0 };
  const decoded = fakeAudioBuffer([new Float32Array([0])], 44100);

  const result = await convertRecordingToWav(new ArrayBuffer(8), () => contextReturning(decoded, log));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const view = new DataView(await result.blob.arrayBuffer());
  assert.equal(view.getUint32(24, true), 44100);
});

test('wav - an undecodable container fails honestly and is never relabelled .wav', async () => {
  const log = { closed: 0 };
  const result = await convertRecordingToWav(new ArrayBuffer(8), () => ({
    async decodeAudioData() {
      throw new Error('Unable to decode audio data');
    },
    close() {
      log.closed += 1;
    },
  }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'decode-failed');
  // The failure carries no blob at all, so the caller cannot accidentally
  // attach a .wav name to the original container.
  assert.equal('blob' in result, false);
  assert.equal(log.closed, 1, 'a failed decode must not leak the context');
});

test('wav - empty or malformed decoded audio is rejected', async () => {
  const log = { closed: 0 };
  const noChannels = await convertRecordingToWav(new ArrayBuffer(8), () =>
    contextReturning(fakeAudioBuffer([]), log),
  );
  assert.equal(noChannels.ok, false);
  if (!noChannels.ok) assert.equal(noChannels.reason, 'empty-audio');

  const noFrames = await convertRecordingToWav(new ArrayBuffer(8), () =>
    contextReturning(fakeAudioBuffer([new Float32Array(0)]), log),
  );
  assert.equal(noFrames.ok, false);
  if (!noFrames.ok) assert.equal(noFrames.reason, 'empty-audio');

  const badRate = await convertRecordingToWav(new ArrayBuffer(8), () =>
    contextReturning({ ...fakeAudioBuffer([new Float32Array([0])]), sampleRate: 0 }, log),
  );
  assert.equal(badRate.ok, false);
  if (!badRate.ok) assert.equal(badRate.reason, 'empty-audio');
});

test('wav - a browser without Web Audio is reported, not thrown', async () => {
  const result = await convertRecordingToWav(new ArrayBuffer(8), () => null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'no-audio-context');
});

test('wav - a throwing context factory is reported, not propagated', async () => {
  const result = await convertRecordingToWav(new ArrayBuffer(8), () => {
    throw new Error('Web Audio blocked by policy');
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'no-audio-context');
});

test('wav - a context that throws on close does not fail a successful conversion', async () => {
  const decoded = fakeAudioBuffer([new Float32Array([0, 0.5])], SR);
  const result = await convertRecordingToWav(new ArrayBuffer(8), () => ({
    async decodeAudioData() {
      return decoded;
    },
    close() {
      throw new Error('already closed');
    },
  }));
  assert.equal(result.ok, true, 'the WAV is still produced');
  if (!result.ok) return;
  assert.equal(result.blob.type, WAV_MIME_TYPE);
});
