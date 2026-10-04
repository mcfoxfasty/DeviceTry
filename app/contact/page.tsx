'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, Copy, Download, Check, AlertTriangle, Info } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';

export default function ContactPage() {
  const t = getDictionary();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [topic, setTopic] = useState<string>('Technical Support');
  const [message, setMessage] = useState<string>('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  /** Clear the copy feedback. Held in a ref so a second click restarts the
   *  timer instead of stacking two timeouts that fight over the same state. */
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * Copy the composed message, and ALWAYS say what happened.
   *
   * The old handler set "Copied!" on success and did nothing at all on
   * failure: a denied clipboard permission, an insecure context, or a browser
   * without the async Clipboard API left the button looking untouched, which
   * reads as "my click did nothing" — the visitor assumes the copy worked and
   * pastes an empty clipboard into their email. A visible failure that points
   * at the working alternative (Download Message) is the honest outcome.
   */
  const handleCopy = async () => {
    const finish = (next: 'copied' | 'failed') => {
      setCopyState(next);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopyState('idle'), 4000);
    };

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(composedMessage);
      finish('copied');
    } catch {
      finish('failed');
    }
  };

  // Never leave a timer running into an unmount.
  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

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
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main id="main-content" className="flex-1 max-w-xl w-full mx-auto px-4 py-12">
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
          <a
            href="mailto:contact@devicetry.com"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline break-all"
          >
            <Mail className="w-4 h-4 shrink-0" />
            contact@devicetry.com
          </a>
        </div>

        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm">
          {/* Honest disclosure: nothing is transmitted from this page. */}
          <div className="mb-6 p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-start gap-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#0F766E] dark:text-[#14B8A6]" />
            <p className="text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
              This site runs entirely in your browser and has no message server. Nothing you type
              here is submitted or sent automatically — there is no form behind these fields. Fill
              in the form, use <span className="font-semibold">Copy Message</span> or{' '}
              <span className="font-semibold">Download Message</span> to keep your text, then send
              it to us yourself at{' '}
              <a
                href="mailto:contact@devicetry.com"
                className="font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline break-all"
              >
                contact@devicetry.com
              </a>
              . <span className="font-semibold">To send it:</span> tap{' '}
              <span className="font-semibold">Copy Message</span>, open your own email app, start a
              new message to contact@devicetry.com, and paste it in. Or tap{' '}
              <span className="font-semibold">Download Message</span> to save the text as a file and
              attach that file to an email to the same address.
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
                aria-describedby="contact-copy-status"
                className="py-2.5 bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copyState === 'copied' ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : copyState === 'failed' ? (
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy Message'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!message.trim()}
                className="py-2.5 bg-[#F6F7F9] dark:bg-[#192332] hover:border-[#0F766E] disabled:opacity-40 disabled:cursor-not-allowed border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Download Message
              </button>
            </div>

            {/* The outcome of the last copy attempt, in text as well as in the
                button label: a live region so it reaches a screen reader, and a
                failed copy names the action that still works. `min-h` reserves
                the row so appearing and disappearing text shifts nothing. */}
            <p
              id="contact-copy-status"
              role="status"
              aria-live="polite"
              className={`mt-2 min-h-[16px] text-[11px] leading-relaxed ${
                copyState === 'failed' ? 'text-amber-700 dark:text-amber-300' : 'text-[#5F6B7A] dark:text-[#9AA6B8]'
              }`}
            >
              {copyState === 'copied'
                ? 'Message copied to your clipboard. Paste it into your email app.'
                : copyState === 'failed'
                  ? 'Your browser blocked the copy. Select the text above, or use Download Message to save it as a file.'
                  : ''}
            </p>
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

          <p className="mt-3 text-[11px] text-[#8996A6] leading-relaxed">
            Email us at{' '}
            <a
              href="mailto:contact@devicetry.com"
              className="text-[#0F766E] dark:text-[#14B8A6] hover:underline font-semibold break-all"
            >
              contact@devicetry.com
            </a>{' '}
            — this page prepares your message locally, so you send it from your own email app.
          </p>
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
