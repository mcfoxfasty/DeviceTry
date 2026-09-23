/**
 * Central site URL configuration (Phase 9 corrections).
 *
 * SINGLE SOURCE OF TRUTH: sitemap, robots, layout metadata, and guide pages
 * all import SITE_URL from here. next.config.ts no longer defines or exports
 * a site URL of its own.
 *
 * Rules (no assumed production domain):
 * - NEXT_PUBLIC_SITE_URL is validated whenever it is set: it must be an
 *   absolute http(s) URL pointing at a site root (no path, query, or hash).
 * - Local development without the variable falls back to the honest local
 *   default http://localhost:3000 — localhost is NEVER accepted in a
 *   production build.
 * - A production build without the variable emits a loud build-time error and
 *   an RFC 2606 `.invalid` placeholder instead of silently claiming an
 *   unowned domain. Deployments MUST set NEXT_PUBLIC_SITE_URL to the
 *   confirmed public URL (see docs/phase9-migration.md).
 */

export function resolveSiteUrl(raw: string | undefined, nodeEnv: string | undefined): string {
  const isProduction = nodeEnv === 'production';
  const trimmed = raw?.trim().replace(/\/+$/, '');

  if (trimmed) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(
        `[site] NEXT_PUBLIC_SITE_URL is not a valid absolute URL: "${raw}". ` +
          'Set it to the confirmed public site root, e.g. https://example.com'
      );
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`[site] NEXT_PUBLIC_SITE_URL must use http(s), got "${parsed.protocol}"`);
    }
    if (!parsed.hostname) {
      throw new Error('[site] NEXT_PUBLIC_SITE_URL has no hostname');
    }
    if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
      throw new Error(
        `[site] NEXT_PUBLIC_SITE_URL must be a site root without a path, query, or hash: "${raw}"`
      );
    }
    const isLoopback =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]' ||
      parsed.hostname.endsWith('.localhost');
    if (isProduction && isLoopback) {
      throw new Error(
        '[site] NEXT_PUBLIC_SITE_URL must not be localhost in a production build. ' +
          'Set the confirmed public URL (see docs/phase9-migration.md).'
      );
    }
    return parsed.origin;
  }

  if (!isProduction) {
    // Honest local-development default; never used in production builds.
    return 'http://localhost:3000';
  }

  console.error(
    '[site] NEXT_PUBLIC_SITE_URL is NOT set for this production build. ' +
      'Canonical, Open Graph, sitemap, and robots URLs point at the ' +
      '"site-url-unset.invalid" placeholder and will not resolve. ' +
      'Set NEXT_PUBLIC_SITE_URL to the confirmed public URL before release ' +
      '(see docs/phase9-migration.md).'
  );
  return 'https://site-url-unset.invalid';
}

export const SITE_URL: string = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);

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
  { path: '/test-history', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/tests', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/guides', priority: 0.8, changeFrequency: 'weekly' },
];
