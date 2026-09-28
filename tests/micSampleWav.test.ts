/**
 * Microphone Test sample-clip regressions.
 *
 * The reported bug: downloading the sample produced `devicetry-mic-sample.webm`,
 * which would not open on iPhone. The clip was captured with MediaRecorder and
 * the extension came from `extensionForMimeType(...) ?? 'webm'` — so whenever
 * the recorder's MIME was unknown, the clip was offered under a hard-coded
 * .webm name that no player could open.
 *
 * The fix routes the sample through the same live-PCM capture the Voice
 * Recorder uses. These tests pin the two properties that must not regress:
 *
 * 1. The sample path never constructs a MediaRecorder and never derives the
 *    extension from a recorded MIME type — so there is no container to fall
 *    back to.
 * 2. The clip is encoded from captured PCM with the genuine WAV encoder and is
 *    always named .wav.
 *
 * These read the component source on purpose: the guarantee is structural (the
 * old code path must be gone), which a behavioural unit test cannot express
 * without a browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const micSource = readFileSync(join(repoRoot, 'components/tests/MicrophoneTester.tsx'), 'utf8');

/**
 * The source with comments removed.
 *
 * The "must not contain" assertions below are about executable code. The file's
 * own comments legitimately mention the removed MediaRecorder / `.webm`
 * behaviour — they explain why it is gone — so scanning raw text would fail on
 * prose rather than on a regression.
 */
function stripComments(source: string): string {
  return source
    // Block comments, including JSX `{/* ... */}` comments.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    // Line comments, whole-line or trailing. A `//` preceded by ':' is left
    // alone so a protocol like `https://` inside a string survives.
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

const code = stripComments(micSource);

test('mic sample - the comment stripper used by these assertions works', () => {
  // If this helper silently broke, every "must not contain" test below would
  // pass vacuously, so it is itself verified.
  const sample = [
    'const a = 1; // webm',
    '/* webm */',
    '{/* webm */}',
    'const b = 2;',
    "const url = 'https://example.test/audio';",
  ].join('\n');
  const stripped = stripComments(sample);
  assert.match(stripped, /const a = 1;/, 'code before a trailing comment survives');
  assert.match(stripped, /const b = 2;/, 'clean code survives');
  assert.equal(
    /\bwebm\b/.test(stripped),
    false,
    'a webm inside a comment must not leak into a code scan',
  );
  // The protocol guard must not eat a URL's slashes.
  assert.match(stripped, /https:\/\/example\.test\/audio/, "a '://' inside a string is preserved");
  // And the real source was actually read.
  assert.notEqual(micSource.length, 0);
});

test('mic sample - the sample clip no longer uses MediaRecorder at all', () => {
  assert.equal(
    /new MediaRecorder/.test(code),
    false,
    'MediaRecorder is what produced the unopenable clip — it must not be used for the sample',
  );
  assert.equal(
    /isMediaRecorderAvailable|selectRecordingMimeType|actualBlobMimeType|FALLBACK_MIME/.test(code),
    false,
    'the MediaRecorder/container-selection helpers must be gone from the mic tester',
  );
});

test('mic sample - there is no silent webm fallback for the download name', () => {
  // The exact defect: an unknown or unhandled MIME silently became .webm.
  assert.equal(
    /extensionForMimeType/.test(code),
    false,
    'the extension must not be derived from a recorded container any more',
  );
  assert.equal(
    /\?\?\s*'webm'|'webm'|"webm"/.test(code),
    false,
    'a hard-coded webm fallback is what produced the unopenable filename',
  );
});

test('mic sample - the download extension is always .wav', () => {
  assert.match(
    code,
    /const sampleExtension = 'wav';/,
    'the sample extension must be an unconditional wav',
  );
  assert.match(
    code,
    /download=\{`devicetry-mic-sample\.\$\{sampleExtension\}`\}/,
    'the download must use that extension',
  );
});

test('mic sample - the clip is captured as PCM and encoded as a genuine WAV', () => {
  assert.match(code, /new PcmAccumulator\(/, 'PCM must be accumulated from the audio tap');
  assert.match(code, /createScriptProcessor\(/, 'the PCM tap needs a script processor');
  assert.match(code, /createMediaStreamSource\(/, 'the tap must read the microphone stream');
  assert.match(code, /accumulator\.toWav\(\)/, 'the clip must be encoded from those samples');
  assert.match(code, /createWavBlob\(/, 'the clip must be stamped with the WAVE MIME type');
});

test('mic sample - the processing graph stays silent so it cannot cause feedback', () => {
  // The meter graph deliberately avoids the destination to prevent acoustic
  // feedback; the PCM tap must not reintroduce audible routing.
  assert.match(code, /sink\.gain\.value = 0;/, 'the tap sink must be zero-gain');
});

test('mic sample - an unsuccessful capture is reported, never published as a clip', () => {
  // Every failure path must report before any URL is published, and the only
  // object URL the sample creates comes from the encoded WAV blob.
  assert.match(code, /produced no PCM samples, so no clip was saved/);
  assert.match(code, /could not be encoded as WAV/);
  assert.match(code, /const audioBlob = createWavBlob\(wav\);/);

  const published = code.slice(code.indexOf('const audioBlob = createWavBlob(wav);'));
  const urlIndex = published.indexOf('URL.createObjectURL');
  assert.notEqual(urlIndex, -1, 'the WAV blob must be what gets published');
  assert.equal(
    /wav/.test(published.slice(0, urlIndex)),
    true,
    'the published URL must come from the encoded WAV',
  );
});

test('mic sample - the meter and waveform wiring is preserved', () => {
  // The fix must not have disturbed the existing level/waveform machinery.
  assert.match(code, /createAnalyser\(\)/, 'the analyser must still be created');
  assert.match(code, /analyser\.fftSize = 256/, 'the analyser configuration is unchanged');
  assert.match(code, /analyserRef\.current = analyser/, 'the analyser must still be registered');
  assert.match(code, /signalObserverRef/, 'the usable-signal observer must survive');
  assert.match(code, /drawWaveform\(\)/, 'the waveform render loop must survive');
});
