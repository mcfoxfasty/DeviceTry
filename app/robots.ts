import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/pro/workspace'],
    },
    sitemap: 'https://devicetry.com/sitemap.xml',
  };
}
