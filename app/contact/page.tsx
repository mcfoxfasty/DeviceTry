'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, MessageSquare, Send, CheckCircle, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';

export default function ContactPage() {
  const t = getDictionary();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('Support Request');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
            <Mail className="w-3.5 h-3.5" />
            Support & Inquiries
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
            Contact DeviceTry
          </h1>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            Questions regarding testing, Pro billing, or business partnership
          </p>
        </div>

        <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle className="w-12 h-12 text-[#0F766E] mx-auto" />
              <h2 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
                Thank you for your message
              </h2>
              <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] max-w-sm mx-auto">
                Our support team will respond to <span className="font-semibold">{email}</span> within 1 business day.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 px-4 py-2 bg-[#F6F7F9] dark:bg-[#192332] text-xs font-medium rounded-lg border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-lg px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-lg px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  Topic
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-lg px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
                >
                  <option value="Support Request">Technical Support & Browser Diagnostics</option>
                  <option value="Billing">Pro Billing & Invoices (Stripe)</option>
                  <option value="Feedback">Feature Request / Device Support</option>
                  <option value="Enterprise">Commercial Volume Licensing</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question or issue in detail..."
                  className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-lg px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send Message
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
