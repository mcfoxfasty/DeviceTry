/**
 * Codec probe regressions.
 *
 * The old tester emitted `passed` unconditionally — including for a run in
 * which every probe answered "no". These tests pin the corrected verdicts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYBACK_SPECS,
  RECORDING_SPECS,
  probeCodecSupport,
  summarizeCodecProbe,
} from '../lib/testing/codecProbe';

const recorderAll = (answer: boolean | 'throw') => ({
  isTypeSupported: () => {
    if (answer === 'throw') throw new Error('SecurityError in isTypeSupported');
    return answer;
  },
});

const element = (verdict: string | 'throw') => ({
  canPlayType: () => {
    if (verdict === 'throw') throw new Error('InvalidStateError');
    return verdict;
  },
});

test('codec probe - every row is bound to the media element matching its kind', () => {
  const seen: { element: string; mime: string }[] = [];
  const videoElement = { canPlayType: (mime: string) => (seen.push({ element: 'video', mime }), 'probably') };
  const audioElement = { canPlayType: (mime: string) => (seen.push({ element: 'audio', mime }), 'probably') };
  const report = probeCodecSupport({ recorder: recorderAll(true), videoElement, audioElement });

  for (const call of seen) {
    const isAudioMime = call.mime.startsWith('audio');
    assert.equal(
      call.element,
      isAudioMime ? 'audio' : 'video',
      `an ${isAudioMime ? 'audio' : 'video'} mime must never be asked of the other element: ${call.mime}`
    );
  }
  assert.equal(seen.length, PLAYBACK_SPECS.length);
  assert.equal(report.rows.length, RECORDING_SPECS.length + PLAYBACK_SPECS.length);
});

test('codec probe - zero positive results is inconclusive, never passed', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(false),
    videoElement: element(''),
    audioElement: element(''),
  });
  const summary = summarizeCodecProbe(report);

  assert.equal(report.supportedCount, 0);
  assert.notEqual(summary.status, 'passed');
  assert.equal(summary.status, 'inconclusive');
  assert.match(summary.details, /no format came back positively supported \(0\/\d+\)/);
  assert.match(summary.details, /not a fault in the browser/);
});

test('codec probe - maybe results stay uncertain rather than becoming a negative', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(false),
    videoElement: element('maybe'),
    audioElement: element('maybe'),
  });
  const summary = summarizeCodecProbe(report);

  assert.equal(report.maybeCount, PLAYBACK_SPECS.length);
  assert.equal(report.unsupportedCount, RECORDING_SPECS.length);
  assert.match(summary.details, /answered "maybe", which is uncertain rather than negative/);
  assert.notEqual(summary.status, 'passed');
});

test('codec probe - probably and maybe are preserved verbatim, with the raw answer', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(true),
    videoElement: element('probably'),
    audioElement: element('maybe'),
  });
  const probably = report.rows.find((row) => row.mime === 'video/mp4; codecs="avc1.42E01E"')!;
  const maybe = report.rows.find((row) => row.mime === 'audio/mpeg')!;
  assert.equal(probably.result, 'supported');
  assert.equal(probably.raw, 'probably');
  assert.equal(maybe.result, 'maybe');
  assert.equal(maybe.raw, 'maybe');
});

test('codec probe - a missing API is unavailable, distinct from a negative answer', () => {
  const report = probeCodecSupport({ recorder: undefined, videoElement: null, audioElement: null });
  assert.equal(report.recorderAvailable, false);
  assert.equal(report.unavailableCount, RECORDING_SPECS.length + PLAYBACK_SPECS.length);
  assert.equal(report.unsupportedCount, 0, 'an unavailable API is never recorded as an unsupported format');

  const summary = summarizeCodecProbe(report);
  assert.equal(summary.status, 'unsupported');
  assert.match(summary.details, /no codec information could be gathered/i);
  assert.match(summary.details, /says nothing about what the browser can actually record or play/);
});

test('codec probe - one unavailable API does not blank the other table', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(true),
    videoElement: null,
    audioElement: element('probably'),
  });
  assert.equal(report.recorderAvailable, true);
  assert.equal(report.unavailableCount, PLAYBACK_SPECS.filter((spec) => spec.kind === 'video').length);
  assert.ok(report.rows.some((row) => row.kind === 'recording' && row.result === 'supported'));
  assert.ok(report.rows.some((row) => row.kind === 'audio' && row.result === 'supported'));
});

test('codec probe - a probe that throws is an error row, never a silent negative', () => {
  const report = probeCodecSupport({
    recorder: recorderAll('throw'),
    videoElement: element('throw'),
    audioElement: element('throw'),
  });
  assert.equal(report.errorCount, RECORDING_SPECS.length + PLAYBACK_SPECS.length);
  assert.equal(report.unsupportedCount, 0, 'a thrown probe must not be counted as a genuine "no"');
  const row = report.rows[0];
  assert.equal(row.result, 'error');
  assert.match(row.method, /threw/);
});

test('codec probe - the strongest honest verdict is measured, and it says what it is not', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(true),
    videoElement: element('probably'),
    audioElement: element('probably'),
  });
  const summary = summarizeCodecProbe(report);
  assert.equal(summary.status, 'measured');
  assert.notEqual(summary.status, 'passed');
  assert.match(summary.details, /not evidence of recording, decoding, hardware acceleration, or a working WebRTC call/i);
});

test('codec probe - metrics are counts only, never payload or codec claims', () => {
  const report = probeCodecSupport({
    recorder: recorderAll(true),
    videoElement: element('probably'),
    audioElement: element('probably'),
  });
  const { metrics } = summarizeCodecProbe(report);
  for (const [key, value] of Object.entries(metrics)) {
    assert.match(key, /^[a-zA-Z]+$/, `metric key ${key} must be a plain name`);
    assert.ok(['number', 'boolean'].includes(typeof value), `metric ${key} must be numeric or boolean`);
  }
});
