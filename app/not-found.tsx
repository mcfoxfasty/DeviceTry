import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, ArrowLeft, LayoutGrid, BookOpen } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

/**
 * The page Next.js serves with a real HTTP 404 status for any route that does
 * not exist. Its own metadata replaces the site-wide title so the browser tab,
 * bookmarks and any share of the URL all say "Page not found" rather than
 * "DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests"; `noindex`
 * keeps a dead URL out of search results.
 */
export const metadata: Metadata = {
  title: 'Page Not Found (404) | DeviceTry',
  description:
    'That page does not exist on DeviceTry. Go back to the homepage, browse all 15 free device tests, or read the troubleshooting guides.',
  robots: { index: false, follow: true },
  // Its own Open Graph block. Without one the page inherited the site ROOT's
  // og:url and og:description, so a shared dead link claimed to be the
  // homepage — a title and description that contradicted this page.
  openGraph: siteOpenGraph({
    title: 'Page Not Found (404) | DeviceTry',
    description:
      'That page does not exist on DeviceTry. Go back to the homepage, browse all 15 free device tests, or read the troubleshooting guides.',
    type: 'website',
    url: `${SITE_URL}/404`,
  }),
};

export default function NotFound() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />

      <main id="main-content" className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-16 flex items-center">
        <div className="w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6]">
              <SearchX className="w-8 h-8" aria-hidden="true" />
            </div>

            <p className="text-5xl font-black tracking-tight text-[#142033] dark:text-[#E9EEF4]">404</p>

            <h1 className="text-xl sm:text-2xl font-bold">Page not found</h1>

            <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed max-w-lg mx-auto">
              This address does not match anything on DeviceTry. The link may be mistyped, or the page
              may have been renamed or removed. Every tester below still works and needs no account.
            </p>
          </div>

          <nav aria-label="Pages you can go to instead" className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to homepage
            </Link>
            <Link
              href="/tests"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] rounded-lg text-sm font-semibold transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
              Browse all 15 tests
            </Link>
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] rounded-lg text-sm font-semibold transition-colors"
            >
              <BookOpen className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
              Troubleshooting guides
            </Link>
          </nav>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}