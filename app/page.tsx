import React from 'react';
import type { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LandingClient, HomeGuidePick } from '@/components/LandingClient';
import { getPublishedGuides } from '@/lib/guides/registry';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

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
    'Free online tests for microphone, webcam, keyboard, mouse, speakers, screen, gamepad, internet speed, and IP lookup — all in your browser.',
  alternates: {
    canonical: '/',
  },
  openGraph: siteOpenGraph({
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    // Identical to the meta description above. They used to differ, so a
    // search result and a social preview described the same page differently.
    description:
      'Free online tests for microphone, webcam, keyboard, mouse, speakers, screen, gamepad, internet speed, and IP lookup — all in your browser.',
    type: 'website',
    // Page-specific: without this the tag is omitted here, and on pages that
    // define no Open Graph block it silently inherits the site root.
    url: SITE_URL,
  }),
};

/**
 * Fixed decorative background — stationary viewport layer with geometric
 * outlines in the tool-icon green (#15803D light / #4ADE80 dark, matching
 * components/ui/ToolIcon.tsx). Content scrolls normally above it; the layer
 * itself never moves, never captures pointers, and is hidden from assistive
 * tech. No animation, no scroll handlers, no blur filters — the dark-mode
 * "neon" is a deliberately quiet pair of plain box-shadow halos (a tight core
 * plus a wide bloom) painted once behind the content. Brighter cores were
 * tried and rejected: the approved reference look is a thin lit line rather
 * than a glowing tube, so the outlines carry the least halo that still reads
 * as lit, and the corner ambience in globals.css carries the balance instead.
 *
 * The four outlines each carry one `.curve-spark` child. Making the dot a
 * CHILD of its own outline is what keeps the motion honest: the child is
 * positioned in the outline's own box and inherits its rotation, so the
 * `offset-path` curve in globals.css is written in that outline's local pixels
 * and traces the very border the visitor can see — at any viewport width,
 * with no second copy of the position classes to drift out of sync.
 *
 * Path coordinates in globals.css are the centreline of the 2px border
 * (border-box centre, radius reduced by the 1px half-border) expressed in the
 * padding-box origin an absolutely positioned child is placed against. Each
 * `curve-spark--*` modifier names the outline it belongs to; if you change an
 * outline's size, radius or rotation, update the matching path.
 */
function DecorativeBackground() {
  return (
    <div
      aria-hidden="true"
      className="homepage-geometry pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-52 -top-56 h-[42rem] w-[42rem] rounded-full border-2 border-[#15803D]/[0.20] dark:border-[#4ADE80]/[0.30] dark:shadow-[0_0_8px_rgba(74,222,128,0.12),0_0_60px_rgba(74,222,128,0.09)]">
        <span className="curve-spark curve-spark--circle" />
      </div>
      <div className="absolute -right-40 top-24 h-80 w-80 rotate-12 rounded-[4rem] border-2 border-[#15803D]/[0.17] dark:border-[#4ADE80]/[0.26] dark:shadow-[0_0_8px_rgba(74,222,128,0.12),0_0_40px_rgba(74,222,128,0.09)]">
        <span className="curve-spark curve-spark--disc" />
      </div>
      <div className="absolute -left-28 top-[42rem] h-44 w-[32rem] -rotate-12 rounded-full border-2 border-[#15803D]/[0.15] dark:border-[#4ADE80]/[0.22] dark:shadow-[0_0_8px_rgba(74,222,128,0.11),0_0_48px_rgba(74,222,128,0.08)]">
        <span className="curve-spark curve-spark--ellipse" />
      </div>
      <div className="absolute bottom-24 right-[12%] h-36 w-36 rotate-45 rounded-[2.5rem] border-2 border-[#15803D]/[0.17] dark:border-[#4ADE80]/[0.26] dark:shadow-[0_0_8px_rgba(74,222,128,0.12),0_0_36px_rgba(74,222,128,0.09)]">
        <span className="curve-spark curve-spark--diamond" />
      </div>
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

      <main id="main-content" className="flex-1 relative z-10">
        {/* No Suspense boundary here on purpose: LandingClient reads the query
            string without useSearchParams, so the whole homepage prerenders
            into this element. Behind a boundary the server still emits a
            60vh placeholder and appends the real page afterwards, which moved
            the footer and cost the whole CLS score. */}
        <LandingClient t={t} guides={pickHomeGuides()} />
      </main>

      <div className="relative z-10">
        <Footer t={t} />
      </div>
    </div>
  );
}
