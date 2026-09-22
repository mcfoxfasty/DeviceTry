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
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base wash */}
      <div className="absolute inset-0 bg-[#F7F6FB] dark:bg-[#0B111A]" />
      {/* Pale teal circle — top left */}
      <div className="absolute -top-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-[#99F6E4] dark:bg-[#0F3D38] opacity-45 dark:opacity-20" />
      {/* Lavender arc — right edge (ring, not fill) */}
      <div className="absolute top-24 -right-40 w-[34rem] h-[34rem] rounded-full border-[3rem] border-[#DDD6FE] dark:border-[#221E3D] opacity-55 dark:opacity-25" />
      {/* Soft peach form — bottom left edge */}
      <div className="absolute -bottom-40 left-[8%] w-[24rem] h-[24rem] rounded-[38%] bg-[#FED7AA] dark:bg-[#3A2617] opacity-40 dark:opacity-15" />
      {/* Amber dot cluster — mid-right edge */}
      <div className="absolute top-[58%] -right-10 w-40 h-40 rounded-full bg-[#FDE68A] dark:bg-[#3A2E12] opacity-35 dark:opacity-15" />
      {/* Small teal echo circle — lower center-left */}
      <div className="absolute bottom-[12%] left-[38%] w-24 h-24 rounded-full border-8 border-[#99F6E4] dark:border-[#0F3D38] opacity-40 dark:opacity-20" />
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
