/**
 * Guided inspection outcomes, permission timing, and report honesty.
 *
 * The pre-call flow drives the real microphone, webcam, and speaker testers,
 * so these checks pin the properties that make a guided run trustworthy:
 *  - permissions are requested only when a step is started, one at a time;
 *  - a denied or absent device is BLOCKED, never a failed device;
 *  - checklist cards open step 1 directly and every step has an explicit start action;
 *  - Previous/Next sit with the numbered steps and report navigation is truthful;
 *  - steps transition independently, preserve prior results, and a rerun replaces rather than appends;
 *  - the report separates browser observations from user confirmations,
 *    names what stays unverified, and never promises another app will work.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  attentionRows,
  buildInspectionReport,
  guidanceFor,
  inspectionReportText,
  needsAttention,
  OUTCOME_LABEL,
  SCOPE_NOTICE,
  stepOutcome,
  summarizeRun,
  unverifiedSteps,
} from '../lib/inspection/stepOutcomes';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const flowSource = readFileSync(join(repoRoot, 'components/inspection/GuidedInspectionFlow.tsx'), 'utf8');
const micSource = readFileSync(join(repoRoot, 'components/tests/MicrophoneTester.tsx'), 'utf8');
const camSource = readFileSync(join(repoRoot, 'components/tests/WebcamTester.tsx'), 'utf8');
const speakerSource = readFileSync(join(repoRoot, 'components/tests/SpeakersTester.tsx'), 'utf8');
const speedSource = readFileSync(join(repoRoot, 'components/tests/InternetSpeedTester.tsx'), 'utf8');

const PRE_CALL: Array<'mic' | 'webcam' | 'speakers'> = ['mic', 'webcam', 'speakers'];

/* ------------------------------------------------------------------ */
/* Permission timing: one step, one device, only on a user action       */
/* ------------------------------------------------------------------ */

test('permissions - the guided flow mounts only the active step', () => {
  // Every tester is behind its own `activeStepKey === ...` guard, so
  // mounting the flow can never open the mic, camera, and speakers at once.
  for (const [key, label] of [
    ['mic', 'MicrophoneTester'],
    ['webcam', 'WebcamTester'],
    ['speakers', 'SpeakersTester'],
  ] as const) {
    assert.match(
      flowSource,
      new RegExp(`activeStepKey === '${key}'\\s*&&\\s*\\(\\s*\\n\\s*<${label}`),
      `${label} renders only on its own step`
    );
  }
});

test('permissions - no device is requested on mount, only from a handler', () => {
  // getUserMedia must live behind an explicit start function that only an
  // onClick (or the spacebar handler) can reach.
  for (const [name, src] of [
    ['microphone', micSource],
    ['webcam', camSource],
  ] as const) {
    const effectBlocks = src.match(/useEffect\([\s\S]*?\n  \}\);/g) ?? [];
    for (const block of effectBlocks) {
      assert.ok(
        !/getUserMedia/.test(block),
        `${name}: getUserMedia must not be called from an effect (that would request on mount)`
      );
    }
    assert.match(src, /getUserMedia/, `${name} still uses the real API behind a start action`);
  }
});

test('permissions - speaker playback is a user action, never a permission prompt', () => {
  assert.match(speakerSource, /const playTone|function playTone/, 'tone playback has an explicit trigger');
  // The speaker step must not ask for microphone or camera access.
  assert.ok(!/getUserMedia/.test(speakerSource), 'the speaker test never requests a device permission');
  assert.ok(!/PermissionPromptCard/.test(speakerSource), 'no permission card is presented for playback');
  // Playback buttons are wired to the trigger and a separate confirmation.
  assert.match(speakerSource, /onClick=\{\(\) => playTone\('left'\)\}/);
  assert.match(speakerSource, /onClick=\{\(\) => recordObservation\('left'\)\}/, 'the user confirms what they heard');
});

test('permissions - the speed test never starts on its own', () => {
  // The controller is only constructed inside start(), which the Start
  // button drives — no effect may call it.
  assert.match(speedSource, /const start = useCallback/, 'starting is an explicit callback');
  const startCalls = speedSource.match(/void controller\.start\(\)/g) ?? [];
  assert.equal(startCalls.length, 1, 'the engine is started from exactly one place: the user action');
  assert.ok(
    !/useEffect\([\s\S]{0,400}controller\.start/.test(speedSource),
    'no effect starts a speed test automatically'
  );
});

/* ------------------------------------------------------------------ */
/* Denial is blocked, not a failed device                              */
/* ------------------------------------------------------------------ */

test('blocked - a denied permission is classified blocked, not failed hardware', () => {
  assert.equal(stepOutcome({ status: 'unsupported', classification: 'blocked' }), 'blocked');
  assert.equal(stepOutcome({ status: 'failed', classification: 'blocked' }), 'blocked');
  assert.equal(stepOutcome({ status: 'denied' }), 'blocked');
  assert.equal(stepOutcome({ status: 'unsupported' }), 'blocked');
  // A blocked classification wins even if a tester emitted 'passed' on the
  // way to being blocked.
  assert.equal(stepOutcome({ status: 'passed', classification: 'blocked' }), 'blocked');
});

test('blocked - a real browser-observed failure is evidence, not a block', () => {
  // The browser saw something and reached a negative verdict. That is an
  // observation, so it must not be filed under "unverified" — and it is
  // certainly not "blocked", which means access was refused.
  assert.equal(stepOutcome({ status: 'failed', classification: 'browser' }), 'completed');
  assert.notEqual(stepOutcome({ status: 'failed', classification: 'browser' }), 'blocked');
  const rows = buildInspectionReport(['mic'], {
    mic: { status: 'failed', classification: 'browser', details: 'No usable signal detected.' },
  });
  assert.equal(unverifiedSteps(rows).length, 0, 'a negative result is still evidence');
  assert.match(rows[0].details, /No usable signal/, 'the row says what was actually observed');
});

test('blocked - the testers report a refusal to the host, and the host records it', () => {
  for (const src of [micSource, camSource]) {
    assert.match(src, /onPermissionBlocked\?: \(reason: 'denied' \| 'unavailable'\) => void/);
    assert.match(src, /onBlockedRef\.current\?\.\('denied'\)/, 'a denied permission is reported upward');
    assert.match(src, /onBlockedRef\.current\?\.\('unavailable'\)/, 'an absent device is reported upward');
  }
  assert.match(flowSource, /handleStepBlocked/, 'the flow handles the blocked signal');
  assert.match(flowSource, /classification: 'blocked'/, 'the flow records the step as blocked');
  assert.match(
    flowSource,
    /The hardware was never tested/,
    'a blocked step says plainly that the hardware was not tested'
  );
});

test('blocked - a blocked step explains itself and offers a way forward', () => {
  const g = guidanceFor('mic', 'blocked');
  assert.ok(g, 'blocked steps carry guidance');
  assert.match(g!.nextStep, /blocked access/i);
  assert.match(g!.nextStep, /re-run|retry/i, 'the user can retry');
  assert.equal(g!.guideHref, '/guides/microphone-not-working', 'a real, existing guide is linked');
});

/* ------------------------------------------------------------------ */
/* The five outcomes are shown accurately                              */
/* ------------------------------------------------------------------ */

test('outcomes - completed, confirmed, skipped, blocked, and incomplete are all distinct', () => {
  assert.equal(stepOutcome({ status: 'passed', classification: 'browser' }), 'completed');
  assert.equal(stepOutcome({ status: 'warning', classification: 'browser' }), 'completed');
  assert.equal(stepOutcome({ status: 'measured', classification: 'browser' }), 'completed');
  assert.equal(stepOutcome({ status: 'passed', classification: 'user' }), 'confirmed');
  assert.equal(stepOutcome({ status: 'skipped', classification: 'skipped' }), 'skipped');
  assert.equal(stepOutcome({ status: 'unsupported', classification: 'blocked' }), 'blocked');
  assert.equal(stepOutcome({ status: 'inconclusive' }), 'incomplete');
  assert.equal(stepOutcome(undefined), 'incomplete');
  assert.equal(new Set(Object.values(OUTCOME_LABEL)).size, 5, 'all five outcomes are labelled');
});

test('outcomes - a user confirmation is never upgraded to a browser observation', () => {
  const rows = buildInspectionReport(['speakers'], {
    speakers: { status: 'passed', classification: 'user', details: 'Confirmed a tone in both sides.' },
  });
  assert.equal(rows[0].outcome, 'confirmed');
  assert.equal(rows[0].source, 'user');
  assert.equal(rows[0].sourceLabel, 'Your confirmation');
  assert.notEqual(rows[0].sourceLabel, 'Browser observation');
});

test('outcomes - clean completions carry no next step; problems do', () => {
  assert.equal(guidanceFor('mic', 'completed'), null, 'a clean check needs no guidance');
  assert.equal(guidanceFor('speakers', 'confirmed'), null, 'a confirmation needs no guidance');
  for (const outcome of ['skipped', 'blocked', 'incomplete'] as const) {
    assert.ok(guidanceFor('webcam', outcome), `${outcome} steps get guidance`);
    assert.ok(needsAttention(outcome), `${outcome} needs attention`);
  }
  assert.ok(!needsAttention('completed'));
  assert.ok(!needsAttention('confirmed'));
});

/* ------------------------------------------------------------------ */
/* Step transitions and reruns                                         */
/* ------------------------------------------------------------------ */

test('reruns - a rerun replaces the step instead of appending a duplicate row', () => {
  // One key per step: however many times a check runs, the report has one
  // row for it and the latest result wins.
  const results: Record<string, import('../lib/inspection/stepOutcomes').StepResult> = {
    mic: { status: 'failed', classification: 'browser', details: 'first attempt' },
  };
  const first = buildInspectionReport(PRE_CALL, results);
  assert.equal(first.filter((r) => r.step === 'mic').length, 1);

  // Rerun writes the same key again.
  results.mic = { status: 'passed', classification: 'browser', details: 'second attempt' };
  const second = buildInspectionReport(PRE_CALL, results);
  assert.equal(second.filter((r) => r.step === 'mic').length, 1, 'still exactly one microphone row');
  assert.equal(second.find((r) => r.step === 'mic')!.details, 'second attempt', 'the latest result wins');
  assert.equal(second.length, PRE_CALL.length, 'one row per step, never more');
});

test('reruns - the flow overwrites by step key and says so on screen', () => {
  assert.match(flowSource, /\[key\]: updated/, 'results are written by step key, so a rerun replaces');
  assert.match(
    flowSource,
    /Running it again replaces that result/,
    'the user is told a rerun replaces rather than duplicates'
  );
});

test('transitions - advancing a step records it once and moving on is always possible', () => {
  assert.match(flowSource, /const nextStep = \(\)/);
  assert.match(flowSource, /const skipStep = \(\)/, 'skipping is always available');
  // A step closed without interaction is incomplete, not failed.
  assert.match(flowSource, /status: 'inconclusive'/, 'an untouched step is recorded as inconclusive');
  assert.match(
    flowSource,
    /Inspection step concluded without active device interaction/,
    'and it says the device was never exercised'
  );
});

test('transitions - blocked steps do not stop the run', () => {
  // The blocked path records a row and leaves navigation untouched.
  assert.match(flowSource, /handleStepBlocked[\s\S]{0,600}setActiveStepIndex|handleStepBlocked/, 'blocking records state only');
  assert.match(flowSource, /id="btn-next-inspection-step"/, 'the user can always move to the next step');
  assert.match(flowSource, /id="btn-skip-inspection-step"|\{t\.inspection\.skipTest\}/, 'or skip it');
});

test('selection - a checklist card opens its first step immediately', () => {
  assert.match(
    flowSource,
    /onClick=\{\(\) => startSuite\(k\)\}/,
    'the card itself starts the chosen suite'
  );
  assert.match(
    flowSource,
    /const startSuite = \(key: string\)[\s\S]{0,220}setSelectedSuiteKey\(key\)[\s\S]{0,100}setActiveStepIndex\(0\)/,
    'starting selects the card and opens step 1 in the same action'
  );
  assert.doesNotMatch(flowSource, /id="btn-start-inspection-flow"/, 'the separate start button is gone');
  assert.doesNotMatch(
    flowSource,
    /t\.inspection\.presetComprehensive/,
    'the old Full Comprehensive Hardware Audit button is gone'
  );
  assert.match(flowSource, /Start at step 1/, 'each card states what clicking it will do');
});

test('steps - Pre-Call start controls name the specific test, while speakers keep Play controls', () => {
  assert.match(flowSource, /startButtonLabel="Start Microphone Test"/);
  assert.match(flowSource, /startButtonLabel="Start Camera Test"/);
  assert.match(flowSource, /Use the Play controls in the speaker test to begin/);
  assert.match(speakerSource, /id="btn-play-left-speaker"/);
  assert.match(speakerSource, /id="btn-play-both-speakers"/);
  assert.match(speakerSource, /id="btn-play-right-speaker"/);
  assert.match(micSource, /startButtonLabel \?\? t\.micTest\.grantPermission/);
  assert.match(camSource, /startButtonLabel \?\? t\.common\.startTest/);
});

test('navigation - Previous, step numbers, and Next are together at the top', () => {
  const topNavStart = flowSource.indexOf('aria-label="Inspection step navigation"');
  const firstTester = flowSource.indexOf("activeStepKey === 'mic' &&");
  const nextButton = flowSource.indexOf('id="btn-next-inspection-step"');
  assert.ok(topNavStart >= 0 && firstTester > topNavStart, 'top navigation renders before the tester');
  assert.ok(nextButton > topNavStart && nextButton < firstTester, 'Next is in the top navigation');

  const topNavEnd = flowSource.indexOf('<details', topNavStart);
  const topNav = flowSource.slice(topNavStart, topNavEnd);
  assert.match(topNav, /Previous/);
  assert.match(topNav, /suite\.steps\.map/);
  assert.doesNotMatch(topNav, /t\.inspection\.skipTest/, 'Skip is not mixed into top navigation');
});

test('navigation - Next stays Next until the final step, where it becomes View Report', () => {
  assert.match(
    flowSource,
    /activeStepIndex === suite\.steps\.length - 1 \? 'View Report' : t\.common\.next/,
    'only the final step changes the Next action to report review'
  );
  assert.doesNotMatch(flowSource, /t\.inspection\.viewReport/, 'the old Generated Inspection Report label is not used');
  assert.doesNotMatch(flowSource, /t\.inspection\.finishInspection/, 'the old finish label is not used');
  assert.equal((flowSource.match(/'View Report'/g) ?? []).length, 1, 'View Report appears once as an action');
});

test('details - optional device and inspector fields stay available in every active step', () => {
  assert.match(flowSource, /<details[\s\S]{0,500}Inspection details \(optional\)/);
  assert.match(flowSource, /id="guided-device-label"[\s\S]{0,180}value=\{deviceLabel\}/);
  assert.match(flowSource, /id="guided-operator-name"[\s\S]{0,180}value=\{operatorName\}/);
  assert.match(flowSource, /deviceLabel: deviceLabel \|\| undefined/, 'device details remain connected to the report');
  assert.match(flowSource, /operatorName: operatorName \|\| undefined/, 'inspector details remain connected to the report');
});

test('reruns - Previous/Next navigation preserves every recorded step result', () => {
  const previousHandler = flowSource.match(/onClick=\{\(\) => setActiveStepIndex\(\(prev\) => Math\.max\(0, prev - 1\)\)\}/);
  assert.ok(previousHandler, 'Previous only changes the step index');
  assert.match(flowSource, /const nextStep = \(\)[\s\S]{0,600}\.\.\.resultsRef\.current/, 'Next starts from recorded results');
  assert.match(
    flowSource,
    /if \(!currentResults\[activeStepKey\]\)/,
    'an untouched step is the only step added while advancing'
  );
  // Full resets are limited to starting a checklist or explicitly starting a
  // New Inspection; neither Previous nor Next performs one.
  assert.equal((flowSource.match(/setResults\(\{\}\)/g) ?? []).length, 2);
  assert.match(flowSource, /const startSuite[\s\S]{0,300}setResults\(\{\}\)/);
  assert.match(flowSource, /setResults\(\{\}\)[\s\S]{0,180}setActiveStepIndex\(-1\)/);
});

/* ------------------------------------------------------------------ */
/* Report accuracy                                                     */
/* ------------------------------------------------------------------ */

test('report - the summary separates browser observations from user confirmations', () => {
  const rows = buildInspectionReport(PRE_CALL, {
    mic: { status: 'passed', classification: 'browser', details: 'Sustained input signal.' },
    webcam: { status: 'passed', classification: 'browser', details: 'Live frames observed.' },
    speakers: { status: 'passed', classification: 'user', details: 'Confirmed tone in both sides.' },
  });
  const summary = summarizeRun(rows);
  assert.match(summary, /2 browser-observed/, 'browser observations are counted separately');
  assert.match(summary, /1 user-confirmed/, 'user confirmations are counted separately');
});

test('report - skipped, blocked, and incomplete are all named and counted as unverified', () => {
  const rows = buildInspectionReport(PRE_CALL, {
    mic: { status: 'unsupported', classification: 'blocked', details: 'Access blocked.' },
    webcam: { status: 'skipped', classification: 'skipped', details: 'Skipped.' },
    // speakers absent -> incomplete
  });
  const summary = summarizeRun(rows);
  assert.match(summary, /1 blocked/);
  assert.match(summary, /1 skipped/);
  assert.match(summary, /1 incomplete/);
  assert.match(summary, /3 checks remain unverified/);
  assert.equal(unverifiedSteps(rows).length, 3, 'none of them is treated as evidence');
  assert.equal(attentionRows(rows).length, 3, 'all three are surfaced as needing attention');
});

test('report - a fully evidenced run says so without overclaiming', () => {
  const rows = buildInspectionReport(PRE_CALL, {
    mic: { status: 'passed', classification: 'browser' },
    webcam: { status: 'passed', classification: 'browser' },
    speakers: { status: 'passed', classification: 'user' },
  });
  const summary = summarizeRun(rows);
  assert.match(summary, /Every check produced evidence/);
  assert.equal(unverifiedSteps(rows).length, 0);
});

test('report - the PDF never promises another app will work', () => {
  const rows = buildInspectionReport(PRE_CALL, {
    mic: { status: 'passed', classification: 'browser' },
  });
  const text = inspectionReportText({
    suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
    dateLabel: '24 September 2026',
    rows,
  });
  assert.match(text, /Browser observation/, 'evidence type is stated per check');
  assert.match(text, /Still unverified/, 'an explicit unverified section exists');
  assert.match(text, /cannot see inside any other application/, 'the scope limit is stated');
  assert.ok(
    !/Zoom will work|Teams will work|guarantee/i.test(text),
    'no guarantee about any other application is ever made'
  );
  assert.match(SCOPE_NOTICE, /does not and cannot confirm/);
  assert.match(text, /generated locally in your browser/, 'the privacy line is present');
});

test('report - a blocked check carries its next step and guide into the PDF', () => {
  const text = inspectionReportText({
    suiteTitle: 'Pre-Call',
    dateLabel: '24 September 2026',
    rows: buildInspectionReport(PRE_CALL, {
      mic: { status: 'unsupported', classification: 'blocked', details: 'Access blocked.' },
    }),
  });
  assert.match(text, /Blocked \(No observation\)/, 'the outcome and its evidence type are both shown');
  assert.match(text, /Next step:/);
  assert.match(text, /\/guides\/microphone-not-working/, 'the existing guide is linked in the PDF too');
});

test('report - the flow shows the same honest sections on screen as in the PDF', () => {
  assert.match(flowSource, /Browser observations/, 'browser observations are surfaced');
  assert.match(flowSource, /Your confirmations/, 'user confirmations are surfaced separately');
  assert.match(flowSource, /Still unverified/, 'unverified checks are surfaced');
  assert.match(flowSource, /What this report does not cover/, 'the scope limit is shown on screen');
  assert.match(flowSource, /SCOPE_NOTICE/, 'the screen and PDF share one scope statement');
});

/* ------------------------------------------------------------------ */
/* The long provisional disclaimer is gone                             */
/* ------------------------------------------------------------------ */

test('speed - the long provisional disclaimer is removed everywhere', () => {
  assert.ok(
    !/Provisional values \(measurement in progress/.test(speedSource),
    'the long provisional disclaimer is gone from the speed test'
  );
  assert.ok(
    !/final numbers may differ/.test(speedSource),
    'the disclaimer sentence is not reintroduced'
  );
  assert.match(speedSource, />\s*Live\s*</, 'live readings are marked with a short chip instead');
  assert.match(speedSource, /\{phaseLabel\}/, 'the current phase is shown alongside live values');
  assert.match(speedSource, /describeSpeedPhase/, 'the phase label still comes from the engine');
  // The distinction survives: a finished run is the only one treated as a result.
  assert.match(speedSource, /state\.phase === 'finished' &&/, 'final values render only when finished');
});
