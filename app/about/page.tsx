import React from 'react';
import { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Cpu, Video, ShoppingBag, Wrench, CheckCircle } from 'lucide-react';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const title = 'About & Hardware Testing Methodology — DeviceTry';
  const description =
    'Learn how DeviceTry uses modern browser WebRTC, Web Audio, and Gamepad APIs to test peripherals with zero installation.';
  return {
    title,
    description,
    alternates: { canonical: '/about' },
    openGraph: siteOpenGraph({ title, description, type: 'website', url: `${SITE_URL}/about` }),
  };
}

export default function AboutPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main id="main-content" className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
            <Cpu className="w-3.5 h-3.5" />
            Engineering Methodology
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
            How DeviceTry Works
          </h1>
          <p className="mt-2 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
            Browser-native diagnostics engineered for speed, privacy, and zero software friction.
          </p>
        </div>

        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 sm:p-10 shadow-sm space-y-8 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Video className="w-4 h-4 text-[#0F766E]" />
              1. Before Video Meetings (Zoom, Teams, Google Meet)
            </h2>
            <p>
              Video conferencing platforms usually fail quietly: an OS update revoked a permission, a background app grabbed the audio device, or a virtual camera driver is pointing at hardware that no longer exists. DeviceTry opens the same standard browser media APIs your call app uses, shows the input level and the resolution and frame rate actually being delivered, and lets you confirm by ear and by eye — so you know what to fix, rather than guessing your way into a meeting.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#0F766E]" />
              2. Buying or Selling Used Computer Hardware
            </h2>
            <p>
              When exchanging laptops on secondary marketplaces, both sides want evidence rather than adjectives. DeviceTry lets you record, in order: every key that fails to register, every pixel that stays dead across a full-screen pattern, and a real clip of what the microphone actually captures — all kept in your browser and exported as a printable report you can attach to the listing or the dispute.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#0F766E]" />
              3. Troubleshooting Audio & Peripheral Malfunctions
            </h2>
            <p>
              Is the game controller drifting? Is the mouse button double-registering? DeviceTry reads the raw input events in JavaScript and shows them as they arrive, so a chattery switch, an off-centre stick, and a healthy device look measurably different — before you install a vendor driver suite to fix something that was never the problem.
            </p>
          </section>

          <div className="border-t border-[#DFE5EB] dark:border-[#223043] pt-6 flex flex-wrap gap-4 text-xs font-medium text-[#142033] dark:text-[#E9EEF4]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#0F766E]" />
              {TOOLS_REGISTRY.length} core tests plus supporting diagnostics
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#0F766E]" />
              Zero Cloud Media Storage
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#0F766E]" />
              Works on Windows, macOS, Linux, ChromeOS & Mobile
            </div>
          </div>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
