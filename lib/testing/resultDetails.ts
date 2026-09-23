/**
 * Phase 2 — expandable, test-specific result details.
 *
 * WHAT THIS IS: the "What this means" disclosure in the result card. It
 * expands to show 2–4 short, honest lines that explain the observed verdict
 * for THIS test, plus up to two appropriate next steps and, when provided,
 * rerun-comparison guidance.
 *
 * HONESTY CONTRACT (mirrors lib/testing/exportReport.ts and resultPolicy):
 *  - Every line is derived from the tool definition the registry already
 *    ships (instructions / limitations / troubleshooting) — nothing here is
 *    invented at runtime or inferred beyond what the browser observed.
 *  - The browser CANNOT know why a verdict happened. Explanations never
 *    claim causation ("because your driver is broken"); they state what the
 *    verdict does and does not cover and offer a concrete next step. Where
 *    the cause is unknowable, the line says so explicitly.
 *  - Where the result is honest-but-limited, the matching tool limitation is
 *    surfaced so the user sees it next to the verdict, not buried in page
 *    prose below the card.
 *  - No app names are claimed as knowledge: guidance stays inside the
 *    browser/site scope and never asserts what another app's settings are.
 *
 * The banner remains the source of the verdict itself; this module only adds
 * the explanation layer and is rendered by TestResultBanner.
 */

import { ToolDefinition } from '@/lib/tools/types';
import { BannerStatus } from './resultPolicy';

export interface ResultDetailLine {
  /** A short section label, e.g. "What this means". */
  heading: string;
  /** Honest explanation lines for this verdict (2–4 short strings). */
  lines: string[];
}

export interface ResultDetails {
  /** Explanation sections, in render order. */
  sections: ResultDetailLine[];
  /** Up to two concrete next steps appropriate to this verdict. */
  nextSteps: string[];
  /** Optional rerun/compare guidance when compatible measurements exist. */
  rerunHint?: string;
}

/** Render label for a status, shared with the export report's wording. */
function statusLabel(status: BannerStatus): string {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'warning':
      return 'passed with caveats';
    case 'inconclusive':
      return 'inconclusive';
    case 'unsupported':
      return 'not supported by this browser';
    case 'skipped':
      return 'not run';
  }
}

/**
 * Build the expandable details for one verdict.
 *
 * `attemptIncomplete` marks verdicts where the tester itself labeled the
 * attempt as stopped early or partially observed (Phase 1 behavior). Such
 * verdicts are labelled as incomplete here so a passed-looking value is
 * never read as a complete pass.
 */
export function buildResultDetails(
  tool: Pick<ToolDefinition, 'title' | 'instructions' | 'limitations' | 'troubleshooting'>,
  status: BannerStatus,
  attemptIncomplete?: boolean
): ResultDetails {
  const label = statusLabel(status);
  const title = tool.title;

  const sections: ResultDetailLine[] = [];
  const nextSteps: string[] = [];

  // Section 1 — what the verdict itself means, scoped to what the browser
  // can actually know. Cautious wording; no cause claims.
  const meaning: string[] = [
    `Your ${title} run was recorded as ${label}. This reflects what your browser observed during that run only.`,
  ];
  if (attemptIncomplete) {
    meaning.push(
      'The attempt was stopped before it finished, so values shown are partial — read them as observations, not a complete pass.'
    );
  }
  if (status === 'failed' || status === 'warning') {
    meaning.push(
      'The browser cannot see WHY this happened — it cannot observe drivers, system settings, or other apps — so treat the steps below as checks, not a diagnosis.'
    );
  }
  if (status === 'inconclusive' || status === 'skipped') {
    meaning.push(
      'No usable measurement was captured this run, so no pass or fail is claimed.'
    );
  }
  if (status === 'unsupported') {
    meaning.push(
      'This browser does not expose the web APIs this test needs, so no measurement was possible here. Trying another up-to-date browser is the meaningful next step.'
    );
  }
  sections.push({ heading: 'What this means', lines: meaning });

  // Section 2 — surface the tool's own stated limitation alongside the
  // verdict (first limitation is the defining one for every registry tool).
  if (tool.limitations.length > 0) {
    sections.push({ heading: 'Keep in mind', lines: [tool.limitations[0]] });
  }

  // Next steps — drawn from the registry troubleshooting entries, which are
  // written as user checks. At most two, per the Phase 2 spec.
  nextSteps.push(...tool.troubleshooting.slice(0, 2));

  // Rerun guidance — every tool page owns its own instructions, which are
  // the honest "how to produce another comparable run" source.
  if (tool.instructions.length > 0) {
    sections.push({
      heading: 'Run it again',
      lines: [
        `Re-run from this card any time — following the steps listed on the page keeps runs comparable. ${tool.instructions.length} step${tool.instructions.length === 1 ? '' : 's'} are listed for ${title}.`,
      ],
    });
  }

  return { sections, nextSteps, rerunHint: undefined };
}
