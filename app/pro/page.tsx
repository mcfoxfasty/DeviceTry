import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle,
  ShieldCheck,
  Building2,
  HardDrive,
  Printer,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ProCheckoutButton } from '@/components/pro/ProCheckoutButton';
import { CardPaymentBadges } from '@/components/pro/CardPaymentBadges';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  return {
    title: 'DeviceTry Pro — Cloud Hardware Inspections & Branding',
    description: 'Save hardware inspection histories, brand PDF certificates with your company logo, and track device inventories.',
  };
}

export default async function ProPage({ searchParams }: PageProps) {
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            DeviceTry Pro Workspace
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t.pricing.proTitle}
          </h1>
          <p className="mt-3 text-base text-[#5F6B7A] dark:text-[#9AA6B8]">
            {t.pricing.proDesc}
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mt-10 max-w-lg mx-auto bg-white dark:bg-[#131B27] rounded-2xl border-2 border-[#0F766E] p-8 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#0F766E] text-white text-[11px] font-bold px-4 py-1 rounded-bl-lg uppercase tracking-wider">
            Popular for IT & Refurbishers
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono-num text-[#142033] dark:text-[#E9EEF4]">
              $9
            </span>
            <span className="text-sm font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
              USD / month
            </span>
          </div>

          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-2">
            Cancel anytime. Billed monthly with secure card processing by Stripe (Visa, Mastercard, Amex, Discover).
          </p>

          {/* Checkout CTA */}
          <div className="mt-6">
            <ProCheckoutButton
              isLoggedIn={!!subscriber}
              isPro={subscriber?.isPro}
              currentLocale={locale}
              subscribeText={t.pricing.proCta}
              workspaceText={t.proDashboard.manageBilling}
            />
          </div>

          {/* Key Features List */}
          <div className="mt-8 pt-6 border-t border-[#DFE5EB] dark:border-[#223043] space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Cloud Inspection History:</strong> Store up to 1,000 retained inspections with 200 new runs per month.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Custom Organization Branding:</strong> Display your business name and custom logo on printable inspection certificates.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Device Inventory Tracker:</strong> Maintain hardware records for up to 200 laptops, desktops, and displays.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Reusable Checklist Templates:</strong> Create up to 25 custom diagnostic checklist templates tailored for your workflows.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Full Data Portability:</strong> Export all inspections and device lists to standard JSON at any time.
              </span>
            </div>
          </div>
        </div>

        {/* Free vs Pro Comparison Table */}
        <div className="mt-16 bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
          <div className="p-6 border-b border-[#DFE5EB] dark:border-[#223043]">
            <h2 className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4]">
              {t.pricing.title}
            </h2>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
              {t.pricing.subtitle}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <th className="p-4 font-semibold">Feature / Capability</th>
                  <th className="p-4 font-semibold w-1/3">Free Visitor Service</th>
                  <th className="p-4 font-semibold w-1/3 text-[#0F766E] dark:text-[#14B8A6]">DeviceTry Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043] text-[#142033] dark:text-[#E9EEF4]">
                <tr>
                  <td className="p-4 font-medium">8 Device Diagnostic Tests</td>
                  <td className="p-4 text-emerald-600">Full Access (Unlimited)</td>
                  <td className="p-4 text-emerald-600 font-bold">Full Access (Unlimited)</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Guided Inspection Flow</td>
                  <td className="p-4 text-emerald-600">Included</td>
                  <td className="p-4 text-emerald-600 font-bold">Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Printable Reports</td>
                  <td className="p-4">Generic standard certificate</td>
                  <td className="p-4 font-bold text-[#0F766E] dark:text-[#14B8A6]">Custom Company Name & Logo</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Inspection History</td>
                  <td className="p-4 text-[#5F6B7A]">Browser memory / local cache only</td>
                  <td className="p-4 font-bold text-[#0F766E] dark:text-[#14B8A6]">1,000 Cloud Retained Records</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Device Inventory Manager</td>
                  <td className="p-4 text-slate-400">—</td>
                  <td className="p-4 font-bold text-[#0F766E] dark:text-[#14B8A6]">Up to 200 Managed Devices</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Custom Checklist Templates</td>
                  <td className="p-4 text-slate-400">—</td>
                  <td className="p-4 font-bold text-[#0F766E] dark:text-[#14B8A6]">Up to 25 Custom Templates</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">JSON Data Export</td>
                  <td className="p-4">Single local report</td>
                  <td className="p-4 font-bold text-[#0F766E] dark:text-[#14B8A6]">Complete Workspace Export</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Card Payment Providers & Security Notice */}
        <div className="mt-8">
          <CardPaymentBadges variant="full" />
        </div>
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
