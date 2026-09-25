import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LandingClient, HomeGuidePick } from '@/components/LandingClient';
import { getPublishedGuides } from '@/lib/guides/registry';

/** Homepage guide picks — real published articles, troubleshooting-first mix.
 *  Resolved on the server so full article content stays out of the client
 *  bundle; only slug/title/description/type cross the boundary. */
const HOME_GUIDE_SLUGS = [
  'microphone-not-working',
  'webcam-not-working',
  'controller-stick-drift',
  'checking-screen-dead-pixels',
  'budget-headphones',
  'low-internet-speed-result',
];

function pickHomeGuides(): HomeGuidePick[] {
  const published = getPublishedGuides();
  const bySlug = new Map(published.map((g) => [g.slug, g]));
  const picked = HOME_GUIDE_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (g): g is NonNullable<ReturnType<typeof bySlug.get>> => Boolean(g)
  );
  for (const g of published) {
    if (picked.length >= 6) break;
    if (!picked.includes(g)) picked.push(g);
  }
  return picked.slice(0, 6).map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
    type: g.type,
  }));
}

export const metadata: Metadata = {
  title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
  description:
    'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, gamepad, internet speed, and IP lookup. Tools run in your browser; nothing is uploaded unless a test says otherwise.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    description:
      'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, gamepad, internet speed, and IP lookup.',
    type: 'website',
  },
};

/**
 * Fixed decorative background — stationary viewport layer with subtle
 * DeviceTry-tinted geometric shapes. Content scrolls normally above it; the
 * layer itself never moves, never captures pointers, and is hidden from
 * assistive tech. No animation, no scroll handlers, no blur.
 */
function DecorativeBackground() {
  return (
    <div
      aria-hidden="true"
      className="homepage-geometry pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-52 -top-56 h-[42rem] w-[42rem] rounded-full border-2 border-[#0F766E]/20 dark:border-[#2DD4BF]/[0.16]" />
      <div className="absolute -right-40 top-24 h-80 w-80 rotate-12 rounded-[4rem] border-2 border-[#7C3AED]/20 dark:border-[#A78BFA]/[0.16]" />
      <div className="absolute -left-28 top-[42rem] h-44 w-[32rem] -rotate-12 rounded-full border-2 border-[#0F766E]/[0.16] dark:border-[#2DD4BF]/[0.13]" />
      <div className="absolute bottom-24 right-[12%] h-36 w-36 rotate-45 rounded-[2.5rem] border-2 border-[#D97706]/20 dark:border-[#FBBF24]/[0.14]" />
    </div>
  );
}

export default function HomePage() {
  const t = getDictionary();

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'DeviceTry - Hardware & Peripheral Diagnostic Tools',
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

  return (
    <div className="min-h-screen flex flex-col relative text-[#142033] dark:text-[#E9EEF4] font-sans">
      <DecorativeBackground />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar t={t} />

      <main className="flex-1 relative z-10">
        {/* useSearchParams inside LandingClient requires a Suspense boundary
            for static prerendering (missing-suspense-with-csr-bailout). */}
        <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" /> }>
          <LandingClient t={t} guides={pickHomeGuides()} />
        </Suspense>
      </main>

      <div className="relative z-10">
        <Footer t={t} />
      </div>
    </div>
  );
}
