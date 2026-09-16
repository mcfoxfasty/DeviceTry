import test from 'node:test';
import assert from 'node:assert/strict';
import { getDictionary, isValidLocale } from '../lib/i18n';
import { Locale, LOCALES } from '../lib/i18n/types';

test('i18n - Validates supported locales', () => {
  assert.strictEqual(isValidLocale('en'), true);
  assert.strictEqual(isValidLocale('fr'), true);
  assert.strictEqual(isValidLocale('ar'), true);
  assert.strictEqual(isValidLocale('de'), false);
});

test('i18n - Correct text directionality', () => {
  assert.strictEqual(LOCALES.en.dir, 'ltr');
  assert.strictEqual(LOCALES.fr.dir, 'ltr');
  assert.strictEqual(LOCALES.ar.dir, 'rtl');
});

test('i18n - Dictionary completeness across en, fr, and ar', () => {
  const en = getDictionary('en');
  const fr = getDictionary('fr');
  const ar = getDictionary('ar');

  // Verify core top-level keys exist in all 3 dictionaries
  const sections = ['common', 'nav', 'hero', 'micTest', 'webcamTest', 'keyboardTest', 'mouseTest', 'speakersTest', 'displayTest', 'gamepadTest', 'batteryTest', 'inspection', 'report', 'pricing', 'seo'] as const;

  for (const s of sections) {
    assert.ok(en[s], `Missing section ${s} in English dictionary`);
    assert.ok(fr[s], `Missing section ${s} in French dictionary`);
    assert.ok(ar[s], `Missing section ${s} in Arabic dictionary`);
  }

  // Verify hardware test titles
  assert.ok(en.micTest.title.length > 0);
  assert.ok(fr.micTest.title.length > 0);
  assert.ok(ar.micTest.title.length > 0);

  assert.ok(en.webcamTest.title.length > 0);
  assert.ok(fr.webcamTest.title.length > 0);
  assert.ok(ar.webcamTest.title.length > 0);

  assert.ok(en.batteryTest.healthDisclaimer.length > 0);
  assert.ok(fr.batteryTest.healthDisclaimer.length > 0);
  assert.ok(ar.batteryTest.healthDisclaimer.length > 0);
});
