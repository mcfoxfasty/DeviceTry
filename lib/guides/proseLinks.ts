/**
 * Turning a declared `GuideProseLink` into rendered segments.
 *
 * The content files describe a link as an exact phrase inside a plain string,
 * so the expensive part — finding the phrase, deciding what happens when it is
 * missing or ambiguous — happens once, here, in a pure function that can be
 * unit tested. The renderer then only has to map segments to elements.
 *
 * The rule throughout is that prose wins. A link that cannot be placed
 * unambiguously is dropped and the sentence is returned intact, because a
 * troubleshooting article that silently loses a word is far worse than one
 * that renders a paragraph without a citation. The matching errors are
 * asserted in tests/proseLinks.test.ts, so a dropped link fails the build
 * rather than reaching a reader.
 */

import type { GuideProseLink } from '@/content/guides/schema';

export type ProseSegment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string };

/** Non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
}

interface Placed {
  start: number;
  end: number;
  href: string;
}

const overlaps = (a: Placed, b: Placed) => a.start < b.end && b.start < a.end;

/**
 * Split one paragraph, bullet, or step into text and link segments.
 *
 * A phrase is used only when it occurs EXACTLY once. An ambiguous phrase is
 * skipped rather than linked at its first occurrence, because wrapping the
 * first of two identical sentences makes the anchor point at a claim the
 * author did not choose. Overlapping phrases are resolved in declaration
 * order — the first one declared wins, and any later phrase that would cover
 * part of it is skipped — so a short phrase inside a longer one cannot chop a
 * sentence in half.
 *
 * `links` may be passed unsorted: the result is always in reading order.
 */
export function splitProse(text: string, links: GuideProseLink[]): ProseSegment[] {
  if (!text) return [];

  const placed: Placed[] = [];
  for (const link of links) {
    if (!link.text || !link.href) continue;
    if (countOccurrences(text, link.text) !== 1) continue;
    const start = text.indexOf(link.text);
    const candidate: Placed = { start, end: start + link.text.length, href: link.href };
    if (placed.some((p) => overlaps(p, candidate))) continue;
    placed.push(candidate);
  }

  if (placed.length === 0) return [{ kind: 'text', value: text }];
  placed.sort((a, b) => a.start - b.start);

  const segments: ProseSegment[] = [];
  let cursor = 0;
  for (const p of placed) {
    if (p.start > cursor) segments.push({ kind: 'text', value: text.slice(cursor, p.start) });
    segments.push({ kind: 'link', value: text.slice(p.start, p.end), href: p.href });
    cursor = p.end;
  }
  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) });
  return segments;
}

/** The `proseLinks` entries that apply to one string inside a section. */
export function linksForField(
  links: GuideProseLink[] | undefined,
  field: GuideProseLink['field'],
  index: number
): GuideProseLink[] {
  return (links ?? []).filter((l) => l.field === field && l.index === index);
}
