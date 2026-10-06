import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The CMS admin and its API have nothing to offer a crawler, and the login
      // screen would otherwise compete with real pages in results.
      disallow: ['/api/', '/keystatic'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
