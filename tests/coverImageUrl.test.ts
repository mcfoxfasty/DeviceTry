/**
 * coverImageUrl — the one resolver every card cover goes through.
 *
 * A guide's featuredImage.src is a BASE path (/guides/<slug>-hero): the files
 * that actually exist are suffixed -<width>.webp (plus a theme segment for a
 * drawn diagram). Handing the bare base to an <img> was a guaranteed 404 — the
 * broken-image icons in the hub cards and the related-articles carousel. The
 * resolver must also pass through real files (/uploads/…) and external URLs
 * unchanged, and normalize a missing leading slash.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { coverImageUrl, listPublishedArticles } from '../lib/articles/registry';

test('cover images - a photo featured image resolves to a file that exists', () => {
  // The exact values the two imported guides with photo leads declare.
  for (const base of ['/guides/microphone-not-working-hero', '/guides/bluetooth-headphones-no-sound-windows-11-hero']) {
    const url = coverImageUrl(base, 'photo');
    assert.ok(url.startsWith('/guides/'), `${base} resolves inside /guides (got ${url})`);
    assert.match(url, /-480\.webp$/, 'the fallback is the smallest shipped width');
    assert.ok(existsSync(join('public', url)), `${url} must exist on disk (the old bare base did not)`);
  }
});

test('cover images - a diagram featured image resolves to its LIGHT variant', () => {
  const url = coverImageUrl('/guides/microphone-not-working-signal-arrives', 'diagram');
  assert.match(url, /-light-480\.webp$/, 'a diagram card uses the light raster, as the social card does');
  assert.ok(existsSync(join('public', url)), `${url} must exist on disk`);
});

test('cover images - a CMS /uploads cover and external URLs pass through unchanged', () => {
  assert.equal(coverImageUrl('/uploads/keyboard-hardware-or-software.png'), '/uploads/keyboard-hardware-or-software.png');
  assert.equal(coverImageUrl('https://cdn.example.com/cover.png'), 'https://cdn.example.com/cover.png');
  assert.equal(coverImageUrl(''), '', 'no cover stays no cover');
});

test('cover images - a missing leading slash is normalized against the site root', () => {
  assert.equal(coverImageUrl('uploads/cover.png'), '/uploads/cover.png');
  assert.equal(coverImageUrl('guides/hero', 'photo'), '/guides/hero-480.webp');
});

test('cover images - every cover the published-article list hands to a card exists on disk', async () => {
  // The hub, the homepage picks and the related-articles carousel all render
  // `coverImage` verbatim, so this list decides whether a card 404s. A guide
  // whose featuredImage OMITS `kind` is a diagram by the schema's default, and
  // that is the case this catches: the bare resolver would pass the base path
  // through, so the callers resolve `kind ?? 'diagram'`.
  const refs = await listPublishedArticles();
  assert.ok(refs.length > 0, 'the registry lists at least one article');

  for (const ref of refs) {
    if (!ref.coverImage || /^https?:/i.test(ref.coverImage)) continue;
    assert.ok(
      existsSync(join('public', ref.coverImage)),
      `${ref.source} "${ref.slug}": card cover ${ref.coverImage} must exist on disk`
    );
  }
});
