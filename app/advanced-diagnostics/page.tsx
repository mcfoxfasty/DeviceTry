import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Info, LayoutGrid, ShieldCheck, Wrench } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { SUPPORTING_REGISTRY, TOOLS_REGISTRY } from '@/lib/tools/registry';
import { ToolAssetIcon } from '@/components/ui/ToolAssetIcon';

export const metadata: Metadata = {
  title: 'Advanced Diagnostics — Browser Capability Checks | DeviceTry',
  description:
    'Six supporting browser diagnostics kept outside the main tool catalog: permission states, web API compatibility, codec support, a local WebRTC loopback check, system info, and DeviceTry’s own storage inspector.',
  alternates: { canonical: '/advanced-diagnostics' },
  openGraph: {
    title: 'Advanced Diagnostics — Browser Capability Checks | DeviceTry',
    description:
      'Six supporting browser diagnostics kept outside the main tool catalog: permission states, web API compatibility, codec support, a local WebRTC loopback check, system info, and DeviceTry’s own storage inspector.',
    type: 'website',
    url: `${SITE_URL}/advanced-diagnostics`,
    siteName: 'DeviceTry',
  },
};

/**
 * Focus indicator for the interactive surfaces on this page.
 *
 * The `.glass` surface owns `box-shadow` in globals.css, so Tailwind's
 * `ring-*` utilities (which draw through box-shadow) are overridden by it —
 * this is the same outline treatment the homepage tool cards use. Never add
 * `outline-none` next to these: it shares `--tw-outline-style` with
 * `outline-2` and cancels the outline out entirely.
 */
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] dark:focus-visible:outline-[#14B8A6]';

/**
 * Standalone home for the six supporting diagnostics.
 *
 * These pages exist outside the primary catalog on purpose: the catalog count
 * is the number of hardware tests a visitor can run, and these are the checks
 * that explain why one of those tests might not work. The list is rendered
 * from SUPPORTING_REGISTRY, so a tool can never appear here with copy that
 * disagrees with its own page, and no tool can be silently dropped.
 *
 * Copy rules applied here: each card shows the registry's own description plus
 * that tool's first registered limitation, which is where the honest scope
 * statements live (the WebRTC card must never read as an IP-leak test).
 */
export default function AdvancedDiagnosticsPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" />
            {t.nav.advancedDiagnostics}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Six browser diagnostics that explain the hardware tests
          </h1>
          <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            These six diagnostics are deliberately kept out of the main catalog, whose count is the
            number of hardware tests you can run ({TOOLS_REGISTRY.length} tools). Each one answers a
            question that comes up around those tests — whether a permission is blocked, what your
            browser can actually do, which call codecs it handles, whether WebRTC works locally,
            what it exposes about itself, and what DeviceTry has stored in this browser.
          </p>
        </div>

        <section aria-labelledby="diagnostics-heading" className="mt-10">
          <h2
            id="diagnostics-heading"
            className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.nav.advancedDiagnostics}
            <span className="text-[10px] text-[#8996A6] font-semibold">
              ({SUPPORTING_REGISTRY.length})
            </span>
          </h2>

          <div className="mt-4 grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-3">
            {SUPPORTING_REGISTRY.map((tool) => (
              <Link
                key={tool.id}
                href={`/test/${tool.slug}`}
                /* Whole-card link: one tab stop per tool, activated with Enter.
                   `tool-card` adds the homepage's hover lift and its
                   focus-visible border highlight. */
                className={`glass tool-card group relative flex flex-col p-5 rounded-xl border border-[#E2E8F0] dark:border-[#223043] hover:border-[#0F766E]/50 dark:hover:border-[#14B8A6]/50 hover:shadow-md transition-all ${FOCUS_RING}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F2] dark:bg-[#133230] group-hover:scale-105 transition-transform">
                    <ToolAssetIcon slug={tool.slug} size={40} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6]">
                      {tool.title}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8996A6] dark:text-[#677589]">
                      {tool.supportHint}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
                  {tool.shortDesc}
                </p>
                {tool.limitations[0] && (
                  <p className="mt-2 text-[11px] text-[#8996A6] dark:text-[#677589] leading-relaxed">
                    {tool.limitations[0]}
                  </p>
                )}

                <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-[#14B8A6]">
                  Open the check
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Scope: what these checks do and do not do. Sits after the cards so
            the six tools read first and the caveats qualify what was just
            listed. Kept factual — every statement here matches the
            implementation of the tool it names. */}
        <section
          aria-labelledby="scope-heading"
          className="mt-10 glass p-5 sm:p-6 rounded-xl border border-[#E2E8F0] dark:border-[#223043]"
        >
          <h2
            id="scope-heading"
            className="text-xs font-bold uppercase tracking-wider text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2"
          >
            <Info className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            What these checks do — and what they do not
          </h2>
          <ul className="mt-3 space-y-2.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#0F766E] dark:text-[#14B8A6] shrink-0">•</span>
              <span>
                <strong className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
                  They stay on your device.
                </strong>{' '}
                None of the six requests microphone or camera access, and none uploads anything.
                Permission Diagnostics reads the permission state your browser already holds rather
                than triggering a prompt, and the Storage Inspector only reports what DeviceTry
                itself has saved locally.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#0F766E] dark:text-[#14B8A6] shrink-0">•</span>
              <span>
                <strong className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
                  The WebRTC check is a local capability test, not a leak test.
                </strong>{' '}
                It creates two peer connections inside your own browser with no external STUN or
                TURN server, exchanges an SDP offer and answer, opens a data channel and passes five
                messages through it. It reports handshake time, roundtrip timing and the ICE
                candidate types it gathered — it does not test for IP leaks, VPN behavior or DNS.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#0F766E] dark:text-[#14B8A6] shrink-0">•</span>
              <span>
                <strong className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
                  Capability is not a guarantee.
                </strong>{' '}
                A browser can report support for an API or codec and still behave differently in
                practice, so read these results as what your browser claims it can do — not as a
                performance measurement.
              </span>
            </li>
          </ul>
        </section>

        <p className="mt-10 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
          Looking for a device test instead?{' '}
          <Link
            href="/tests"
            className={`inline-flex items-center gap-1.5 font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline rounded ${FOCUS_RING}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Browse all {TOOLS_REGISTRY.length} tools
          </Link>
        </p>
      </main>

      <Footer t={t} />
    </div>
  );
}
