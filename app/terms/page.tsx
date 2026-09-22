import React from 'react';
import { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FileText } from 'lucide-react';

/**
 * Fixed, human-controlled revision date. Do not compute from build time —
 * the text must only change when the terms themselves are actually revised.
 */
const TERMS_REVISED = 'September 18, 2026';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Terms of Service — DeviceTry',
    description: 'DeviceTry terms of service: Software scope, hardware testing disclaimers, and technical usage.',
  };
}

export default function TermsPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 sm:p-10 shadow-sm space-y-8 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
          <div className="border-b border-[#DFE5EB] dark:border-[#223043] pb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
              <FileText className="w-3.5 h-3.5" />
              Legal Terms
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
              DeviceTry Terms of Service
            </h1>
            <p className="mt-2 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Revised: {TERMS_REVISED}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using DeviceTry (this website), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              2. Scope of Browser-Based Hardware Diagnostics
            </h2>
            <p>
              DeviceTry provides client-side utility diagnostics using standard Web APIs. Browser-based testing measures the responsiveness and signal parameters exposed to web browsers by the operating system. It does not provide certified lab calibrations, hardware component disassembly verification, or physical electrical safety warranties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              3. Free Service — No Paid Tiers
            </h2>
            <p>
              Every diagnostic tool and the guided inspection are provided free of charge. There are no
              subscriptions, paid tiers, or premium features. DeviceTry does not process payments and does not
              require an account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              4. Local Data and Recordings
            </h2>
            <p>
              Inspection history is stored in your browser&rsquo;s local storage on your device. Any test
              recordings or snapshots are created locally in your browser and are only kept if you explicitly
              download them. DeviceTry does not receive, store, or process this data on any server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              5. Disclaimer of Warranties
            </h2>
            <p>
              DeviceTry is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind. DeviceTry disclaims all representations and warranties regarding hardware lifespan, used computer purchase disputes, or manufacturer defect claims.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
              6. Governing Law
            </h2>
            <p>
              These terms are governed by and construed in accordance with applicable laws without regard to conflict of law principles.
            </p>
          </section>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
