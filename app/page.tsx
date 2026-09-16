import React from 'react';
import { Metadata } from 'next';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
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
  const initialTest = typeof params.test === 'string' ? params.test : 'mic';

  const subscriber = await getCurrentSubscriber();

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'DeviceTry',
        url: 'https://devicetry.com',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        offers: [
          {
            '@type': 'Offer',
            price: '0.00',
            priceCurrency: 'USD',
            description: 'Free browser-based hardware diagnostics without registration.',
          },
          {
            '@type': 'Offer',
            price: '9.00',
            priceCurrency: 'USD',
            description: 'DeviceTry Pro: Cloud history, custom PDF branding, and inventory tracking.',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Does DeviceTry record or store my webcam or microphone streams?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. All audio and video streams are processed completely in your browser memory via WebRTC and Web Audio APIs. Streams are never uploaded to any cloud server.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can browser tests replace hardware bench diagnostics?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'DeviceTry evaluates what the operating system and browser receive from connected peripherals. It identifies permission blocks, dead sensors, broken keys, stick drift, and audio distortion without voiding warranties.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar
        t={t}
        currentLocale={locale}
        isPro={subscriber?.isPro}
        userEmail={subscriber?.user.email}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HomeClient
          t={t}
          locale={locale}
          initialTab={initialTab}
          initialTest={initialTest}
          isPro={subscriber?.isPro}
          workspaceId={subscriber?.workspace.id}
          companyName={subscriber?.workspace.branding_company_name || undefined}
        />
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
