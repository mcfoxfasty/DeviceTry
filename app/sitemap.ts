import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://devicetry.com';
  const locales = ['en', 'fr', 'ar'];

  const pages = [
    '',
    '/pro',
    '/about',
    '/privacy',
    '/terms',
    '/contact',
  ];

  const tests = [
    'mic',
    'webcam',
    'keyboard',
    'mouse',
    'speakers',
    'display',
    'gamepad',
    'battery',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Root & localized pages
  pages.forEach((page) => {
    locales.forEach((lang) => {
      sitemapEntries.push({
        url: `${baseUrl}${page}?lang=${lang}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : page === '/pro' ? 0.9 : 0.7,
      });
    });
  });

  // Dedicated test deep links
  tests.forEach((test) => {
    locales.forEach((lang) => {
      sitemapEntries.push({
        url: `${baseUrl}/?test=${test}&lang=${lang}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });
  });

  return sitemapEntries;
}
