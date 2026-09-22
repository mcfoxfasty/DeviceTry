import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { getPublishedGuides, GUIDE_CATEGORIES } from '@/lib/guides/registry';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Guides — Troubleshooting & Buying Advice | DeviceTry',
  description:
    'Practical troubleshooting guides and specification-based buying guides for microphones, webcams, keyboards, controllers, screens, and home networks.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Guides — Troubleshooting & Buying Advice | DeviceTry',
    description:
      'Practical troubleshooting guides and specification-based buying guides for microphones, webcams, keyboards, controllers, screens, and home networks.',
    type: 'website',
  },
};

export default function GuidesHub() {
  const t = getDictionary();
  const guides = getPublishedGuides();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold uppercase tracking-wider mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Guides
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fix it or pick better hardware</h1>
          <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            Step-by-step troubleshooting for hardware that misbehaves, and buying guides built on
            manufacturer specifications — no sponsored rankings, no invented ratings. Every guide links
            the free browser test that verifies the result.
          </p>
        </div>

        {GUIDE_CATEGORIES.map((cat) => {
          const catGuides = guides.filter((g) => g.category === cat.key);
          if (catGuides.length === 0) return null;
          return (
            <section key={cat.key} className="mt-10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#172033] dark:text-[#E9EEF4] mb-4">
                {cat.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catGuides.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="glass group p-4 rounded-xl border border-[#E2E8F0] dark:border-[#223043] hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] transition-all flex flex-col"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8996A6]">
                      {g.type === 'buying' ? 'Buying guide' : g.type === 'how-to' ? 'How-to' : 'Troubleshooting'}
                    </span>
                    <h3 className="mt-2 text-sm font-bold leading-snug text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6]">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#59677D] dark:text-[#9AA6B8] leading-relaxed line-clamp-3 flex-1">
                      {g.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F766E] dark:text-[#14B8A6]">
                      Read guide
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <Footer t={t} />
    </div>
  );
}
