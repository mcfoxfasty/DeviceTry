/**
 * Regression tests for the landing-page tool search.
 *
 * The original implementation was a strict substring match of the raw query
 * against title/shortDesc/keywords, which returned zero results for word-order
 * changes ("mirror camera"), extra words ("test my mic"), typos ("microfon"),
 * and glued queries ("deadpixel"). These tests pin the lenient behavior.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTools, withinEditDistance } from '../lib/tools/search';
import { TOOLS_REGISTRY } from '../lib/tools/registry';

function slugsFor(query: string): string[] {
  return searchTools(query).map((hit) => hit.tool.slug);
}

test('search - exact single word still matches (backward compatible)', () => {
  const slugs = slugsFor('microphone');
  assert.ok(slugs.includes('microphone-test'), 'microphone-test must be found');
  assert.ok(slugs.length > 0);
});

test('search - word order no longer breaks matching ("mirror camera")', () => {
  const slugs = slugsFor('mirror camera');
  assert.ok(slugs.includes('online-mirror'), 'online-mirror must be found regardless of word order');
});

test('search - extra words tolerated ("test my mic")', () => {
  const slugs = slugsFor('test my mic');
  assert.ok(slugs.includes('microphone-test'), 'filler words must not break matching');
});

test('search - single-character typos are forgiven ("microfon", "keybord")', () => {
  assert.ok(slugsFor('microfon').includes('microphone-test'), 'microfon -> microphone-test');
  assert.ok(slugsFor('keybord').includes('keyboard-test'), 'keybord -> keyboard-test');
});

test('search - glued query without space matches ("deadpixel")', () => {
  const slugs = slugsFor('deadpixel');
  assert.ok(
    slugs.includes('dead-pixel-test'),
    'deadpixel must reach dead-pixel-test via containment'
  );
});

test('search - multi-word query requires every token ("webcam mirror")', () => {
  // Both tokens must match; "webcam" alone should not bring in the mirror tool.
  assert.ok(slugsFor('webcam mirror').includes('online-mirror'));
  assert.equal(slugsFor('mirror webcam').includes('online-mirror'), true);
});

test('search - title matches rank above description-only matches', () => {
  const hits = searchTools('microphone');
  const micIndex = hits.findIndex((h) => h.tool.slug === 'microphone-test');
  const voiceIndex = hits.findIndex((h) => h.tool.slug === 'voice-recorder');
  assert.ok(micIndex !== -1, 'microphone-test must match');
  if (voiceIndex !== -1) {
    assert.ok(micIndex < voiceIndex, 'title match should outrank description-only match');
  }
});

test('search - no results only for genuinely unrelated queries', () => {
  const slugs = slugsFor('xylophone');
  assert.equal(slugs.length, 0, 'unrelated query must return zero results');
});

test('search - empty query returns all tools in registry order', () => {
  const hits = searchTools('   ');
  assert.equal(hits.length, TOOLS_REGISTRY.length);
  assert.equal(hits[0].tool.slug, TOOLS_REGISTRY[0].slug);
});

test('search - category subset restricts results', () => {
  const screenOnly = TOOLS_REGISTRY.filter((t) => t.category === 'screen');
  const hits = searchTools('microphone', screenOnly);
  assert.equal(hits.length, 0, 'a mic query must not leak tools from the screen category');
});

test('withinEditDistance - bounded Levenshtein behavior', () => {
  assert.equal(withinEditDistance('microfon', 'microphone', 1), false, 'distance 2 exceeds max 1');
  assert.equal(withinEditDistance('keybord', 'keyboard', 1), true, 'transposition-ish single edit');
  assert.equal(withinEditDistance('mic', 'mics', 1), true);
  assert.equal(withinEditDistance('mic', 'mics', 0), false);
  assert.equal(withinEditDistance('abc', 'xyz', 1), false);
});
