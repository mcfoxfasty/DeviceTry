import React from 'react';
import { Metadata } from 'next';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/types';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HomeClient } from '@/components/HomeClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  return {
    title: t.seo.metaTitleHome,
    description: t.seo.metaDescHome,
    keywords: [
      'mic test',
      'webcam test',
      'keyboard test',
      'online microphone test',
      'test camera online',
      'mouse double click test',
      'dead pixel test',
      'gamepad tester',
      'hardware inspection',
      'used laptop test',
    ],
    openGraph: {
      title: t.seo.metaTitleHome,
      description: t.seo.metaDescHome,
      type: 'website',
      locale: LOCALES[locale].localeString,
    },
    twitter: {
      card: 'summary_large_image',
      title: t.seo.metaTitleHome,
      description: t.seo.metaDescHome,
    },
  };
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  const initialTab = typeof params.tab === 'string' ? params.tab : 'tests';
  const initialTest = typeof params.test === 'string' ? params.test : 'microphone-test';

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'DeviceTry - Hardware & Peripheral Diagnostic Suite',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All (Browser-Based)',
    browserRequirements: 'Requires modern browser with WebRTC and Web Audio support',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: t.seo.metaDescHome,
  };

  const isRtl = LOCALES[locale].dir === 'rtl';

  return (
    <div
      dir={LOCALES[locale].dir}
      className={`min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar t={t} currentLocale={locale} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HomeClient
          t={t}
          locale={locale}
          initialTab={initialTab}
          initialTest={initialTest}
        />
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
