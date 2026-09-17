import React from 'react';
import { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, Lock, HardDrive, EyeOff, Globe } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy Policy — DeviceTry',
    description: 'DeviceTry privacy policy: Zero cloud audio/video storage, client-side browser testing, and GDPR compliance.',
  };
}

export default function PrivacyPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 sm:p-10 shadow-sm space-y-8 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
          <div className="border-b border-[#DFE5EB] dark:border-[#223043] pb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy Commitment
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
              DeviceTry Privacy Policy
            </h1>
            <p className="mt-2 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Effective Date: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#0F766E]" />
              1. Zero Cloud Audio & Video Streaming
            </h2>
            <p>
              When you test your microphone, webcam, or speakers on DeviceTry, your audio waveforms and video feeds are processed strictly inside your computer’s browser memory via local WebRTC and Web Audio APIs. We never record, stream, save, or transmit your media streams to any server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#0F766E]" />
              2. Local Browser Storage
            </h2>
            <p>
              All hardware inspection history records for free tools are kept entirely in your device’s local browser storage. You can clear this data at any moment with the single click of the &ldquo;Clear All&rdquo; button in the Local History tab.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[#0F766E]" />
              3. No Tracking or Invasive Telemetry
            </h2>
            <p>
              We do not sell personal data, inject third-party ad trackers, or perform biometric surveillance. DeviceTry exists to provide instant, accessible hardware verification for professionals, remote workers, and technicians.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0F766E]" />
              4. Contact & Compliance
            </h2>
            <p>
              If you have any questions regarding privacy or browser permissions handling, you can contact us at privacy@devicetry.com.
            </p>
          </section>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
