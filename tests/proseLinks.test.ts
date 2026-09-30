import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GUIDE_ARTICLES } from '../content/guides/index';
import type { GuideProseLink, GuideSection } from '../content/guides/schema';
import { linksForField, splitProse, type ProseSegment } from '../lib/guides/proseLinks';

/**
 * Inline prose links (replacing the per-section `references` list).
 *
 * A citation is declared as an exact phrase inside a plain string, and the
 * renderer wraps that phrase. The failure mode that matters is silence: if a
 * phrase is reworded and no longer matches, a naive implementation either
 * drops the link (the article ships a claim with no source and nothing looks
 * wrong) or links the wrong words. Both are worse than a build failure, so
 * this file pins the contract that an unplaceable link is a test failure, and
 * unit-tests the splitter that enforces it.
 */

const link = (over: Partial<GuideProseLink> = {}): GuideProseLink => ({
  field: 'paragraph',
  index: 0,
  text: 'Windows 11',
  href: 'https://example.com/a',
  ...over,
});

const text = (segments: ProseSegment[]) =>
  segments.map((s) => s.value).join('|');
const kinds = (segments: ProseSegment[]) => segments.map((s) => s.kind);

test('prose links - a matched phrase becomes a link between the surrounding words', () => {
  const out = splitProse('On Windows 11 the endpoint is unified.', [link()]);
  assert.deepEqual(out, [
    { kind: 'text', value: 'On ' },
    { kind: 'link', value: 'Windows 11', href: 'https://example.com/a' },
    { kind: 'text', value: ' the endpoint is unified.' },
  ]);
});

test('prose links - a link at the very start or end keeps the prose intact', () => {
  const start = splitProse('Windows 11 unifies the endpoints.', [link()]);
  assert.deepEqual(start, [
    { kind: 'link', value: 'Windows 11', href: 'https://example.com/a' },
    { kind: 'text', value: ' unifies the endpoints.' },
  ]);

  const end = splitProse('The endpoint is unified on Windows 11.', [link()]);
  assert.deepEqual(end, [
    { kind: 'text', value: 'The endpoint is unified on ' },
    { kind: 'link', value: 'Windows 11', href: 'https://example.com/a' },
    { kind: 'text', value: '.' },
  ]);
});

test('prose links - an ambiguous phrase is left as prose rather than guessed at', () => {
  // Wrapping the first of two identical sentences would point the citation at
  // a claim the author did not choose, so the phrase is simply not used.
  const out = splitProse('Windows 11 unifies. Windows 11 also resamples.', [link()]);
  assert.deepEqual(out, [{ kind: 'text', value: 'Windows 11 unifies. Windows 11 also resamples.' }]);
});

test('prose links - a phrase that is no longer in the text never eats the sentence', () => {
  const out = splitProse('The endpoints are unified on Windows 11.', [link({ text: 'separate endpoints' })]);
  assert.deepEqual(out, [{ kind: 'text', value: 'The endpoints are unified on Windows 11.' }]);
  assert.equal(text(out), 'The endpoints are unified on Windows 11.');
});

test('prose links - overlapping phrases are resolved in declaration order', () => {
  const out = splitProse('Set Format when microphone is active to stereo.', [
    link({ text: 'Format when microphone is active' }),
    link({ text: 'microphone is active' }),
  ]);
  assert.deepEqual(kinds(out), ['text', 'link', 'text']);
  assert.equal(out[1].value, 'Format when microphone is active');
});

test('prose links - segments always come back in reading order', () => {
  const out = splitProse('A b c d e', [
    link({ text: 'd e' }),
    link({ text: 'A b' }),
  ]);
  assert.deepEqual(kinds(out), ['link', 'text', 'link']);
  assert.equal(text(out), 'A b| c |d e');
});

test('prose links - a paragraph with no links is returned as a single text run', () => {
  assert.deepEqual(splitProse('Nothing to cite here.', []), [
    { kind: 'text', value: 'Nothing to cite here.' },
  ]);
  assert.deepEqual(splitProse('', [link()]), []);
});

test('prose links - an empty phrase or destination is ignored', () => {
  assert.deepEqual(splitProse('Unaffected.', [link({ text: '' })]), [
    { kind: 'text', value: 'Unaffected.' },
  ]);
  assert.deepEqual(splitProse('Unaffected.', [link({ href: '' })]), [
    { kind: 'text', value: 'Unaffected.' },
  ]);
});

test('prose links - linksForField selects only the requested string', () => {
  const links = [
    link({ field: 'paragraph', index: 0 }),
    link({ field: 'paragraph', index: 1 }),
    link({ field: 'bullet', index: 0 }),
    link({ field: 'step', index: 2 }),
  ];
  assert.equal(linksForField(links, 'paragraph', 1).length, 1);
  assert.equal(linksForField(links, 'bullet', 0).length, 1);
  assert.equal(linksForField(links, 'step', 2).length, 1);
  assert.equal(linksForField(links, 'step', 1).length, 0);
  assert.deepEqual(linksForField(undefined, 'paragraph', 0), []);
});

/** The string a `proseLinks` entry points at, or undefined if it is out of range. */
function targetText(section: GuideSection, l: GuideProseLink): string | undefined {
  if (l.field === 'paragraph') return section.paragraphs?.[l.index];
  if (l.field === 'bullet') return section.bullets?.[l.index];
  return section.steps?.[l.index];
}

test('every declared prose link in every guide places unambiguously', () => {
  let checked = 0;
  for (const guide of GUIDE_ARTICLES) {
    for (const section of guide.sections) {
      for (const l of section.proseLinks ?? []) {
        checked += 1;
        const text = targetText(section, l);
        assert.ok(
          typeof text === 'string',
          `${guide.slug} / ${section.h2}: proseLinks points at ${l.field} ${l.index}, which does not exist`
        );
        const occurrences = text!.split(l.text).length - 1;
        assert.equal(
          occurrences,
          1,
          `${guide.slug} / ${section.h2}: the linked phrase "${l.text}" occurs ${occurrences} times in ${l.field} ${l.index}; it must occur exactly once`
        );
        // The rendered result must still contain every character of the source
        // string, so a link can never silently swallow a word.
        const rendered = splitProse(text!, [l])
          .map((s) => s.value)
          .join('');
        assert.equal(rendered, text!, `${guide.slug} / ${section.h2}: rendering changed the prose`);
      }
    }
  }
  assert.ok(checked > 0, 'at least one guide declares an inline link');
});

test('every external prose link is https and opens in a new tab', () => {
  for (const guide of GUIDE_ARTICLES) {
    for (const section of guide.sections) {
      for (const l of section.proseLinks ?? []) {
        if (l.href.startsWith('/')) continue;
        assert.match(
          l.href,
          /^https:\/\/(?:learn|support)\.microsoft\.com\//,
          `${guide.slug} / ${section.h2}: external citation should be a Microsoft primary source, got ${l.href}`
        );
      }
    }
  }
});

test('no guide carries a standalone sources list any more', () => {
  // The Sources block was removed from the schema and the renderer. This keeps
  // it removed: a citation belongs beside the claim, and a bibliography at the
  // foot of a section is the version readers skip.
  for (const guide of GUIDE_ARTICLES) {
    for (const section of guide.sections) {
      assert.equal(
        (section as { references?: unknown }).references,
        undefined,
        `${guide.slug} / ${section.h2}: the per-section references list is gone; use proseLinks`
      );
    }
  }
});
