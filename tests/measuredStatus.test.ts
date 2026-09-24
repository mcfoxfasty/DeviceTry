/**
 * Mobile-defect regressions (real-device findings).
 *
 *  1. A COMPLETED measurement must never read as inconclusive. CPS and speed
 *     runs emit the new 'measured' status; the aggregation, the expandable
 *     details, the export label, and the social-share sentence must all agree
 *     that the run completed — with no pass/fail rating attached.
 *  2. Speed progress must be REAL: the controller surfaces the engine's own
 *     measurement step, and only latency/download/upload step types pass
 *     through (an unknown type is dropped rather than invented).
 *  3. Mobile labels must not wrap character by character.
 *  4. Exported reports must not claim a localhost URL, and the blocked
 *     print-window fallback must be labeled as a text file, not a PDF.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { calculateReportStatus, TestResultItem } from '../lib/testing/reportStatus';
import { buildResultDetails } from '../lib/testing/resultDetails';
import { STATUS_LABEL, buildPrintReport, buildExportReport } from '../lib/testing/exportReport';
import { buildSharePayload } from '../lib/share';
import {
  CloudflareSpeedTestController,
  SpeedTestEvents,
  __setEngineFactoryForTests,
} from '../lib/testing/speedProvider';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const bannerSource = readFileSync(join(repoRoot, 'components/TestResultBanner.tsx'), 'utf8');
const speedTesterSource = readFileSync(join(repoRoot, 'components/tests/InternetSpeedTester.tsx'), 'utf8');
const exportControlSource = readFileSync(join(repoRoot, 'components/ui/ExportReportControl.tsx'), 'utf8');

const SPEED_TOOL = {
  title: 'Internet Speed Test',
  instructions: ['Press Start — the test transfers real data.'],
  limitations: ['Results reflect the connection at that moment.'],
  troubleshooting: ['Stop downloads and streaming before re-running.', 'Test near the router.'],
};

/* ------------------------------------------------------------------ */
/* 1. Completed measurements are 'measured', never 'inconclusive'       */
/* ------------------------------------------------------------------ */

test('measured status - a guided step that completed a measurement is not inconclusive', () => {
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    'internet-speed': { status: 'measured', details: 'Measurement complete — download 91.4 Mbps.' },
  };
  // A completed observation must not degrade the whole report the way an
  // unusable/incomplete run does.
  assert.equal(calculateReportStatus(['mic', 'internet-speed'], results), 'passed');
});

test('measured status - genuinely unusable runs are still inconclusive', () => {
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    'internet-speed': { status: 'inconclusive', details: 'Measurement completed, but the engine returned no usable values.' },
  };
  assert.equal(calculateReportStatus(['mic', 'internet-speed'], results), 'inconclusive');
});

test('measured status - details explain a completed run without rating it', () => {
  const d = buildResultDetails(SPEED_TOOL, 'measured');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.match(meaning.lines[0], /completed with a measured value/);
  const joined = meaning.lines.join(' ');
  assert.ok(!/no usable measurement/i.test(joined), 'a completed run must not be described as unusable');
  assert.match(joined, /not a pass\/fail rating/i, 'no pass/fail skill rating is claimed');
});

test('measured status - the export label says measured, not inconclusive', () => {
  assert.equal(STATUS_LABEL.measured, 'Measured (completed, neutral)');
  assert.equal(STATUS_LABEL.inconclusive, 'Inconclusive');

  const data = buildExportReport(
    { id: 'click-speed-test', title: 'CPS & Spacebar Test', slug: 'click-speed-test', instructions: [], limitations: [] },
    {
      status: 'measured',
      details: 'Result: 36 clicks (7.2 CPS)',
      metrics: { clicks: 36, cps: 7.2, durationSeconds: 5 },
    },
    Date.UTC(2026, 8, 24, 10, 0, 0)
  );
  const report = buildPrintReport(data, 'https://devicetry.mcfoxfasty.workers.dev');
  assert.match(report, /Completion status: Measured \(completed, neutral\)/);
  assert.match(report, /Result: 36 clicks \(7\.2 CPS\)/);
  assert.ok(!/Inconclusive/.test(report), 'a completed run is never exported as inconclusive');
});

test('measured status - safe sharing describes a real measurement, not an unusable run', () => {
  const payload = buildSharePayload(
    { id: 'internet-speed-test', title: 'Internet Speed Test' },
    {
      status: 'measured',
      details: 'Measurement complete — download 91.4 Mbps.',
    }
  );
  assert.equal(payload.status, 'measured');
  assert.match(payload.text, /ran a real measurement/);
  assert.ok(!/could not be fully verified/.test(payload.text), 'sharing must not call a completed run unverified');
});

/* ------------------------------------------------------------------ */
/* 2. Speed progress is real engine data, never fabricated             */
/* ------------------------------------------------------------------ */

/**
 * Minimal stand-in for the @cloudflare/speedtest engine. The factory seam
 * expects a CONSTRUCTOR, so this returns a class whose instances expose the
 * four callback hooks the controller wires up.
 */
function fakeEngineFactory() {
  class FakeEngine {
    onPhaseChange:
      | ((info: { measurementId: number; measurement: { type: string; bytes?: number; count?: number } }) => void)
      | null = null;
    onFinish: ((results: unknown) => void) | null = null;
    onError: ((error: string) => void) | null = null;
    onRunningChange: ((running: boolean) => void) | null = null;
    onResultsChange: ((info: unknown) => void) | null = null;
    play() {
      /* no network in tests */
    }
    pause() {
      /* no-op */
    }
    dispose() {
      /* no-op */
    }
  }
  return FakeEngine;
}

/** The instance the controller most recently constructed. */
let lastEngine: InstanceType<ReturnType<typeof fakeEngineFactory>> | null = null;
const factoryCtor = (() => {
  const Base = fakeEngineFactory();
  return class extends Base {
    constructor(...args: unknown[]) {
      super(...(args as []));
      lastEngine = this;
    }
  };
})();

test('speed progress - the engine phase hook is forwarded verbatim as step info', async () => {
  lastEngine = null;
  const restore = __setEngineFactoryForTests(async () => factoryCtor as never);
  try {
    const infos: unknown[] = [];
    const events: SpeedTestEvents = {
      onPhase() {},
      onProgress() {},
      onPhaseInfo(info) {
        infos.push(info);
      },
    };
    const controller = new CloudflareSpeedTestController(events);
    await controller.start();
    lastEngine!.onPhaseChange?.({
      measurementId: 1,
      measurement: { type: 'download', bytes: 25_000_000, count: 1 },
    });
    assert.equal(infos.length, 1, 'a real engine step is reported once');
    assert.deepEqual(infos[0], { type: 'download', bytes: 25_000_000, count: 1, step: 2, totalSteps: 9 });
    controller.dispose();
  } finally {
    restore();
  }
});

test('speed progress - an unrecognized measurement type is dropped, never invented', async () => {
  lastEngine = null;
  const restore = __setEngineFactoryForTests(async () => factoryCtor as never);
  try {
    const infos: unknown[] = [];
    const controller = new CloudflareSpeedTestController({
      onPhase() {},
      onProgress() {},
      onPhaseInfo: (i) => infos.push(i),
    });
    await controller.start();
    lastEngine!.onPhaseChange?.({ measurementId: 0, measurement: { type: 'ping' } });
    assert.equal(infos.length, 0, 'only latency/download/upload are shown; nothing is fabricated');
    controller.dispose();
  } finally {
    restore();
  }
});

test('speed progress - the UI shows provisional values under a clearly-labeled heading', () => {
  assert.match(speedTesterSource, /Provisional values \(measurement in progress/);
  assert.ok(
    !/setInterval|fake|simulate/.test(speedTesterSource),
    'provisional values must come from engine callbacks, not a timer or simulation'
  );
});

/* ------------------------------------------------------------------ */
/* 3. Mobile labels wrap at word boundaries, not character by character */
/* ------------------------------------------------------------------ */

test('mobile layout - measurement chips do not use character-by-character wrapping', () => {
  assert.ok(
    !/font-mono-num[^"]*break-all/.test(bannerSource),
    'the banner metric chips must not use break-all (one character per line)'
  );
  assert.match(bannerSource, /break-words/, 'chips wrap at word boundaries');
  assert.match(bannerSource, /grid-cols-1 min-\[420px\]:grid-cols-2/, 'chips stack to one column on narrow phones');
  assert.ok(
    !/font-mono-num[^"]*break-all/.test(speedTesterSource),
    'speed metric values must not use break-all either'
  );
  assert.match(speedTesterSource, /min-w-0/, 'grid children can shrink below their content width');
});

/* ------------------------------------------------------------------ */
/* 4. Export URL and the iPhone text fallback are labeled honestly      */
/* ------------------------------------------------------------------ */

test('export origin - the report uses the page the test ran on, not a localhost constant', () => {
  // The build-time SITE_URL falls back to http://localhost:3000 when
  // NEXT_PUBLIC_SITE_URL is unset, so the report must prefer window.origin.
  assert.match(
    exportControlSource,
    /window\.location\.origin/,
    'the report URL comes from the origin the test actually ran on'
  );
  const idx = exportControlSource.indexOf('window.location.origin');
  const buildIdx = exportControlSource.indexOf('buildPrintReport(data, origin');
  assert.ok(idx < buildIdx, 'the origin is resolved before the report is built');
});

test('export fallback - a blocked print window is labeled a text file, not a PDF', () => {
  assert.match(exportControlSource, /plain-text \(\.txt\) copy/, 'the fallback explains it is not a PDF');
  assert.match(exportControlSource, /is not a PDF/);
  assert.match(exportControlSource, /devicetry-\$\{data\.toolSlug\}-report\.txt/);
});
