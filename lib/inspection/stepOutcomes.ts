/**
 * Guided inspection step outcomes, guidance, and the honest report model.
 *
 * WHAT THIS IS: the single source of truth for what each guided check
 * actually established. Guided inspection drives the same microphone,
 * webcam, and speaker testers the tool pages use, but a guided run has to
 * be honest about a category the standalone tests do not need: the user may
 * skip a step, deny a permission, or close a step without finishing it.
 * Reporting those as "failed" would be a false hardware claim, and
 * reporting them as "passed" would be worse.
 *
 * THE FIVE OUTCOMES (the honest set):
 *   - completed   the browser observed a usable signal this run.
 *   - confirmed   the user stated what they heard/saw (never browser-inferred).
 *   - skipped     the user deliberately passed over the step.
 *   - blocked     the browser refused access or the API is unavailable.
 *   - incomplete  the step was left without a usable observation.
 *
 * WHAT THIS IS NOT: a certification. A guided run can only say what this
 * browser observed and what the user reported. It cannot observe any other
 * application, so it never claims that a specific app will work — a browser
 * cannot see inside Zoom, Teams, or anything else.
 */

/** The guided checks, matching GuidedInspectionFlow's TestKey. */
export type InspectionStep =
  | 'mic'
  | 'webcam'
  | 'speakers'
  | 'keyboard'
  | 'mouse'
  | 'display'
  | 'gamepad'
  | 'battery';

export type StepOutcome = 'completed' | 'confirmed' | 'skipped' | 'blocked' | 'incomplete';
export type BlockedReason = 'denied' | 'unavailable';

/** Human label for each outcome, used in the UI and the report. */
export const OUTCOME_LABEL: Record<StepOutcome, string> = {
  completed: 'Completed',
  confirmed: 'User-confirmed',
  skipped: 'Skipped',
  blocked: 'Blocked',
  incomplete: 'Incomplete',
};

/** Where an outcome came from. This distinction is load-bearing. */
export type EvidenceSource = 'browser' | 'user' | 'none';

/** One recorded guided-check result, in the flow's own shape. */
export interface StepResult {
  status: string;
  /** 'browser' = observed by this browser, 'user' = the user said so. */
  classification?: 'browser' | 'user' | 'inconclusive' | 'unsupported' | 'skipped' | 'blocked';
  /** Why a device was blocked, when the browser can distinguish the cases. */
  blockedReason?: BlockedReason;
  details?: string;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * True when a status means the browser actually observed the hardware and
 * reached a verdict.
 *
 * 'failed' is included deliberately: a browser-observed failure (no signal,
 * no frames) is still an OBSERVATION, not an absence of evidence. Mapping it
 * to "incomplete" would wrongly put a real negative result in the
 * "unverified" bucket. The row's `details` carries what was actually seen,
 * so "Completed" here means "this check ran and produced a verdict" — never
 * "this passed".
 */
const COMPLETED_STATUSES = new Set(['passed', 'warning', 'measured', 'failed']);
/** True when a status means access was refused or impossible. */
const BLOCKED_STATUSES = new Set(['unsupported', 'denied', 'blocked', 'unavailable']);

/**
 * Classify one recorded step.
 *
 * Precedence matters: an explicit user skip or a blocked classification
 * always wins, because a blocked step can never be called "completed" no
 * matter what status its tester happened to emit while failing.
 */
export function stepOutcome(result: StepResult | undefined): StepOutcome {
  if (!result) return 'incomplete';

  const classification = result.classification;
  if (classification === 'skipped' || result.status === 'skipped') return 'skipped';
  if (
    classification === 'blocked' ||
    classification === 'unsupported' ||
    BLOCKED_STATUSES.has(result.status)
  ) {
    return 'blocked';
  }
  // A user observation (heard a tone, saw an image) is reported as
  // confirmed, never upgraded to a browser observation.
  if (classification === 'user') return 'confirmed';
  if (COMPLETED_STATUSES.has(result.status)) return 'completed';
  return 'incomplete';
}

/** Whether the outcome came from the browser or from the user. */
export function evidenceSource(outcome: StepOutcome): EvidenceSource {
  if (outcome === 'confirmed') return 'user';
  if (outcome === 'completed') return 'browser';
  return 'none';
}

/** A concrete action plus the site's own guide, offered when a step needs attention. */
export interface StepGuidance {
  /** One short, specific thing the user can do next. */
  nextStep: string;
  /** An existing DeviceTry guide, when one covers this step. */
  guideHref?: string;
  guideLabel?: string;
}

/**
 * Existing guides, keyed by step. Only links to guides the site already
 * publishes are used, so this can never point at a dead page.
 */
const GUIDE_BY_STEP: Partial<Record<InspectionStep, { href: string; label: string }>> = {
  mic: { href: '/guides/microphone-not-working', label: 'Microphone troubleshooting guide' },
  webcam: { href: '/guides/webcam-not-working', label: 'Webcam troubleshooting guide' },
  speakers: { href: '/guides/one-headphone-side-not-working', label: 'One side silent? Read the guide' },
  keyboard: { href: '/guides/keyboard-keys-not-registering', label: 'Keys not registering? Read the guide' },
  mouse: { href: '/guides/mouse-double-clicking', label: 'Unwanted double-clicking? Read the guide' },
  display: { href: '/guides/checking-screen-dead-pixels', label: 'How to check for dead pixels' },
  gamepad: { href: '/guides/controller-stick-drift', label: 'Stick drift? Read the guide' },
};

/** Fallback copy when a step needs attention but has no dedicated guide. */
const GENERIC_GUIDANCE: Record<InspectionStep, string> = {
  mic: 'Re-run the microphone check and speak at a normal level.',
  webcam: 'Re-run the webcam check and confirm you can see a clear image.',
  speakers: 'Re-run the speaker check and confirm you heard the tone in each side.',
  keyboard: 'Re-run the keyboard check and press each key the panel highlights.',
  mouse: 'Re-run the mouse check and move the pointer to every edge of the area.',
  display: 'Re-run the display check and inspect each solid colour at fullscreen.',
  gamepad: 'Re-run the controller check and press each button the panel lists.',
  battery: 'Re-run the battery check and wait for a fresh reading.',
};

/**
 * Guidance for a step that is not a clean completion: blocked, incomplete,
 * or skipped. A clean completion needs no next step.
 */
export function guidanceFor(
  step: InspectionStep,
  outcome: StepOutcome,
  blockedReason?: BlockedReason
): StepGuidance | null {
  if (outcome === 'completed' || outcome === 'confirmed') return null;

  const guide = GUIDE_BY_STEP[step];
  const base = { guideHref: guide?.href, guideLabel: guide?.label };

  if (outcome === 'blocked') {
    if (step === 'mic' && blockedReason === 'unavailable') {
      return {
        ...base,
        nextStep: 'No microphone device was found. Connect or enable a microphone, then re-run this check — or skip it and continue.',
      };
    }
    if (step === 'mic' && blockedReason === 'denied') {
      return {
        ...base,
        nextStep: 'Microphone permission was denied. Allow it for this site in the address bar, then re-run this check — or skip it and continue.',
      };
    }
    return {
      ...base,
      nextStep:
        'This browser blocked access. Allow the permission for this site in the address bar, then re-run this check — or skip it and continue.',
    };
  }
  if (outcome === 'skipped') {
    return { ...base, nextStep: 'This check was skipped and remains unverified. Re-run it from the report if you want it covered.' };
  }
  return { ...base, nextStep: GENERIC_GUIDANCE[step] };
}

/** Does this outcome mean the step still needs the user's attention? */
export function needsAttention(outcome: StepOutcome): boolean {
  return outcome !== 'completed' && outcome !== 'confirmed';
}

/** One row of the final report. */
export interface ReportRow {
  step: InspectionStep;
  label: string;
  outcome: StepOutcome;
  outcomeLabel: string;
  source: EvidenceSource;
  sourceLabel: string;
  details: string;
  guidance: StepGuidance | null;
}

/** Display names for the guided steps. */
const STEP_LABEL: Record<InspectionStep, string> = {
  mic: 'Microphone',
  webcam: 'Webcam',
  speakers: 'Speakers',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  display: 'Display',
  gamepad: 'Controller',
  battery: 'Battery',
};

/**
 * The disclaimer the report always carries. It is the reason this feature
 * cannot be mistaken for a certification, and it is stated in the summary
 * and the PDF alike.
 */
export const SCOPE_NOTICE =
  'This report covers only what this browser observed and what you confirmed. ' +
  'It cannot see inside any other application, so it does not and cannot confirm that ' +
  'Zoom, Teams, or any other app will work. Treat anything not listed as verified as unverified.';

/**
 * Build the full report from the recorded results.
 *
 * A rerun replaces its step's row rather than appending, so one check can
 * never contribute twice.
 */
export function buildInspectionReport(
  steps: InspectionStep[],
  results: Record<string, StepResult | undefined>
): ReportRow[] {
  return steps.map((step) => {
    const result = results[step];
    const outcome = stepOutcome(result);
    const source = evidenceSource(outcome);
    return {
      step,
      label: STEP_LABEL[step],
      outcome,
      outcomeLabel: OUTCOME_LABEL[outcome],
      source,
      sourceLabel:
        source === 'browser' ? 'Browser observation' : source === 'user' ? 'Your confirmation' : 'No observation',
      details: result?.details ?? 'This check was not completed.',
      guidance: guidanceFor(step, outcome, result?.blockedReason),
    };
  });
}

/** Steps that still need attention, in report order. */
export function attentionRows(rows: ReportRow[]): ReportRow[] {
  return rows.filter((r) => needsAttention(r.outcome));
}

/** Steps that carry no evidence at all. */
export function unverifiedSteps(rows: ReportRow[]): ReportRow[] {
  return rows.filter((r) => r.source === 'none');
}

/** A one-line honest summary of the whole run. */
export function summarizeRun(rows: ReportRow[]): string {
  const completed = rows.filter((r) => r.outcome === 'completed').length;
  const confirmed = rows.filter((r) => r.outcome === 'confirmed').length;
  const blocked = rows.filter((r) => r.outcome === 'blocked').length;
  const skipped = rows.filter((r) => r.outcome === 'skipped').length;
  const incomplete = rows.filter((r) => r.outcome === 'incomplete').length;
  const unverified = rows.length - completed - confirmed;

  const parts = [
    `${completed} browser-observed`,
    `${confirmed} user-confirmed`,
  ];
  if (blocked) parts.push(`${blocked} blocked`);
  if (skipped) parts.push(`${skipped} skipped`);
  if (incomplete) parts.push(`${incomplete} incomplete`);

  const tail =
    unverified > 0
      ? ` ${unverified} check${unverified === 1 ? ' remains' : 's remain'} unverified.`
      : ' Every check produced evidence.';
  return `${parts.join(', ')}.${tail}`;
}

/**
 * The inspection report as plain text, in the same shape the PDF writer
 * consumes. The on-screen report and the exported PDF are built from these
 * same rows, so the two can never disagree about what was verified.
 */
export function inspectionReportText(options: {
  suiteTitle: string;
  deviceLabel?: string;
  operatorName?: string;
  dateLabel: string;
  rows: ReportRow[];
}): string {
  const { suiteTitle, deviceLabel, operatorName, dateLabel, rows } = options;
  const lines: string[] = [];

  lines.push('DeviceTry — Local Inspection Report');
  lines.push('='.repeat(34));
  lines.push(`Inspection: ${suiteTitle}`);
  if (deviceLabel) lines.push(`Device: ${deviceLabel}`);
  if (operatorName) lines.push(`Checked by: ${operatorName}`);
  lines.push(`Date: ${dateLabel}`);
  lines.push(`Summary: ${summarizeRun(rows)}`);
  lines.push('');

  lines.push('Checks');
  lines.push('-'.repeat(6));
  for (const row of rows) {
    lines.push(`${row.label}: ${row.outcomeLabel} (${row.sourceLabel})`);
    if (row.details) lines.push(`  ${row.details}`);
    if (row.guidance) {
      lines.push(`  Next step: ${row.guidance.nextStep}`);
      if (row.guidance.guideHref) {
        lines.push(`  Guide: ${row.guidance.guideLabel} — ${row.guidance.guideHref}`);
      }
    }
  }
  lines.push('');

  // The unverified section is the honest counterweight to a clean summary.
  const unverified = unverifiedSteps(rows);
  if (unverified.length > 0) {
    lines.push('Still unverified');
    lines.push('-'.repeat(16));
    for (const row of unverified) {
      lines.push(`- ${row.label}: ${row.outcomeLabel.toLowerCase()}`);
    }
  } else {
    lines.push('Still unverified');
    lines.push('-'.repeat(16));
    lines.push('None — every check produced either a browser observation or your confirmation.');
  }
  lines.push('');

  lines.push('What this report does not cover');
  lines.push('-'.repeat(29));
  lines.push(SCOPE_NOTICE);
  lines.push('');

  lines.push(
    'Privacy: generated locally in your browser. No recordings, no IP addresses, ' +
      'no pressed keys, and no clipboard content are included.'
  );
  return lines.join('\n') + '\n';
}
