import React from 'react';
import { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Cpu, Video, ShoppingBag, Wrench, CheckCircle } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About & Hardware Testing Methodology — DeviceTry',
    description: 'Learn how DeviceTry uses modern browser WebRTC, Web Audio, and Gamepad APIs to test peripherals with zero installation.',
  };
}

export default function AboutPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
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
              Video conferencing platforms fail primarily due to OS permission revocation, background audio exclusivity locks, or virtual camera misconfigurations. DeviceTry initializes standard browser media streams with clean constraints, measures live RMS vocal decibels, and computes actual render framerates, ensuring you enter important meetings with 100% confidence.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#0F766E]" />
              2. Buying or Selling Used Computer Hardware
            </h2>
            <p>
              When exchanging laptops on secondary marketplaces, buyers and sellers need transparent verification that keys don&apos;t chatter, the display has zero stuck subpixels, the microphone records voice clearly, and the battery health is reporting valid discharge rates.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#0F766E]" />
              3. Troubleshooting Audio & Peripheral Malfunctions
            </h2>
            <p>
              Is the game controller drifting? Is the mouse wheel misfiring? DeviceTry isolates hardware input events directly in JavaScript, eliminating guesswork and vendor-bloat driver suites.
            </p>
          </section>

          <div className="border-t border-[#DFE5EB] dark:border-[#223043] pt-6 flex flex-wrap gap-4 text-xs font-medium text-[#142033] dark:text-[#E9EEF4]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#0F766E]" />
              38 Pure Client Diagnostic Tools
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
