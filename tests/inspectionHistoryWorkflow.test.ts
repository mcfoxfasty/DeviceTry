/**
 * The guided inspection report and the saved-history workflow.
 *
 * The report on the finished screen and the report stored in the user's
 * browser are the same document. The defects pinned here are the ones where
 * those two disagreed with each other, or with the file the user took away:
 *
 *  - notes were typed into the report but never reached the downloaded PDF;
 *  - completing an inspection saved it, while the history list kept showing
 *    what it had read at mount until the page was reloaded;
 *  - a saved record's Print button called window.print(), printing the current
 *    page rather than exporting the record that was clicked;
 *  - the guidance told the user to "re-run it from the report", and the report
 *    had no way back into a step.
 *
 * The pure modules are exercised directly; the component wiring is pinned by
 * reading the source, which is how this suite already guards the flow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  clearAllLocalInspections,
  getLocalInspections,
  saveLocalInspection,
  subscribeLocalInspections,
  updateLocalInspection,
  updateLocalInspectionNotes,
  LOCAL_INSPECTIONS_KEY,
  LocalInspectionItem,
} from '../lib/testing/localHistory';
import {
  savedRecordDateLabel,
  savedRecordPdfFilename,
  savedRecordReport,
  savedRecordReportText,
  savedRecordSteps,
} from '../lib/inspection/savedReport';
import { inspectionReportText, buildInspectionReport, OUTCOME_LABEL } from '../lib/inspection/stepOutcomes';
import { buildPdf, reportLinesFromText } from '../lib/testing/pdf';
import { TestResultItem } from '../lib/testing/reportStatus';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const flowSource = readFileSync(join(repoRoot, 'components/inspection/GuidedInspectionFlow.tsx'), 'utf8');
const listSource = readFileSync(join(repoRoot, 'components/LocalHistoryList.tsx'), 'utf8');

/* ------------------------------------------------------------------ */
/* Browser stub: in-memory Storage plus a real EventTarget for window   */
/* ------------------------------------------------------------------ */

function installBrowser() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
  const win = new EventTarget();
  const g = globalThis as Record<string, unknown>;
  const saved = { localStorage: g.localStorage, window: g.window };
  g.localStorage = store;
  g.window = win;
  return {
    map,
    win,
    /** Simulate a write made by another tab. */
    crossTab(key: string) {
      win.dispatchEvent(new (class extends Event {
        constructor() {
          super('storage');
        }
        key = key;
      })() as unknown as Event);
    },
    restore() {
      g.localStorage = saved.localStorage;
      g.window = saved.window;
    },
  };
}

/** Decode generated PDF bytes the way a viewer would read the text back. */
function pdfText(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

function pdfFor(text: string): string {
  return pdfText(buildPdf(reportLinesFromText(text)));
}

const MIC_PASSED = { status: 'passed', classification: 'browser', details: 'Sustained input signal.' } as TestResultItem;
const SPEAKERS_OK = { status: 'passed', classification: 'user', details: 'Confirmed a tone in both sides.' } as TestResultItem;
const SKIPPED = { status: 'skipped', classification: 'skipped', details: 'User chose to skip this test.' } as TestResultItem;
const BLOCKED = {
  status: 'unsupported',
  classification: 'blocked',
  blockedReason: 'denied',
  details: 'This browser blocked access to this device.',
} as TestResultItem;

function record(over: Partial<LocalInspectionItem> = {}): LocalInspectionItem {
  return {
    id: 'local_test',
    createdAt: Date.parse('2026-03-04T10:15:00Z'),
    locale: 'en',
    deviceLabel: 'Test Laptop',
    operatorName: 'Tester',
    summaryStatus: 'passed',
    testsResults: { mic: MIC_PASSED, speakers: SPEAKERS_OK },
    notes: '',
    suiteKey: 'pre_call',
    suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
    steps: ['mic', 'webcam', 'speakers'],
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Notes survive PDF export                                         */
/* ------------------------------------------------------------------ */

test('notes - the live report text carries the notes the user typed', () => {
  const text = inspectionReportText({
    suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
    dateLabel: '24 September 2026',
    rows: buildInspectionReport(['mic'], { mic: { status: 'passed', classification: 'browser' } }),
    notes: 'Left hinge is stiff; one rubber foot missing.',
  });
  assert.match(text, /^Notes$/m, 'the report has a Notes section');
  assert.match(text, /Left hinge is stiff; one rubber foot missing\./, 'the note text is in the report body');
});

test('notes - the generated PDF file actually contains them', () => {
  // The defect was in the FILE, so the assertion is made on the file bytes
  // rather than on the intermediate text model.
  const note = 'Screen has a scratch at top-left, no dead pixels.';
  const text = inspectionReportText({
    suiteTitle: 'Pre-Call',
    dateLabel: '24 September 2026',
    rows: buildInspectionReport(['mic'], { mic: { status: 'passed', classification: 'browser' } }),
    notes: note,
  });
  assert.match(pdfFor(text), /Screen has a scratch at top-left, no dead pixels\./);
});

test('notes - a blank notes field is stated, not silently dropped', () => {
  const text = inspectionReportText({
    suiteTitle: 'Pre-Call',
    dateLabel: '24 September 2026',
    rows: buildInspectionReport(['mic'], { mic: { status: 'passed', classification: 'browser' } }),
    notes: '   ',
  });
  assert.match(text, /No notes were recorded for this inspection\./);
  // An export with no notes surface at all says nothing about notes.
  const withoutSection = inspectionReportText({
    suiteTitle: 'Pre-Call',
    dateLabel: '24 September 2026',
    rows: buildInspectionReport(['mic'], { mic: { status: 'passed', classification: 'browser' } }),
  });
  assert.doesNotMatch(withoutSection, /^Notes$/m);
});

test('notes - the live flow passes its current notes into the PDF it downloads', () => {
  // A note typed AFTER the auto-save must still reach the file, so the flow
  // has to hand over the live value rather than a stored copy.
  const pdfCall = flowSource.slice(
    flowSource.indexOf('const downloadInspectionPdf'),
    flowSource.indexOf('return (', flowSource.indexOf('const downloadInspectionPdf'))
  );
  assert.match(
    pdfCall,
    /inspectionReportText\(\{[\s\S]*?\n\s*notes,\n/,
    'downloadInspectionPdf passes the current notes to the report builder'
  );
  assert.doesNotMatch(
    pdfCall,
    /getLocalInspections|localStorage/,
    'the notes are the live value, not a re-read from storage'
  );
});

/* ------------------------------------------------------------------ */
/* 2. The history list updates without a reload                         */
/* ------------------------------------------------------------------ */

test('history - a same-tab save reaches a live subscriber', () => {
  const env = installBrowser();
  try {
    let calls = 0;
    const unsubscribe = subscribeLocalInspections(() => {
      calls += 1;
    });
    saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Laptop',
      operatorName: 'Tester',
      summaryStatus: 'passed',
      testsResults: { mic: MIC_PASSED },
      notes: '',
      suiteKey: 'pre_call',
      suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
      steps: ['mic'],
    });
    assert.equal(calls, 1, 'finishing an inspection notifies the list in this same tab');
    unsubscribe();
  } finally {
    env.restore();
  }
});

test('history - a write in another tab reaches the list', () => {
  const env = installBrowser();
  try {
    let calls = 0;
    const unsubscribe = subscribeLocalInspections(() => {
      calls += 1;
    });
    env.crossTab(LOCAL_INSPECTIONS_KEY);
    assert.equal(calls, 1, 'a cross-tab write of the inspections key is observed');
    env.crossTab('some_other_key');
    assert.equal(calls, 1, 'an unrelated key does not trigger a re-read');
    unsubscribe();
  } finally {
    env.restore();
  }
});

test('history - unsubscribing stops late callbacks', () => {
  const env = installBrowser();
  try {
    let calls = 0;
    const unsubscribe = subscribeLocalInspections(() => {
      calls += 1;
    });
    unsubscribe();
    env.crossTab(LOCAL_INSPECTIONS_KEY);
    saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Laptop',
      operatorName: 'Tester',
      summaryStatus: 'passed',
      testsResults: {},
      notes: '',
    });
    assert.equal(calls, 0, 'an unmounted list is never called back');
  } finally {
    env.restore();
  }
});

test('history - the list subscribes instead of reading once at mount', () => {
  assert.match(listSource, /subscribeLocalInspections\(refresh\)/, 'the list listens for changes');
  assert.match(listSource, /mountedRef\.current = false/, 'and rejects callbacks that arrive after unmount');
  assert.doesNotMatch(
    listSource,
    /onClick=\{\(\) => window\.print\(\)\}|onClick=\{window\.print\}/,
    'no control prints the current page any more'
  );
  assert.doesNotMatch(listSource, /<Printer\b/, 'the print control itself is gone');
  assert.match(listSource, /View Report/, 'a saved record can be opened');
  assert.match(listSource, /savedRecordReportText\(record\)/, 'and exported from its own stored data');
});

/* ------------------------------------------------------------------ */
/* 3. Exporting record A after running B still exports A                */
/* ------------------------------------------------------------------ */

test('saved records - an export is built from the record clicked, not the newest one', () => {
  const env = installBrowser();
  try {
    clearAllLocalInspections();
    const a = saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Laptop A',
      operatorName: 'Alice',
      summaryStatus: 'passed',
      testsResults: { mic: MIC_PASSED },
      notes: 'A only note',
      suiteKey: 'pre_call',
      suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
      steps: ['mic'],
    });
    const b = saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Laptop B',
      operatorName: 'Bob',
      summaryStatus: 'failed',
      testsResults: { mic: BLOCKED },
      notes: 'B only note',
      suiteKey: 'classroom',
      suiteTitle: 'Classroom / Lab Kiosk Verification (4 Mins)',
      steps: ['keyboard'],
    });
    assert.ok(a.saved && b.saved);

    // A is now the older record; a second run exists and is listed first.
    const stored = getLocalInspections();
    assert.equal(stored[0].id, b.id, 'the newest record is listed first');

    const textA = savedRecordReportText(stored.find((r) => r.id === a.id)!);
    assert.match(textA, /Device: Laptop A/);
    assert.match(textA, /Checked by: Alice/);
    assert.match(textA, /A only note/);
    assert.doesNotMatch(textA, /Laptop B|B only note|Bob/, 'nothing from the other run leaks in');
    assert.match(textA, /Pre-Call \/ Meeting Readiness/, "A keeps A's own checklist");

    const fileA = pdfFor(textA);
    assert.match(fileA, /Laptop A/);
    assert.match(fileA, /A only note/);
    assert.doesNotMatch(fileA, /Laptop B|B only note/);
  } finally {
    env.restore();
  }
});

test('saved records - the filename is built from the record timestamp', () => {
  const name = savedRecordPdfFilename(record({ deviceLabel: 'My Laptop' }));
  assert.match(name, /^devicetry-inspection-my-laptop-2026-03-04T10-15-00-000Z\.pdf$/);
  // The date label is locale-formatted, so it is asserted by content rather
  // than by an exact string that differs between ICU builds.
  assert.match(savedRecordDateLabel(record().createdAt), /2026/);
  assert.doesNotMatch(savedRecordDateLabel(record().createdAt), /1970|Invalid|NaN/);
  assert.equal(savedRecordDateLabel(Number.NaN), 'Date not recorded');
});

/* ------------------------------------------------------------------ */
/* 4. Re-testing updates the same record                               */
/* ------------------------------------------------------------------ */

test('retest - re-finishing refreshes one record instead of adding another', () => {
  const env = installBrowser();
  try {
    clearAllLocalInspections();
    const saved = saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Laptop',
      operatorName: 'Tester',
      summaryStatus: 'passed',
      testsResults: { mic: MIC_PASSED },
      notes: 'first note',
      suiteKey: 'pre_call',
      suiteTitle: 'Pre-Call / Meeting Readiness (3 Mins)',
      steps: ['mic'],
    });
    assert.ok(saved.saved);

    // The microphone is retested and now reads blocked; the note is edited.
    const updated = updateLocalInspection(saved.id, {
      summaryStatus: 'inconclusive',
      testsResults: { mic: BLOCKED },
      notes: 'retested note',
    });
    assert.equal(updated, true, 'the refresh reached storage');

    const all = getLocalInspections();
    assert.equal(all.length, 1, 'one inspection is one record — no duplicate is created');
    const after = all[0];
    assert.equal(after.id, saved.id, 'the same record is refreshed');
    assert.equal(after.summaryStatus, 'inconclusive', 'the summary follows the new results');
    assert.equal(after.testsResults.mic.status, 'unsupported', 'the new result replaces the old one');
    assert.equal(after.testsResults.mic.classification, 'blocked');
    assert.equal(after.notes, 'retested note', 'the notes are updated, not left stale');
    assert.equal(after.createdAt, saved.createdAt, 'the record keeps its original date and position');
    assert.ok((after.updatedAt ?? 0) >= after.createdAt, 'the refresh is timestamped');

    // And the rebuilt report reflects all three changes at once.
    const report = savedRecordReport(after);
    assert.equal(report.summaryStatus, 'inconclusive');
    assert.equal(report.rows.find((r) => r.step === 'mic')!.outcome, 'blocked');
    assert.equal(report.rows.find((r) => r.step === 'mic')!.sourceLabel, 'No observation');
    assert.match(savedRecordReportText(after), /retested note/);
  } finally {
    env.restore();
  }
});

test('retest - updating an unknown record reports failure instead of pretending', () => {
  const env = installBrowser();
  try {
    clearAllLocalInspections();
    assert.equal(updateLocalInspection('local_missing', { notes: 'x' }), false);
    assert.equal(getLocalInspections().length, 0, 'nothing was written for an unknown id');
  } finally {
    env.restore();
  }
});

test('retest - the flow refreshes results, summary and notes of the saved record', () => {
  const persist = flowSource.slice(
    flowSource.indexOf('const persistOnFinish'),
    flowSource.indexOf('const returnToStep')
  );
  assert.match(persist, /if \(savedIdRef\.current\)/, 'a run that already saved reuses its record');
  assert.match(persist, /updateLocalInspection\(savedIdRef\.current, \{[\s\S]{0,200}summaryStatus/);
  assert.match(persist, /updateLocalInspection\(savedIdRef\.current, \{[\s\S]{0,200}testsResults/);
  assert.match(persist, /updateLocalInspection\(savedIdRef\.current, \{[\s\S]{0,200}notes/);
  assert.doesNotMatch(
    persist,
    /updateLocalInspectionNotes/,
    'notes alone are not enough to refresh a re-tested run'
  );
  assert.match(flowSource, /suiteKey: selectedSuiteKey/, 'the checklist identity is persisted');
  assert.match(flowSource, /suiteTitle: suite\.title/);
  assert.match(flowSource, /steps: \[\.\.\.suite\.steps\]/);
});

/* ------------------------------------------------------------------ */
/* 5. Reset removes obsolete results                                    */
/* ------------------------------------------------------------------ */

test('reset - a tester reset removes that step from the recorded results', () => {
  const clear = flowSource.slice(
    flowSource.indexOf('const clearStepResult'),
    flowSource.indexOf('const persistOnFinish')
  );
  assert.match(clear, /delete next\[key\]/, 'the step key is removed, not blanked');
  assert.match(clear, /resultsRef\.current = next/, 'the mirror used at finish is updated too');
  // Every tester in the flow is wired to that clear path.
  for (const label of [
    'Start Microphone Test',
    'Start Camera Test',
    'Start Keyboard Test',
    'Start Mouse Test',
    'Start Display Test',
    'Start Gamepad Test',
  ]) {
    const idx = flowSource.indexOf(`startButtonLabel="${label}"`);
    assert.ok(idx > 0, `${label} is still rendered`);
  }
  assert.equal((flowSource.match(/onResultClear=\{\(\) => clearStepResult\('(mic|webcam|speakers|keyboard|mouse|display|gamepad)'\)\}/g) ?? []).length, 7);
});

test('reset - starting over does not overwrite the record the last run saved', () => {
  // savedIdRef is what makes a re-finish update one record instead of
  // creating a second. If a reset left it set, the NEXT inspection would
  // overwrite the previous run's history.
  const clears = flowSource.match(/savedIdRef\.current = null/g) ?? [];
  assert.equal(clears.length, 2, 'both reset paths (start a checklist, New Inspection) clear it');
  assert.match(flowSource, /const startSuite[\s\S]{0,400}?savedIdRef\.current = null/);
  assert.match(flowSource, /setNotes\(''\)[\s\S]{0,120}?savedIdRef\.current = null/);
});

/* ------------------------------------------------------------------ */
/* 6. Older records are described honestly                              */
/* ------------------------------------------------------------------ */

test('legacy records - a record with no stored checklist does not get one invented', () => {
  const legacy = record({ suiteKey: undefined, suiteTitle: undefined, steps: undefined });
  const { steps, provenance } = savedRecordSteps(legacy);
  assert.equal(provenance, 'derived', 'the steps come from what the record actually holds');
  assert.deepEqual(steps.sort(), ['mic', 'speakers']);

  const report = savedRecordReport(legacy);
  assert.match(report.checklistLabel, /Checklist not recorded/i);
  assert.match(report.provenanceLine, /without its checklist identity/i);
  assert.match(
    report.provenanceLine,
    /A step that was skipped or never recorded cannot be recovered/,
    'the report says what is missing rather than filling the gap'
  );
  assert.doesNotMatch(report.checklistLabel, /Pre-Call/, 'no checklist is claimed that was not stored');
  // The results it does hold are still described.
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows.find((r) => r.step === 'mic')!.outcomeLabel, OUTCOME_LABEL.completed);
});

test('legacy records - a record with no results is not reported as a clean run', () => {
  const empty = record({ testsResults: {}, steps: undefined, suiteTitle: undefined });
  const report = savedRecordReport(empty);
  assert.equal(report.provenance, 'none');
  assert.equal(report.rows.length, 0);
  assert.match(report.summaryLine, /No checks were recorded/i);
  assert.match(report.provenanceLine, /not a clean run/i);
  assert.equal(report.summaryStatus, 'inconclusive');
  assert.match(savedRecordReportText(empty), /nothing was recorded/i);
});

test('legacy records - a check this build no longer runs is kept and named', () => {
  const old = record({
    steps: ['mic', 'touchscreen'],
    testsResults: { mic: MIC_PASSED, touchscreen: { status: 'passed', classification: 'browser' } } as Record<
      string,
      TestResultItem
    >,
  });
  const report = savedRecordReport(old);
  assert.equal(report.hasRetiredSteps, true);
  assert.equal(report.rows.length, 2, 'the retired check is not dropped from the report');
  assert.equal(report.rows.find((r) => r.step === 'touchscreen')!.label, 'Touchscreen');
  assert.match(report.provenanceLine, /not part of the current checklist/i);
  assert.match(report.provenanceLine, /Touchscreen/);
});

/* ------------------------------------------------------------------ */
/* 7. The five outcomes survive the save/round trip                     */
/* ------------------------------------------------------------------ */

test('distinctions - observed, confirmed, skipped, blocked and incomplete stay distinct', () => {
  const env = installBrowser();
  try {
    clearAllLocalInspections();
    saveLocalInspection({
      locale: 'en',
      deviceLabel: 'Mixed',
      operatorName: 'Tester',
      summaryStatus: 'inconclusive',
      testsResults: {
        mic: MIC_PASSED, // completed, browser
        speakers: SPEAKERS_OK, // confirmed, user
        keyboard: SKIPPED, // skipped
        mouse: BLOCKED, // blocked
        // display absent -> incomplete
      },
      notes: '',
      suiteKey: 'full',
      suiteTitle: 'Full Diagnostic Check (All 7 Tests)',
      steps: ['mic', 'webcam', 'speakers', 'keyboard', 'mouse', 'display', 'gamepad'],
    });
    const saved = getLocalInspections()[0];
    const report = savedRecordReport(saved);
    const outcome = (step: string) => report.rows.find((r) => r.step === step)!.outcome;

    assert.equal(outcome('mic'), 'completed');
    assert.equal(outcome('speakers'), 'confirmed');
    assert.equal(outcome('keyboard'), 'skipped');
    assert.equal(outcome('mouse'), 'blocked');
    assert.equal(outcome('display'), 'incomplete');
    assert.equal(outcome('webcam'), 'incomplete', 'a step with no result is incomplete, not failed');
    assert.equal(outcome('gamepad'), 'incomplete');

    assert.equal(report.rows.find((r) => r.step === 'speakers')!.sourceLabel, 'Your confirmation');
    assert.equal(report.rows.find((r) => r.step === 'mic')!.sourceLabel, 'Browser observation');
    assert.match(report.summaryLine, /1 browser-observed/);
    assert.match(report.summaryLine, /1 user-confirmed/);
    assert.match(report.summaryLine, /1 skipped/);
    assert.match(report.summaryLine, /1 blocked/);
    assert.match(report.summaryLine, /3 incomplete/);
    assert.equal(report.unverifiedCount, 5, 'skipped, blocked and the three absent steps are unverified');
    assert.equal(report.summaryStatus, 'inconclusive');

    // And the file says the same thing.
    const file = savedRecordReportText(saved);
    assert.match(file, /Blocked \(No observation\)/);
    assert.match(file, /Skipped \(No observation\)/);
    assert.match(file, /Incomplete \(No observation\)/);
    assert.match(file, /Completed \(Browser observation\)/);
    assert.match(file, /User-confirmed \(Your confirmation\)/);
  } finally {
    env.restore();
  }
});

/* ------------------------------------------------------------------ */
/* 8. The promised return-to-step action exists                         */
/* ------------------------------------------------------------------ */

test('return to step - the report can send the user back to an uncovered check', () => {
  assert.match(
    flowSource,
    /const returnToStep = \(stepKey: string\)/,
    'there is a real action behind the guidance'
  );
  assert.match(flowSource, /returnToStep\(row\.step\)/, 'each check needing attention gets one');
  assert.match(flowSource, /Return to this check/, 'and the button says what it does');
  assert.match(
    flowSource,
    /const index = suite\.steps\.indexOf\(stepKey as TestKey\);[\s\S]{0,160}?setActiveStepIndex\(index\)/,
    'it moves to that check own position in the checklist'
  );
  // The guidance sentence that made the promise is unchanged, and the action it
  // named now exists.
  assert.match(
    readFileSync(join(repoRoot, 'lib/inspection/stepOutcomes.ts'), 'utf8'),
    /Re-run it from the report/,
    'the guidance is unchanged; the action it named now exists'
  );
  assert.match(
    flowSource,
    /suite\.steps\.includes\(row\.step as TestKey\)/,
    'the button is only offered for a step this checklist actually ran'
  );
});
