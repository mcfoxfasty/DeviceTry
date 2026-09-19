'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Mail, Copy, Download, Check, Info } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';

export default function ContactPage() {
  const t = getDictionary();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [topic, setTopic] = useState<string>('Technical Support');
  const [message, setMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  /**
   * This form has no backend by design: DeviceTry is a fully client-side site,
   * so there is nothing to submit the message to. Instead, the composed message
   * can be copied or downloaded locally — nothing leaves the browser.
   */
  const composedMessage = useMemo(() => {
    return [
      'DeviceTry feedback',
      '-----------------',
      `From: ${name || '(not provided)'}`,
      `Reply email: ${email || '(not provided)'}`,
      `Topic: ${topic}`,
      '',
      message,
    ].join('\n');
  }, [name, email, topic, message]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — download still works.
    }
  };

  const handleDownload = () => {
    const blob = new Blob([composedMessage], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devicetry-feedback.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass =
    'w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-lg px-3 py-2 text-[#142033] dark:text-[#E9EEF4]';
  const labelClass = 'block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1';

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
            <Mail className="w-3.5 h-3.5" />
            Support &amp; Feedback
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
            Contact DeviceTry
          </h1>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            Questions about testing, permissions, or bug reports
          </p>
        </div>

        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm">
          {/* Honest disclosure: nothing is transmitted from this page. */}
          <div className="mb-6 p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-start gap-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#0F766E] dark:text-[#14B8A6]" />
            <p className="text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
              This site runs entirely in your browser and has no message server. Nothing you type
              here is submitted or sent anywhere. Fill in the form, then use{' '}
              <span className="font-semibold">Copy Message</span> or{' '}
              <span className="font-semibold">Download Message</span> to keep your text and send it
              to us yourself from your own email app.
            </p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-xs">
            <div>
              <label htmlFor="contact-name" className={labelClass}>
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-email" className={labelClass}>
                Your Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact-topic" className={labelClass}>
                Topic
              </label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={inputClass}
              >
                <option value="Technical Support">Technical Support &amp; Browser Diagnostics</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Feature Request">Feature Request / Device Support</option>
                <option value="Privacy">Privacy &amp; Permissions Question</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className={labelClass}>
                Message
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue in detail..."
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!message.trim()}
                className="py-2.5 bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Message'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!message.trim()}
                className="py-2.5 bg-[#F6F7F9] dark:bg-[#192332] hover:border-[#0F766E] disabled:opacity-40 disabled:cursor-not-allowed border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Message
              </button>
            </div>
          </form>

          <p className="mt-6 text-[11px] text-[#8996A6] leading-relaxed">
            Looking for quick answers? The FAQ on the{' '}
            <Link href="/" className="text-[#0F766E] dark:text-[#14B8A6] hover:underline font-semibold">
              home page
            </Link>{' '}
            and the{' '}
            <Link href="/privacy" className="text-[#0F766E] dark:text-[#14B8A6] hover:underline font-semibold">
              privacy policy
            </Link>{' '}
            cover most permission and storage questions.
          </p>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
