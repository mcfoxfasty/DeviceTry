/**
 * Phase 9 guides system (item I): one content file per article under
 * content/guides/, a shared article template, and this central registry.
 *
 * Schema rules:
 * - `published: false` drafts NEVER enter public listings or the sitemap.
 * - Dates are truthful editorial dates, not build timestamps.
 * - Articles reference product IDs (from lib/products/registry.ts), never
 *   duplicated purchase URLs.
 * - `hasAffiliateLinks` marks articles that render affiliate buttons; the
 *   affiliate disclosure is shown only for those.
 */

import { GUIDE_ARTICLES, GuideArticle } from '@/content/guides/index';
import type { GuideCategory, GuideType } from '@/content/guides/schema';

export type { GuideArticle, GuideCategory, GuideType };

export function getAllGuides(): GuideArticle[] {
  return GUIDE_ARTICLES;
}

export function getPublishedGuides(): GuideArticle[] {
  return GUIDE_ARTICLES.filter((g) => g.published);
}

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((g) => g.slug === slug && g.published);
}

export function getGuidesByCategory(category: GuideCategory): GuideArticle[] {
  return getPublishedGuides().filter((g) => g.category === category);
}

export const GUIDE_CATEGORIES: Array<{ key: GuideCategory; label: string }> = [
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'input-gaming', label: 'Input & Gaming' },
  { key: 'display', label: 'Display' },
  { key: 'network', label: 'Network' },
];

export const GUIDE_TYPES: Array<{ key: GuideType; label: string }> = [
  { key: 'troubleshooting', label: 'Troubleshooting' },
  { key: 'how-to', label: 'How-to & Understanding Results' },
  { key: 'buying', label: 'Buying Guide' },
];
