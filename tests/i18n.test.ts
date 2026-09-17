import test from 'node:test';
import assert from 'node:assert/strict';
import { getDictionary, isValidLocale } from '../lib/i18n';
import { LOCALES, DEFAULT_LOCALE } from '../lib/i18n/types';

test('i18n - Site is English-only', () => {
  assert.strictEqual(isValidLocale('en'), true);
  assert.strictEqual(isValidLocale('fr'), false);
  assert.strictEqual(isValidLocale('ar'), false);
  assert.strictEqual(isValidLocale('de'), false);
  assert.strictEqual(DEFAULT_LOCALE, 'en');
});

test('i18n - Correct text directionality', () => {
  assert.strictEqual(LOCALES.en.dir, 'ltr');
  assert.strictEqual(LOCALES.en.localeString, 'en-US');
});

test('i18n - Dictionary completeness', () => {
  const en = getDictionary();

  // Verify core top-level keys exist
  const sections = ['common', 'nav', 'hero', 'landing', 'permissionPrompt', 'micTest', 'webcamTest', 'keyboardTest', 'mouseTest', 'speakersTest', 'displayTest', 'gamepadTest', 'batteryTest', 'inspection', 'report', 'pricing', 'seo', 'footer'] as const;

  for (const s of sections) {
    assert.ok(en[s], `Missing section ${s} in English dictionary`);
  }

  // Verify footer copyright was updated (no "2026" year mention)
  assert.ok(!en.footer.copyright.includes('2026'), 'Footer copyright should not mention a year');
});

test('i18n - No language mentions in site chrome or SEO', () => {
  const en = getDictionary();
  // Keyboard layout names (e.g. "Arabic 101") are hardware standards, not site languages,
  // so we check only chrome + SEO sections.
  const chromeSections = ['common', 'nav', 'hero', 'landing', 'footer', 'seo'] as const;
  const chrome = chromeSections.map((s) => JSON.stringify(en[s])).join(' ').toLowerCase();
  assert.ok(!chrome.includes('french'), 'Site chrome should not mention French');
  assert.ok(!chrome.includes('français'), 'Site chrome should not mention Français');
  assert.ok(!chrome.includes('language'), 'Site chrome should not mention language switchers');
});
