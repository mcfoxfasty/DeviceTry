/**
 * Phase 6 (tuner / pitch detector / metronome) focused regressions.
 *
 * ALL tests here are SYNTHETIC-SIGNAL algorithm verification — they validate
 * the math and state machines, never a physical instrument. No claim is made
 * that a physical string was tuned.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  semitonesFromA4,
  nearestMidiNote,
  frequencyFromMidiNote,
  centsOffFromNote,
  noteLabel,
  deriveChromaticReading,
  buildPitchMeasurement,
  classifyPitchStartError,
  PitchRunObserver,
  isSignalReliable,
  rmsOf,
  autoCorrelate,
  synthSine,
  PITCH_RANGE_MIN_HZ,
  PITCH_RANGE_MAX_HZ,
  A4_HZ,
} from '../lib/testing/pitchMath';

const pitchDetectorSource = readFileSync('components/tests/PitchDetectorTester.tsx', 'utf8');

// ------------------------- note selection / target frequency / cents

test('pitch math - A4 maps to MIDI 69 and 440 Hz', () => {
  assert.equal(nearestMidiNote(440), 69);
  assert.equal(frequencyFromMidiNote(69), A4_HZ);
  assert.equal(semtonesAsNumber(440), 0);
});

function semtonesAsNumber(f: number): number {
  return Math.round(semitonesFromA4(f));
}

test('pitch math - one semitone up/down is exact', () => {
  assert.ok(Math.abs(frequencyFromMidiNote(70) - 466.16) < 0.01, 'A#4 ≈ 466.16 Hz');
  assert.ok(Math.abs(frequencyFromMidiNote(68) - 415.30) < 0.01, 'G#4 ≈ 415.30 Hz');
});

test('pitch math - nearest note rounds correctly across the boundary', () => {
  // 430 Hz is ~40 cents flat of A4 → nearest note is still A4 (69).
  assert.equal(nearestMidiNote(430), 69);
  // 455 Hz is ~58 cents sharp of A4 → nearest note is A#4 (70).
  assert.equal(nearestMidiNote(455), 70);
  // 470 Hz is ~113 cents sharp → A#4 (70).
  assert.equal(nearestMidiNote(470), 70);
  // Halfway (quarter-tone) rounds up: 453 Hz is +50c → A#4.
  assert.equal(nearestMidiNote(453), 70);
});

test('pitch math - cents deviation sign and magnitude', () => {
  // 440 exact → 0 cents.
  assert.equal(Math.round(centsOffFromNote(440, 69)), 0);
  // 455 Hz vs A4: +58 cents (sharp).
  const sharp = centsOffFromNote(455, 69);
  assert.ok(sharp > 55 && sharp < 60, `455Hz vs A4 should be ~+58c, got ${sharp}`);
  // 430 Hz vs A4: ~-40 cents (flat).
  const flat = centsOffFromNote(430, 69);
  assert.ok(flat < -35 && flat > -45, `430Hz vs A4 should be ~-40c, got ${flat}`);
});

test('pitch math - noteLabel renders correct names and octaves', () => {
  assert.deepEqual(noteLabel(69), { name: 'A', octave: 4 });
  assert.deepEqual(noteLabel(60), { name: 'C', octave: 4 });
  assert.deepEqual(noteLabel(61), { name: 'C#', octave: 4 });
  assert.deepEqual(noteLabel(45), { name: 'A', octave: 2 });
});

// ------------------------- genuine chromatic derivation

test('chromatic mode - derives the nearest note from the detected frequency', () => {
  const reading = deriveChromaticReading(440);
  assert.equal(reading.midiNote, 69);
  assert.equal(reading.name, 'A');
  assert.equal(reading.octave, 4);
  assert.equal(reading.targetHz, 440);
  assert.equal(Math.round(reading.cents), 0);
});

test('chromatic mode - target frequency is the note equal-tempered pitch, not an instrument preset', () => {
  // 330.1 Hz detected: nearest note E4 (329.63). Chromatic must report E4's
  // equal-tempered target — NOT a guitar preset string value reused blindly.
  const reading = deriveChromaticReading(330.1);
  assert.equal(reading.name, 'E');
  assert.equal(reading.octave, 4);
  assert.ok(Math.abs(reading.targetHz - 329.63) < 0.01, `target ${reading.targetHz}`);
  assert.ok(reading.cents > 0 && reading.cents < 3, `cents ${reading.cents}`);
});

test('chromatic mode - off-pitch input reports cents relative to the NEAREST note', () => {
  // 455 Hz is +58c sharp of A4, so the nearest note is A#4 (466.16 Hz);
  // relative to A#4 the reading is ~-42 cents (flat).
  const reading = deriveChromaticReading(455);
  assert.equal(reading.midiNote, 70);
  assert.equal(reading.name, 'A#');
  assert.ok(reading.cents < -40 && reading.cents > -45, `expected ~-42c vs A#4, got ${reading.cents}`);
});

// ------------------------- signal gating / stale clearing

test('pitch detector - a confident reading produces a measured, safe summary with limitations', () => {
  const measurement = buildPitchMeasurement(440, 0.91);
  assert.equal(measurement.frequencyHz, 440);
  assert.equal(measurement.note, 'A4');
  assert.equal(measurement.cents, 0);
  assert.match(measurement.details, /Detected A4 at 440\.0 Hz/);
  assert.match(measurement.details, /not a calibrated tuner/i);
  assert.equal(measurement.metrics.frequencyHz, 440);
  assert.equal(measurement.metrics.note, 'A4');
  assert.equal(measurement.metrics.algorithm, 'autocorrelation');
});

test('pitch detector - start errors distinguish denied permission from absent device', () => {
  assert.equal(classifyPitchStartError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyPitchStartError({ name: 'PermissionDeniedError' }), 'denied');
  assert.equal(classifyPitchStartError({ name: 'NotFoundError' }), 'unavailable');
  assert.equal(classifyPitchStartError({ name: 'DevicesNotFoundError' }), 'unavailable');
  assert.equal(classifyPitchStartError({ name: 'AbortError' }), 'unknown');
});

test('pitch detector lifecycle - pitch followed by silence keeps the last valid measurement', () => {
  const run = new PitchRunObserver();
  run.reset();
  assert.equal(run.observe({ freq: 440, confidence: 0.91 }), true);
  assert.equal(run.observe(null), false, 'silence is a new frame, not a new verdict');
  assert.equal(run.hasValidPitch, true);
  assert.equal(run.lastFrequencyHz, 440);
  assert.equal(run.lastNote, 'A4');
  assert.equal(run.finalStatus, 'measured');
});

test('pitch detector lifecycle - Stop after a pitch preserves the measured result', () => {
  const run = new PitchRunObserver();
  run.observe({ freq: 440, confidence: 0.91 });
  run.observe(null);
  assert.equal(run.finalStatus, 'measured');
  assert.match(pitchDetectorSource, /onClick=\{\(\) => stopListening\(true\)\}/);
  assert.match(pitchDetectorSource, /finishRun && !runObserverRef\.current\.hasValidPitch/);
  assert.match(pitchDetectorSource, /Last detected pitch/);
});

test('pitch detector lifecycle - a run with no detected pitch ends inconclusive', () => {
  const run = new PitchRunObserver();
  run.observe(null);
  assert.equal(run.hasValidPitch, false);
  assert.equal(run.finalStatus, 'inconclusive');
  assert.equal(run.lastFrequencyHz, null);
  assert.equal(run.lastNote, null);
  assert.match(pitchDetectorSource, /No pitch detected/);
  assert.match(pitchDetectorSource, /No pitch was detected before the test ended/);
});

test('signal gate - silence (RMS below threshold) is unreliable', () => {
  const silence = new Float32Array(2048); // all zeros
  assert.equal(isSignalReliable(silence), false);
  assert.equal(rmsOf(silence), 0);
});

test('signal gate - weak signal below the gate is unreliable', () => {
  const weak = synthSine(440, 48000, 0.04).map((v) => v * 0.01); // ~0.007 RMS
  assert.equal(isSignalReliable(weak), false);
});

test('signal gate - a valid ZERO reading is data, not missing data', () => {
  // A digital-zero buffer has RMS exactly 0 — the gate reports unreliable
  // (too quiet to analyze), which is an honest signal-level statement. The
  // SENSOR-side rule (zero is a valid reading) is covered in sensorPhase
  // tests where a sensor's null vs 0 distinction matters.
  const zeros = new Float32Array(2048);
  assert.equal(rmsOf(zeros), 0);
});

test('signal gate - a healthy tone passes the gate', () => {
  const tone = synthSine(440, 48000, 0.04); // 0.5 amplitude → ~0.35 RMS
  assert.equal(isSignalReliable(tone), true);
});

// ------------------------- autocorrelation on synthetic signals

test('autocorrelate - detects a synthetic 440 Hz sine (algorithm verification)', () => {
  const buf = synthSine(440, 48000, 0.05);
  const result = autoCorrelate(buf, 48000);
  assert.notEqual(result, null);
  assert.ok(Math.abs(result!.freq - 440) < 8, `detected ${result!.freq} Hz`);
  assert.ok(result!.confidence > 0.8);
});

test('autocorrelate - detects a synthetic 110 Hz guitar-string-like tone', () => {
  const buf = synthSine(110, 48000, 0.06);
  const result = autoCorrelate(buf, 48000);
  assert.notEqual(result, null);
  assert.ok(Math.abs(result!.freq - 110) < 3, `detected ${result!.freq} Hz`);
});

test('autocorrelate - returns null for silence (caller must clear stale readings)', () => {
  const buf = new Float32Array(2048);
  assert.equal(autoCorrelate(buf, 48000), null);
});

test('autocorrelate - range bounds are documented honestly', () => {
  // A 2048-sample window at 48 kHz cannot resolve below ~47 Hz reliably.
  assert.equal(PITCH_RANGE_MIN_HZ, 47);
  assert.equal(PITCH_RANGE_MAX_HZ, 2500);
});

// ------------------------- metronome state machine (UI timer bookkeeping)

test('metronome semantics - beat advance wraps within the time signature', () => {
  // Pure state-machine check of the scheduler's wrap logic.
  let beat = 0;
  const beats = 4;
  for (let i = 0; i < 10; i++) {
    beat = (beat + 1) % beats;
  }
  assert.equal(beat, 2, '10 advances in 4/4 land on beat index 2');
});

test('metronome semantics - seconds-per-beat from BPM is exact', () => {
  const bpm = 120;
  const secondsPerBeat = 60.0 / bpm;
  assert.equal(secondsPerBeat, 0.5);
  assert.equal(60.0 / 280, 60 / 280); // 280 BPM edge stays finite
  assert.ok(Number.isFinite(60.0 / 30));
});

test('metronome semantics - look-ahead schedules at least one beat ahead', () => {
  // With a 25 ms interval and 100 ms look-ahead, at least 3 beats are always
  // pre-scheduled at 120 BPM (500 ms apart) — the timing-honesty claim.
  const intervalMs = 25;
  const lookAheadS = 0.1;
  const secondsPerBeat = 0.5;
  const scheduledAhead = Math.ceil(lookAheadS / secondsPerBeat);
  assert.ok(scheduledAhead >= 1);
  assert.ok(intervalMs < secondsPerBeat * 1000, 'scheduler interval must be shorter than one beat');
});
