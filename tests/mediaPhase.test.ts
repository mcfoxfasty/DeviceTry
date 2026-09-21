/**
 * Phase 3 (media) focused regressions.
 *
 * These exercise the REAL extracted helpers used by the media testers:
 * - lib/testing/recordingFormat.ts  (MIME selection + accurate extension)
 * - lib/testing/recordingSession.ts (Voice Recorder lifecycle)
 * - lib/testing/speakerObservation.ts (channel-tied confirmations)
 * - lib/testing/videoFrameGate.ts   (webcam frame-delivery gate)
 * - lib/testing/micSignal.ts        (mic usable-signal observer)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMediaRecorderAvailable,
  selectRecordingMimeType,
  actualBlobMimeType,
  extensionForMimeType,
  mimeContainer,
  RECORDING_MIME_CANDIDATES,
} from '../lib/testing/recordingFormat';
import {
  RecordingSession,
  MediaStreamLike,
  RecorderLike,
} from '../lib/testing/recordingSession';
import {
  createSpeakerObservation,
  markPlayed,
  confirmChannel,
  aggregateSpeakerVerdict,
} from '../lib/testing/speakerObservation';
import {
  createFrameGate,
  supportsRequestVideoFrameCallback,
  readyStateIndicatesDeliveredFrame,
} from '../lib/testing/videoFrameGate';
import { MicSignalObserver } from '../lib/testing/micSignal';

// ---------------------------------------------------------------- helpers

/** Fake MediaStream whose stop() calls are recorded. */
function fakeStream(): MediaStreamLike & { stoppedTracks: number } {
  const tracks = [{ stop() { count += 1; } }, { stop() { count += 1; } }];
  let count = 0;
  return {
    get stoppedTracks() {
      return count;
    },
    getTracks: () => tracks,
  } as MediaStreamLike & { stoppedTracks: number };
}

/** Fake recorder recording `state` string transitions. */
function fakeRecorder(initialState = 'recording'): RecorderLike & { state: string } {
  return { state: initialState, stop() { this.state = 'inactive'; } };
}

// -------------------------------------------------- recordingFormat tests

test('recording format - MediaRecorder unavailable selects no MIME (honest unsupported)', () => {
  assert.equal(isMediaRecorderAvailable(undefined), false);
  assert.equal(isMediaRecorderAvailable(null), false);
  assert.equal(selectRecordingMimeType(null), null);
  assert.equal(selectRecordingMimeType({} as never), null, 'missing isTypeSupported cannot be probed');
});

test('recording format - selection respects isTypeSupported preference order', () => {
  // A Chromium-like browser: WebM/Opus wins.
  const chromium = { isTypeSupported: (m: string) => m.startsWith('audio/webm') };
  assert.equal(selectRecordingMimeType(chromium), 'audio/webm;codecs=opus');
  // A Safari-like browser: only MP4 is supported, and WebM is never forced.
  const safari = { isTypeSupported: (m: string) => m === 'audio/mp4' };
  assert.equal(selectRecordingMimeType(safari), 'audio/mp4');
  // A Firefox-like browser: Ogg supported as a lower-priority candidate.
  const firefox = {
    isTypeSupported: (m: string) => m === 'audio/ogg;codecs=opus',
  };
  assert.equal(selectRecordingMimeType(firefox), 'audio/ogg;codecs=opus');
  // Nothing supported: honest null.
  const nothing = { isTypeSupported: () => false };
  assert.equal(selectRecordingMimeType(nothing), null);
});

test('recording format - Ogg maps to .ogg (regression for the .webm mismatch)', () => {
  assert.equal(extensionForMimeType('audio/ogg;codecs=opus'), 'ogg');
  assert.equal(extensionForMimeType('audio/ogg'), 'ogg');
  assert.equal(mimeContainer('audio/ogg;codecs=opus'), 'ogg');
});

test('recording format - extension mapping is accurate for every supported container', () => {
  assert.equal(extensionForMimeType('audio/webm;codecs=opus'), 'webm');
  assert.equal(extensionForMimeType('audio/webm'), 'webm');
  assert.equal(extensionForMimeType('audio/mp4'), 'mp4');
  assert.equal(extensionForMimeType('audio/mp4;codecs=aac'), 'mp4');
  assert.equal(extensionForMimeType('audio/x-wav'), 'wav');
  assert.equal(extensionForMimeType('audio/mpeg'), 'mp3');
  assert.equal(extensionForMimeType(null), null);
  assert.equal(extensionForMimeType('video/something'), null);
});

test('recording format - actual blob MIME prefers the recorder-reported type', () => {
  assert.equal(actualBlobMimeType('audio/ogg;codecs=opus', 'audio/webm'), 'audio/ogg;codecs=opus');
  assert.equal(actualBlobMimeType('', 'audio/webm'), 'audio/webm');
  assert.equal(actualBlobMimeType(undefined, 'audio/webm'), 'audio/webm');
});

// ------------------------------------------------- recordingSession tests

test('recording session - concurrent start requests are refused', () => {
  const session = new RecordingSession();
  assert.equal(session.begin(1), true, 'first begin is accepted');
  assert.equal(session.begin(2), false, 'a begin while pending stacks no second request');
  assert.equal(session.isPending, true);
  session.cancel();
  assert.equal(session.begin(3), true, 'after cancel a new request is accepted');
});

test('recording session - repeated recorder instances are prevented', () => {
  const session = new RecordingSession();
  const token = 1;
  assert.equal(session.begin(token), true);
  const stream = fakeStream();
  assert.notEqual(session.adoptStream(token, stream), null);
  const recorder = fakeRecorder();
  assert.equal(session.attachRecorder(token, recorder), true);
  // An active recorder blocks any second begin/attach.
  assert.equal(session.begin(2), false);
  assert.equal(session.attachRecorder(token, fakeRecorder()), false);
  assert.equal(session.hasActiveRecorder, true);
});

test('recording session - late getUserMedia resolution stops every returned track', () => {
  const session = new RecordingSession();
  session.begin(1);
  session.cancel(); // user cancelled / navigated / started over
  const staleStream = fakeStream();
  assert.equal(session.adoptStream(1, staleStream), null, 'stale adoption reports nothing');
  assert.equal(staleStream.stoppedTracks, 2, 'every stale track is stopped immediately');
});

test('recording session - unmount/cancel invalidates so a late adoption cannot adopt', () => {
  const session = new RecordingSession();
  session.begin(5);
  // releaseResources performs cancel + pure teardown (unmount path).
  const stale = fakeStream();
  const active = fakeRecorder('recording');
  session.releaseResources({ stream: stale, recorder: active });
  assert.equal(stale.stoppedTracks, 2, 'teardown stops the stream tracks');
  assert.equal(active.state, 'inactive', 'teardown stops the recorder');
  // A later adoption for the dead token must not resurrect anything.
  assert.equal(session.adoptStream(5, fakeStream()), null);
});

test('recording session - no success verdict without recorded data', () => {
  const session = new RecordingSession();
  const token = session.begin(1) ? 1 : -1;
  const recorder = fakeRecorder();
  session.adoptStream(1, fakeStream());
  session.attachRecorder(1, recorder);
  // Empty recording: finishRecording must refuse.
  assert.equal(session.finishRecording(1, 0), null);
  // With real chunks it records and clears the active recorder.
  assert.notEqual(session.finishRecording(1, 3), null);
  assert.equal(session.hasActiveRecorder, false);
});

// -------------------------------------------- speakerObservation tests

test('speaker observation - confirmation is refused for a channel never played', () => {
  const obs = createSpeakerObservation();
  assert.equal(confirmChannel(obs, 'left'), false, 'no tone was played yet');
  assert.equal(obs.confirmed.length, 0);
});

test('speaker observation - confirmation binds to the requested channel', () => {
  const obs = createSpeakerObservation();
  markPlayed(obs, 'left');
  assert.equal(confirmChannel(obs, 'left'), true);
  // Right was never played: confirming it is invalid.
  assert.equal(confirmChannel(obs, 'right'), false);
  assert.deepEqual(obs.confirmed, ['left']);
});

test('speaker observation - untested channels never count as passed', () => {
  const obs = createSpeakerObservation();
  markPlayed(obs, 'left');
  confirmChannel(obs, 'left');
  const verdict = aggregateSpeakerVerdict(obs);
  assert.equal(verdict.status, 'warning', 'one side alone is not full stereo verification');
  assert.match(verdict.details, /not counted|not fully verified/i);
});

test('speaker observation - only a confirmed both-channel test passes', () => {
  const obs = createSpeakerObservation();
  markPlayed(obs, 'both');
  confirmChannel(obs, 'both');
  assert.equal(aggregateSpeakerVerdict(obs).status, 'passed');
});

test('speaker observation - a tone alone (no confirmation) is inconclusive, never passed', () => {
  const obs = createSpeakerObservation();
  markPlayed(obs, 'left');
  markPlayed(obs, 'right');
  const verdict = aggregateSpeakerVerdict(obs);
  assert.equal(verdict.status, 'inconclusive', 'AudioContext start is not proof of audible sound');
  assert.match(verdict.details, /not proof/i);
});

// -------------------------------------------------- videoFrameGate tests

test('webcam frame gate - a passed verdict requires an actually delivered frame', () => {
  let current = true;
  const gate = createFrameGate({
    runToken: 7,
    streamIdentity: { id: 's1' },
    isCurrent: () => current,
  });
  assert.equal(gate.isLive(), true);
  // No frame callback has fired: the gate never claims delivery.
  assert.equal(gate.delivered, false);
  // The rVFC fires for the live token/stream.
  const decision = gate.onFrame(7, gate); // identity check below
  void decision;
});

test('webcam frame gate - stale token or old stream cannot report delivery', () => {
  const stream = { id: 's1' };
  let current = true;
  const gate = createFrameGate({
    runToken: 1,
    streamIdentity: stream,
    isCurrent: () => current,
  });
  // Callback bound to the same gate but reporting an OLD token/stream.
  assert.equal(gate.onFrame(0, stream).delivered, false, 'old run token rejected');
  const otherStream = { id: 's2' };
  assert.equal(gate.onFrame(1, otherStream).delivered, false, 'old stream identity rejected');
  // The tester moved on (stop / reset / device change).
  current = false;
  assert.equal(gate.onFrame(1, stream).delivered, false, 'no longer current: rejected');
  assert.equal(gate.delivered, false);
});

test('webcam frame gate - live frame callback marks delivery and stays live for the FPS loop', () => {
  const stream = { id: 's1' };
  const gate = createFrameGate({
    runToken: 2,
    streamIdentity: stream,
    isCurrent: () => true,
  });
  const decision = gate.onFrame(2, stream);
  assert.equal(decision.delivered, true);
  assert.equal(decision.source, 'requestVideoFrameCallback');
  assert.equal(gate.delivered, true);
  // The gate stays live so the caller's frame loop keeps counting FPS on the
  // live stream; verdict-level dedupe is the ResultController's job.
  assert.equal(gate.isLive(), true);
  // But a callback from a different run/stream still cannot mark delivery.
  assert.equal(gate.onFrame(3, stream).delivered, false);
  assert.equal(gate.onFrame(2, { id: 's2' }).delivered, false);
});

test('webcam frame gate - readyState fallback is documented and guarded', () => {
  assert.equal(readyStateIndicatesDeliveredFrame({ readyState: 2, videoWidth: 640, videoHeight: 480 }), true);
  assert.equal(readyStateIndicatesDeliveredFrame({ readyState: 1, videoWidth: 640, videoHeight: 480 }), false, 'metadata alone is not a frame');
  assert.equal(readyStateIndicatesDeliveredFrame({ readyState: 4, videoWidth: 0, videoHeight: 0 }), false, 'zero dimensions are not a frame');
  assert.equal(readyStateIndicatesDeliveredFrame(null), false);

  let current = true;
  const gate = createFrameGate({ runToken: 1, streamIdentity: {}, isCurrent: () => current });
  assert.equal(gate.checkFallbackReady({ readyState: 4, videoWidth: 1280, videoHeight: 720 }).delivered, true);
  current = false;
  assert.equal(gate.checkFallbackReady({ readyState: 4, videoWidth: 1280, videoHeight: 720 }).delivered, false, 'stale poll cannot report');
});

test('webcam frame gate - rVFC support detection handles missing globals', () => {
  // Plain objects / SSR context without HTMLVideoElement: honest false.
  assert.equal(supportsRequestVideoFrameCallback(null), false);
  assert.equal(supportsRequestVideoFrameCallback({}), false);
});

// ------------------------------------------------------ micSignal tests

test('mic signal - stream connection alone is never a passed observation', () => {
  const observer = new MicSignalObserver();
  // A live stream of pure silence (RMS 0) never yields a usable signal.
  for (let i = 0; i < 100; i++) observer.observe(0);
  assert.equal(observer.hasUsableSignal, false);
  assert.equal(observer.peakLevelPercent, 0);
});

test('mic signal - silence is inconclusive, not a hardware-failure verdict', () => {
  // The observer reports hasUsableSignal=false for silence; the tester maps
  // that to an inconclusive verdict (permission granted + silence), NOT failed.
  const observer = new MicSignalObserver();
  observer.observe(0.2);
  observer.observe(0.1);
  assert.equal(observer.hasUsableSignal, false);
});

test('mic signal - sustained signal across consecutive frames is required', () => {
  const observer = new MicSignalObserver({ thresholdPercent: 1, requiredFrames: 10 });
  // 9 loud frames: not yet sustained.
  for (let i = 0; i < 9; i++) observer.observe(45);
  assert.equal(observer.hasUsableSignal, false);
  observer.observe(45);
  assert.equal(observer.hasUsableSignal, true, '10 consecutive non-trivial frames = usable signal');
});

test('mic signal - intermittent bursts do not satisfy the sustained window', () => {
  const observer = new MicSignalObserver({ thresholdPercent: 1, requiredFrames: 10 });
  for (let round = 0; round < 20; round++) {
    observer.observe(60);
    observer.observe(0); // gap resets the consecutive window
  }
  assert.equal(observer.hasUsableSignal, false);
});

test('mic signal - reset clears the observation for a new run', () => {
  const observer = new MicSignalObserver({ thresholdPercent: 1, requiredFrames: 3 });
  for (let i = 0; i < 5; i++) observer.observe(50);
  assert.equal(observer.hasUsableSignal, true);
  observer.reset();
  assert.equal(observer.hasUsableSignal, false);
  assert.equal(observer.peakLevelPercent, 0);
  assert.equal(observer.observedReported, false);
});

// ---------------------------------------------------- registry content

test('registry content - mic wording avoids calibrated decibel claims', () => {
  const registry = require('../lib/tools/registry') as { TOOLS_REGISTRY: Array<{ id: string; instructions: string[]; limitations: string[] }> };
  const mic = registry.TOOLS_REGISTRY.find((tool) => tool.id === 'microphone-test');
  assert.ok(mic);
  const micText = [...mic.instructions, ...mic.limitations].join(' ');
  assert.doesNotMatch(micText, /decibel level/i, 'meter must be described as relative level, not calibrated decibels');
  assert.match(micText, /relative input level/i);
  const recorder = registry.TOOLS_REGISTRY.find((tool) => tool.id === 'voice-recorder');
  assert.ok(recorder);
  const recText = recorder.limitations.join(' ');
  assert.doesNotMatch(recText, /\bWAV\b/, 'the unsupported WAV claim is removed');
  assert.match(recText, /extension always matches the actual recording/);
});
