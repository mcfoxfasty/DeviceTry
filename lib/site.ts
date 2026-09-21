/**
 * Central site URL configuration (Phase 9, item K).
 *
 * Single source of truth: next.config.ts exports SITE_URL derived from the
 * NEXT_PUBLIC_SITE_URL environment variable, defaulting to the release
 * domain. Sitemap, robots, and JSON-LD consumers import from here so every
 * generated surface uses one validated value.
 *
 * The production domain is a release-configuration decision: if the final
 * public URL changes or is unavailable, set NEXT_PUBLIC_SITE_URL at deploy
 * time — do not hardcode a different domain in page code.
 */

export const SITE_URL: string = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://devicetry.com';

/**
 * Truthful last-modified dates for content surfaces (Phase 9, item K):
 * these are editorial dates maintained in code alongside the content they
 * describe — NOT a timestamp regenerated on every build.
 */
export const SITE_LAST_UPDATED = new Date('2026-09-21');

export const STATIC_PAGES: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/inspection', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/tests', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/guides', priority: 0.8, changeFrequency: 'weekly' },
];
