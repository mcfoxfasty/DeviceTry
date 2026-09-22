import React from 'react';
import { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, Lock, HardDrive, EyeOff, Globe } from 'lucide-react';

/**
 * Fixed, human-controlled revision date. Do not compute from build time —
 * the text must only change when the policy itself is actually revised.
 */
const POLICY_REVISED = 'September 21, 2026';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy Policy — DeviceTry',
    description: 'DeviceTry privacy policy: client-side browser testing, local storage of inspection history, and how optional recordings are handled.',
  };
}

export default function PrivacyPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
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
              Revised: {POLICY_REVISED}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#0F766E]" />
              1. Media Streams Stay in Your Browser
            </h2>
            <p>
              When you test your microphone, webcam, or speakers on DeviceTry, the audio and video signals are
              analyzed strictly inside your browser, on your device, using standard Web APIs (WebRTC, Web Audio,
              MediaRecorder). DeviceTry has no server that receives your media: live streams are never uploaded
              or transmitted to us.
            </p>
            <p>
              Some testers let <em>you</em> create a recording for your own review — for example, a short
              microphone sample, a webcam snapshot, or a voice memo. These recordings are created and processed
              locally in your browser. They are never sent to DeviceTry. If you choose to keep one, you can
              download it to your own device; if you don&rsquo;t, it is discarded when you close or reload the page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#0F766E]" />
              2. Inspection History and Settings Stay in This Browser
            </h2>
            <p>
              Completed guided inspections are saved in your browser&rsquo;s local storage on this device, so you
              can review or print past reports without an account. Optional tool settings are also kept locally.
              This data is stored only in this browser: it is not synchronized anywhere and DeviceTry cannot see
              it. You can erase it at any time with the &ldquo;Clear All&rdquo; control in the inspection history,
              with the storage inspector in the site settings, or by clearing your browser&rsquo;s site data. Note
              that clearing browser data also removes saved inspections — keep a printed copy or a downloaded
              report if you need a durable record.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0F766E]" />
              3. What Does Leave Your Device
            </h2>
            <p>
              Most tools run entirely in your browser, but two features deliberately communicate over the
              Internet, and we describe them plainly rather than claiming &ldquo;nothing ever leaves your
              device&rdquo;:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[#142033] dark:text-[#E9EEF4]">What&rsquo;s My IP</strong> asks our own
                endpoint which public address your connection uses. The reply is shown to you only; DeviceTry does
                not store it in application storage or logs. Like any Internet request, the network operators and
                hosting infrastructure involved (including Cloudflare) process standard request metadata — such as
                the requesting IP and timestamp — under their own policies and retention rules, which are outside
                DeviceTry&rsquo;s control. The tool can also be used with a VPN or proxy, in which case the address
                shown is the VPN/proxy address.
              </li>
              <li>
                <strong className="text-[#142033] dark:text-[#E9EEF4]">Internet Speed Test</strong> transfers
                real test data to and from Cloudflare&rsquo;s public measurement network
                (speed.cloudflare.com) through the official Cloudflare speed test engine, only after you press
                Start. Cloudflare operates that service and collects measurement results for aggregated insights
                under its own terms and privacy policy; DeviceTry does not receive or store your measurements. The
                test can consume a substantial amount of mobile data.
              </li>
            </ul>
            <p>
              Feedback submissions never include recordings, images, clipboard contents, pressed-key content, or
              unnecessary identifiers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[#0F766E]" />
              4. No Tracking or Invasive Telemetry
            </h2>
            <p>
              We do not sell personal data, inject third-party ad trackers, or perform biometric surveillance.
              DeviceTry exists to provide instant, accessible hardware verification for professionals, remote
              workers, and technicians.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0F766E]" />
              5. Contact
            </h2>
            <p>
              DeviceTry does not operate a message inbox. The{' '}
              <a href="/contact" className="text-[#0F766E] dark:text-[#14B8A6] hover:underline font-semibold">
                contact page
              </a>{' '}
              explains how to prepare your question locally so you can send it to us from your own email
              application. We do not promise a specific response time.
            </p>
          </section>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
