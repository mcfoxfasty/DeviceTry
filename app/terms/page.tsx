import React from 'react';
import { Metadata } from 'next';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FileText, ShieldCheck } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Terms of Service — DeviceTry',
    description: 'DeviceTry terms of service: Software scope, hardware testing disclaimers, and UK commercial billing.',
  };
}

export default async function TermsPage({ searchParams }: PageProps) {
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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 sm:p-10 shadow-sm space-y-8 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
          <div className="border-b border-[#DFE5EB] dark:border-[#223043] pb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
              <FileText className="w-3.5 h-3.5" />
              Terms of Service
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#142033] dark:text-[#E9EEF4]">
              DeviceTry Terms of Service
            </h1>
            <p className="mt-2 text-xs text-[#8996A6]">
              Governing Entity: UK Registered Commercial Operation • Last Revised: {new Date().getFullYear()}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing DeviceTry (&quot;the Service&quot;), whether as a free visitor or a paying DeviceTry Pro subscriber, you agree to comply with these terms. If you disagree with any portion, you must cease using the website.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              2. Scope of Testing & Hardware Disclaimers
            </h2>
            <p>
              DeviceTry evaluates hardware signals as exposed by the client operating system and web browser environment (via WebRTC, Web Audio, Gamepad, and DOM input APIs).
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Browser Layer vs. Bench Diagnostics:</strong> DeviceTry tests whether peripherals transmit functional streams to software. A pass indication means the browser can communicate with the hardware without error; it is not a warranty or guarantee against internal electrical, thermal, or intermittent physical degradation.
              </li>
              <li>
                <strong>No Liability for Hardware Purchases:</strong> If you use DeviceTry to evaluate used computers or peripherals before buying or selling, DeviceTry accepts no liability for transactions, disputes, or latent hardware defects discovered after testing.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              3. DeviceTry Pro Subscriptions & Card Payments
            </h2>
            <p>
              DeviceTry Pro is billed at $9 USD per month on a recurring 30-day basis.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Payment Processing:</strong> Card payments are securely processed via Stripe. All major credit and debit cards (Visa, Mastercard, American Express, Discover) are accepted with 256-bit encryption and PCI-DSS compliance.
              </li>
              <li>
                <strong>Cancellation:</strong> You may cancel your subscription at any time with one click through the Stripe Customer Portal accessible in your workspace dashboard. Cancellation takes effect at the end of the current paid billing cycle.
              </li>
              <li>
                <strong>Fair Use Limits:</strong> Pro accounts include a generous quota of 200 new inspections per month, up to 1,000 retained cloud records, up to 200 managed inventory devices, and 25 checklist templates.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              4. Governing Law
            </h2>
            <p>
              These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising out of these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>
        </div>
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
