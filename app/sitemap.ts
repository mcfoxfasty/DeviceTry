import { MetadataRoute } from 'next';
import { ALL_TOOL_PAGES } from '@/lib/tools/registry';
import { getPublishedGuides } from '@/lib/guides/registry';
import { listPosts } from '@/lib/blog/content';
import { BLOG_PATH } from '@/lib/blog/seo';
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

  // Published guides only — drafts never enter the sitemap.
  for (const guide of getPublishedGuides()) {
    sitemapEntries.push({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified: guide.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // CMS articles, read from the content collection rather than a hand-kept list,
  // so a published article cannot be missing here. `listPosts` reads front matter
  // only, which is every field a sitemap entry needs.
  for (const post of await listPosts()) {
    sitemapEntries.push({
      url: `${SITE_URL}${BLOG_PATH}/${post.slug}`,
      lastModified: post.publishedAt ? new Date(`${post.publishedAt}T00:00:00Z`) : SITE_LAST_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  return sitemapEntries;
}
