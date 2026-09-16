import { MetadataRoute } from 'next';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://devicetry.com';
  const locales = ['en', 'fr', 'ar'];

  const pages = [
    '',
    '/about',
    '/privacy',
    '/terms',
    '/contact',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Root & localized pages
  pages.forEach((page) => {
    locales.forEach((lang) => {
      sitemapEntries.push({
        url: `${baseUrl}${page}?lang=${lang}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : 0.7,
      });
    });
  });

  // Dedicated per-tool pages for all 38 tools (canonical deep links)
  TOOLS_REGISTRY.forEach((tool) => {
    locales.forEach((lang) => {
      sitemapEntries.push({
        url: `${baseUrl}/test/${tool.slug}?lang=${lang}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });
  });

  return sitemapEntries;
}
