import { MetadataRoute } from 'next';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://devicetry.com';

  const pages = ['', '/about', '/privacy', '/terms', '/contact', '/inspection'];

  const sitemapEntries: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: page === '' ? 'daily' : 'weekly',
    priority: page === '' ? 1.0 : 0.7,
  }));

  // Dedicated per-tool pages for all 38 tools (canonical deep links)
  TOOLS_REGISTRY.forEach((tool) => {
    sitemapEntries.push({
      url: `${baseUrl}/test/${tool.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  });

  return sitemapEntries;
}
