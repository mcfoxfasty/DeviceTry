import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SubscribeForm } from '@/components/pro/SubscribeForm';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscribe — DeviceTry Pro',
    description: 'Subscribe to DeviceTry Pro to activate cloud hardware inspections, customized PDF reports, and inventory management.',
  };
}

export default async function SubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  const subscriber = await getCurrentSubscriber();
  if (subscriber?.isPro) {
    redirect(`/pro/workspace?lang=${locale}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar t={t} currentLocale={locale} />

      <main className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
            Subscribe to DeviceTry Pro
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1.5 max-w-md mx-auto">
            Upgrade to Pro to save hardware inspection histories, brand PDF certificates, and manage device inventories.
          </p>
        </div>

        <SubscribeForm t={t} currentLocale={locale} />
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
