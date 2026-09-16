import React from 'react';
import { Metadata } from 'next';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, Lock, HardDrive, EyeOff, Globe } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy Policy — DeviceTry',
    description: 'DeviceTry privacy policy: Zero cloud audio/video storage, client-side browser testing, and GDPR compliance.',
  };
}

export default async function PrivacyPage({ searchParams }: PageProps) {
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
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy by Architecture
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#142033] dark:text-[#E9EEF4]">
              DeviceTry Privacy Policy
            </h1>
            <p className="mt-2 text-xs text-[#8996A6]">
              Effective Date: {new Date().getFullYear()} • Governed under UK Data Protection Act 2018 & GDPR
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              1. Our Foundational Architecture: Zero Server Media Processing
            </h2>
            <p>
              DeviceTry is engineered with a strict client-side first architecture. When you run tests on your microphone, webcam, keyboard, mouse, audio speakers, display, gamepad, or battery:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>No Audio or Video Streaming:</strong> Audio signals and video streams are queried through your browser’s standard <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">navigator.mediaDevices.getUserMedia</code> and <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">AudioContext</code> APIs. All analysis (frequencies, RMS volume, resolution, frame rate) is calculated completely in your computer’s local memory.
              </li>
              <li>
                <strong>No Keylogging:</strong> Keystroke events captured in the keyboard tester are consumed solely within the browser DOM. No keystrokes, key combinations, or passwords are ever sent over network sockets.
              </li>
              <li>
                <strong>Immediate Disposal:</strong> As soon as a test stops or your browser tab closes, all media tracks are stopped and released by your operating system.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              2. Anonymous Visitors & Local Storage
            </h2>
            <p>
              For visitors using the free device tests without creating an account:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We perform <strong>zero database writes</strong> for anonymous runs.</li>
              <li>Inspection histories saved in the &quot;Local History&quot; tab reside exclusively in your browser’s local storage and IndexedDB. You can purge this data at any time by clicking &quot;Clear All&quot; or clearing your browser cache.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              3. Subscriber Accounts & Paid Billing
            </h2>
            <p>
              When you register for a DeviceTry Pro account ($9 USD/month):
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account Credentials:</strong> We store your email address, name, workspace branding preferences, and a cryptographically salted password hash (never plaintext).
              </li>
              <li>
                <strong>Payment Information:</strong> All payment transactions are handled directly by Stripe (PCI-DSS Level 1 certified card processing). We never collect, store, or have access to your full credit card number, CVV, or banking details.
              </li>
              <li>
                <strong>Inspection Records:</strong> For Pro subscribers, structured inspection JSON results (pass/fail status, device label, date) are stored in our encrypted database so you can access them across devices.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              4. Cookies and Advertising
            </h2>
            <p>
              We use strictly necessary first-party cookies to maintain subscriber login sessions (using secure HttpOnly, SameSite=Lax flags) and preserve language selections.
            </p>
            <p>
              In accordance with Google AdSense guidelines, when non-intrusive advertising is enabled, third-party vendors including Google may use cookies to serve ads based on prior visits to our website. You may opt out of personalized advertising by visiting Google’s Ads Settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] uppercase tracking-wider">
              5. Your Rights: Export & Right to Be Forgotten
            </h2>
            <p>
              Under the UK GDPR and international privacy statutes, you hold complete control over your data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Data Portability:</strong> You can download a complete JSON export of all your workspace records, device inventories, and inspection logs directly from your workspace dashboard.
              </li>
              <li>
                <strong>Right to Erasure:</strong> You can permanently cascade-delete your subscriber account, workspace, and all stored inspection records with a single confirmation in the &quot;Danger Zone&quot; tab.
              </li>
            </ul>
          </section>
        </div>
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
