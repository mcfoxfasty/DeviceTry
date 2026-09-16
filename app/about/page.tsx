import React from 'react';
import { Metadata } from 'next';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Cpu, ShieldCheck, Video, ShoppingBag, Wrench, CheckCircle } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About & Hardware Testing Methodology — DeviceTry',
    description: 'Learn how DeviceTry uses modern browser WebRTC, Web Audio, and Gamepad APIs to test peripherals with zero installation.',
  };
}

export default async function AboutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const subscriber = await getCurrentSubscriber();

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar
        t={t}
        currentLocale={locale}
        isPro={subscriber?.isPro}
        userEmail={subscriber?.user.email}
      />

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
              2. Buying and Selling Used Hardware
            </h2>
            <p>
              When purchasing a refurbished laptop from eBay, Facebook Marketplace, or an independent shop, testing all components within the 10-minute return window is critical. Our <strong>Guided Inspection Flow</strong> walks users through microphone clarity, webcam autofocus, keyboard matrix integrity, mouse switch chatter, stereo speaker channels, dead pixels, and battery health, producing a verifiable, printable condition certificate.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#0F766E]" />
              3. Deep Browser API Integration
            </h2>
            <p>
              DeviceTry interacts directly with browser runtime standards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
                <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">Web Audio & AnalyserNode</p>
                <p className="text-[11px] mt-1">Computes real-time FFT spectrums and RMS amplitude without transmitting sample buffers across the internet.</p>
              </div>

              <div className="p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
                <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">Gamepad & Input APIs</p>
                <p className="text-[11px] mt-1">Polls analog stick displacement down to 0.001 precision to reveal potentiometer dead zones and stick drift.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
