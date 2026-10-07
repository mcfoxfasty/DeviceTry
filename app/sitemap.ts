import { MetadataRoute } from 'next';
import { ALL_TOOL_PAGES } from '@/lib/tools/registry';
import { listPublishedArticles } from '@/lib/articles/registry';
import { SITE_URL, SITE_LAST_UPDATED, STATIC_PAGES } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: SITE_LAST_UPDATED,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Tool pages: primary catalog + supporting diagnostics. Retired routes are
  // structurally absent (they are no longer in any registry).
  for (const tool of ALL_TOOL_PAGES) {
    sitemapEntries.push({
      url: `${SITE_URL}/test/${tool.slug}`,
      lastModified: SITE_LAST_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Every published article, from one list. It used to be two loops — the guides
  // registry and the CMS collection — which meant two chances for a published
  // article to be missing from the sitemap, and two places to keep the
  // published-only rule. Drafts and archived articles are filtered where they are
  // read (lib/articles/registry.ts), so neither can reach this loop at all.
  for (const article of await listPublishedArticles()) {
    sitemapEntries.push({
      url: `${SITE_URL}/guides/${article.slug}`,
      lastModified: article.publishedAt ? new Date(`${article.publishedAt}T00:00:00Z`) : SITE_LAST_UPDATED,
      changeFrequency: 'monthly',
      // An imported guide is the site's own long-form work; a CMS article is the
      // same kind of page at a slightly lower priority, which is the ordering the
      // two loops used before they were merged.
      priority: article.source === 'guide' ? 0.7 : 0.6,
    });
  }

  return sitemapEntries;
}
