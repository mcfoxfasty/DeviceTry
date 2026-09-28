/**
 * Direct-PCM capture regressions for the voice recorder.
 *
 * These cover lib/testing/pcmRecorder.ts, the module that replaced the
 * MediaRecorder + decode approach after Safari refused to decode the MP4 its
 * own recorder produced. The properties that matter for a real device:
 *
 * - Sample conversion is correct and clamped.
 * - The buffer is hard-capped, and overflow is counted rather than silently
 *   truncated or allowed to grow without limit.
 * - `toWav()` emits a genuine RIFF/WAVE file, and returns null (never an empty
 *   file) when nothing was captured.
 * - The capability probe names the exact missing API instead of guessing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PCM_MAX_RECORDING_SECONDS,
  PcmAccumulator,
  describeError,
  detectPcmCaptureSupport,
  floatToInt16,
} from '../lib/testing/pcmRecorder';

function asciiOf(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...Array.from(bytes.slice(offset, offset + length)));
}

// ------------------------------------------------------------ sample conversion

test('pcm - float samples convert to signed 16-bit with clamping', () => {
  assert.equal(floatToInt16(0), 0);
  assert.equal(floatToInt16(1), 0x7fff);
  assert.equal(floatToInt16(-1), -0x8000);
  assert.equal(floatToInt16(0.5), 0x4000);
  assert.equal(floatToInt16(-0.5), -0x4000);
  assert.equal(floatToInt16(4), 0x7fff, 'overshoot clamps');
  assert.equal(floatToInt16(-4), -0x8000);
  assert.equal(floatToInt16(Number.NaN), 0, 'NaN becomes silence, not a click');
  assert.equal(floatToInt16(Number.POSITIVE_INFINITY), 0);
});

test('pcm - the accumulator rejects an unusable sample rate or cap', () => {
  assert.throws(() => new PcmAccumulator(0), /positive sample rate/);
  assert.throws(() => new PcmAccumulator(Number.NaN), /positive sample rate/);
  assert.throws(() => new PcmAccumulator(48000, 0), /positive duration cap/);
});

// --------------------------------------------------------------- accumulation

test('pcm - appended blocks accumulate into frames', () => {
  const acc = new PcmAccumulator(1000);
  acc.append(new Float32Array(100));
  acc.append(new Float32Array(50));
  assert.equal(acc.frameCount, 150);
  assert.equal(acc.sampleRateHz, 1000);
  assert.equal(acc.durationSeconds, 0.15);
  assert.equal(acc.droppedFrames, 0);
  assert.equal(acc.isFull, false);
});

test('pcm - empty or absent blocks are ignored without changing state', () => {
  const acc = new PcmAccumulator(1000);
  acc.append(new Float32Array(0));
  acc.append(null);
  acc.append(undefined);
  assert.equal(acc.frameCount, 0);
});

test('pcm - the buffer is hard-capped and overflow is counted, not grown', () => {
  // 10 frames per second, so a 1-second cap is 10 frames.
  const acc = new PcmAccumulator(10, 1);
  assert.equal(acc.frameCount, 0);

  acc.append(new Float32Array(10).fill(1));
  assert.equal(acc.frameCount, 10);
  assert.equal(acc.isFull, true);
  assert.equal(acc.droppedFrames, 0);

  // Anything further is refused and counted — memory cannot keep growing.
  acc.append(new Float32Array(5).fill(1));
  assert.equal(acc.frameCount, 10, 'frame count never exceeds the cap');
  assert.equal(acc.droppedFrames, 5);
  assert.equal(acc.isFull, true);
});

test('pcm - a block straddling the cap is split, not dropped whole', () => {
  const acc = new PcmAccumulator(10, 1);
  acc.append(new Float32Array(7).fill(1));
  acc.append(new Float32Array(6).fill(1)); // only 3 fit
  assert.equal(acc.frameCount, 10);
  assert.equal(acc.droppedFrames, 3);
});

test('pcm - the default cap matches the five-minute recording limit', () => {
  const acc = new PcmAccumulator(48000);
  // 48 kHz * 300 s frames = 28.8 MB of Int16 PCM, which is the intended ceiling.
  assert.equal(PCM_MAX_RECORDING_SECONDS, 300);
  acc.append(new Float32Array(48000 * 300));
  assert.equal(acc.isFull, true);
  assert.equal(acc.frameCount, 48000 * 300);
  assert.equal(acc.estimatedByteLength, 44 + 48000 * 300 * 2);
});

test('pcm - reset releases the captured samples', () => {
  const acc = new PcmAccumulator(1000);
  acc.append(new Float32Array(20));
  acc.reset();
  assert.equal(acc.frameCount, 0);
  assert.equal(acc.droppedFrames, 0);
  assert.equal(acc.toWav(), null);
});

// ------------------------------------------------------------------- WAV output

test('pcm - toWav produces a genuine RIFF/WAVE file from captured PCM', () => {
  const acc = new PcmAccumulator(48000);
  acc.append(new Float32Array([0, 1, -1, 0.5]));

  const wav = acc.toWav();
  assert.notEqual(wav, null);
  const bytes = new Uint8Array(wav!);
  const view = new DataView(wav!);

  assert.equal(asciiOf(bytes, 0, 4), 'RIFF');
  assert.equal(asciiOf(bytes, 8, 4), 'WAVE');
  assert.equal(asciiOf(bytes, 12, 4), 'fmt ');
  assert.equal(asciiOf(bytes, 36, 4), 'data');

  assert.equal(view.getUint16(20, true), 1, 'linear PCM');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 8, '4 frames * 2 bytes');
  assert.equal(wav!.byteLength, 44 + 8);

  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 0x7fff);
  assert.equal(view.getInt16(48, true), -0x8000);
  assert.equal(view.getInt16(50, true), 0x4000);
});

test('pcm - samples from multiple blocks are written in capture order', () => {
  const acc = new PcmAccumulator(48000);
  acc.append(new Float32Array([1]));
  acc.append(new Float32Array([0]));
  acc.append(new Float32Array([-1]));

  const view = new DataView(acc.toWav()!);
  assert.equal(view.getInt16(44, true), 0x7fff);
  assert.equal(view.getInt16(46, true), 0);
  assert.equal(view.getInt16(48, true), -0x8000);
  assert.equal(acc.toPcm16().length, 3);
});

test('pcm - an empty capture yields null rather than an empty file', () => {
  // This is the guard that stops an empty recording being presented as success.
  assert.equal(new PcmAccumulator(48000).toWav(), null);
});

test('pcm - toPcm16 exposes the captured frames as Int16', () => {
  const acc = new PcmAccumulator(48000);
  acc.append(new Float32Array([1, -1]));
  const pcm = acc.toPcm16();
  assert.equal(pcm.length, 2);
  assert.equal(pcm[0], 0x7fff);
  assert.equal(pcm[1], -0x8000);
});

// ------------------------------------------------------- capability probing

const fullProto = {
  createMediaStreamSource: () => undefined,
  createScriptProcessor: () => undefined,
};

/** Build a fake AudioContext constructor whose prototype exposes `methods`. */
function fakeContextCtor(methods: Record<string, unknown>) {
  const Ctor = function Ctx() {} as unknown as { prototype: Record<string, unknown> };
  Ctor.prototype = methods;
  return Ctor;
}

test('pcm - a browser with full Web Audio is reported as supported', () => {
  const result = detectPcmCaptureSupport({ AudioContext: fakeContextCtor(fullProto) });
  assert.equal(result.supported, true);
  assert.equal(result.hasAudioContext, true);
  assert.equal(result.hasMediaStreamSource, true);
  assert.equal(result.hasScriptProcessor, true);
  assert.equal(result.detail, '', 'a supported browser has nothing to report');
});

test('pcm - the legacy webkitAudioContext spelling is accepted', () => {
  const result = detectPcmCaptureSupport({ webkitAudioContext: fakeContextCtor(fullProto) });
  assert.equal(result.supported, true);
  assert.equal(result.detail, '');
});

test('pcm - a browser without Web Audio names the missing API', () => {
  const result = detectPcmCaptureSupport({});
  assert.equal(result.supported, false);
  assert.equal(result.hasAudioContext, false);
  assert.match(result.detail, /window\.AudioContext/);
});

test('pcm - a missing createMediaStreamSource is named specifically', () => {
  const result = detectPcmCaptureSupport({
    AudioContext: fakeContextCtor({ createScriptProcessor: () => undefined }),
  });
  assert.equal(result.supported, false);
  assert.equal(result.hasAudioContext, true);
  assert.equal(result.hasMediaStreamSource, false);
  assert.match(result.detail, /createMediaStreamSource/);
});

test('pcm - a missing createScriptProcessor is named specifically', () => {
  const result = detectPcmCaptureSupport({
    AudioContext: fakeContextCtor({ createMediaStreamSource: () => undefined }),
  });
  assert.equal(result.supported, false);
  assert.equal(result.hasScriptProcessor, false);
  assert.match(result.detail, /createScriptProcessor/);
});

test('pcm - a null scope is reported rather than throwing', () => {
  assert.equal(detectPcmCaptureSupport(null).supported, false);
  assert.equal(detectPcmCaptureSupport(undefined).supported, false);
});

test('pcm - a non-callable AudioContext global is not treated as support', () => {
  const result = detectPcmCaptureSupport({ AudioContext: 'not a constructor' });
  assert.equal(result.supported, false);
  assert.equal(result.hasAudioContext, false);
});

// ------------------------------------------------------------- error reporting

test('pcm - describeError surfaces the real name and message', () => {
  const named = new Error('Unable to decode audio data');
  named.name = 'EncodingError';
  assert.equal(describeError(named), 'EncodingError: Unable to decode audio data');

  // A plain Error does not repeat the redundant "Error:" prefix.
  assert.equal(describeError(new Error('plain failure')), 'plain failure');
  assert.equal(describeError('a string failure'), 'a string failure');
  assert.equal(describeError({ code: 42 }), '{"code":42}');
  assert.equal(describeError(null), 'null');
  assert.equal(describeError(undefined), 'undefined');
});

test('pcm - describeError never hides a message behind an empty string', () => {
  const empty = new Error('');
  assert.equal(describeError(empty), 'no message');
});
