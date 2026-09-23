/**
 * Privacy-safe share payloads (post-deployment correction C).
 *
 * Hard rules, enforced by `buildSharePayload` and verified by regression
 * tests:
 *  - Never share media (audio/video/recording), IP addresses, pressed keys,
 *    clipboard content, device identifiers, or private raw observations.
 *  - Reaction/CPS (numeric-score) tools may share their numeric score.
 *  - Every other diagnostic may share ONLY a generic summary sentence
 *    (Pass / Warning / Needs attention), never its detailed measurements.
 */

import { ToolDefinition } from './tools/types';
import { sharePolicyForTool as registrySharePolicy } from './tools/registry';

/** Raw result values a tester may hand to the share builder. */
export interface ShareResultInput {
  /** Generic verdict bucket. */
  status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported';
  /** Numeric score; ONLY honored for numeric-score policy tools. */
  score?: number | null;
  /** Optional unit for the score ("CPS", "ms"). */
  scoreUnit?: string;
  /** Ignored for generic-summary tools — defense in depth against leakage. */
  details?: string;
}

const GENERIC_SENTENCE: Record<ShareResultInput['status'], string> = {
  passed: 'all checks passed',
  warning: 'works, with a couple of things worth checking',
  failed: 'needs attention',
  inconclusive: 'could not be fully verified',
  unsupported: 'is not supported by this browser',
};

export interface SharePayload {
  /** Share text (safe for every audience — no private values). */
  text: string;
  /** Verdict bucket for a11y labels. */
  status: ShareResultInput['status'];
  /** True when the payload contains the tool's numeric score. */
  includesScore: boolean;
}

/**
 * Build the shareable text for a completed test. Numeric scores are included
 * only for numeric-score policy tools; everyone else gets one generic
 * sentence and nothing else. `details` is deliberately never emitted.
 */
export function buildSharePayload(
  tool: Pick<ToolDefinition, 'id' | 'title'>,
  result: ShareResultInput
): SharePayload {
  const policy = registrySharePolicy(tool);

  if (policy === 'score' && typeof result.score === 'number' && Number.isFinite(result.score)) {
    const unit = result.scoreUnit ? ` ${result.scoreUnit}` : '';
    return {
      text: `I scored ${result.score}${unit} on the ${tool.title} at DeviceTry. Try it yourself:`,
      status: result.status,
      includesScore: true,
    };
  }

  return {
    text: `I just checked my hardware with the ${tool.title} at DeviceTry — ${GENERIC_SENTENCE[result.status]}.`,
    status: result.status,
    includesScore: false,
  };
}

/* ------------------------------------------------------------------ */
/* Share targets                                                       */
/* ------------------------------------------------------------------ */

export interface ShareTarget {
  id: 'system' | 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'copy';
  label: string;
  /** Deep-link URL; empty for system/copy which are handled imperatively. */
  href: string;
  /** External targets open a new tab; copy/system do not navigate. */
  external: boolean;
}

/** URL-encode once for both query styles. */
function q(text: string, url: string): string {
  return `text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function shareTargetsFor(text: string, url: string): ShareTarget[] {
  return [
    { id: 'system', label: 'Share', href: '', external: false },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?${q(text, url)}`, external: true },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, external: true },
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?${q(text, url)}`, external: true },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, external: true },
    { id: 'copy', label: 'Copy Link', href: '', external: false },
  ];
}

/**
 * Extract the shareable numeric score from a tester's emitted details
 * string — ONLY for the two numeric-score tools. Returns null for every
 * other tool id (defense in depth: even if a details string contains
 * numbers, non-score tools never get a score to share).
 */
export function extractScoreForShare(
  toolId: string,
  details: string
): { score: number; unit: string } | null {
  if (toolId === 'click-speed-test') {
    const m = /([\d.]+)\s*CPS/i.exec(details);
    return m ? { score: parseFloat(m[1]), unit: 'CPS' } : null;
  }
  if (toolId === 'reaction-time-test') {
    const m = /median\s+(\d+)\s*ms/i.exec(details);
    return m ? { score: parseInt(m[1], 10), unit: 'ms' } : null;
  }
  return null;
}
