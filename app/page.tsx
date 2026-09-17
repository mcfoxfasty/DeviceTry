import React from 'react';
import type { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LandingClient } from '@/components/LandingClient';

export const metadata: Metadata = {
  title: 'DeviceTry — Free Online Mic, Webcam & Keyboard Tests',
  description:
    'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, and gamepad. 100% private, runs entirely in your browser.',
};

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
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar t={t} />

      <main className="flex-1">
        <LandingClient t={t} />
      </main>

      <Footer t={t} />
    </div>
  );
}
