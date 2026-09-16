import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WorkspaceDashboard } from '@/components/pro/WorkspaceDashboard';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Workspace — DeviceTry Pro',
    description: 'Manage saved hardware inspections, device inventories, and custom PDF certificate branding.',
  };
}

export default async function WorkspacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  const subscriber = await getCurrentSubscriber();
  if (!subscriber) {
    redirect(`/pro/signin?lang=${locale}`);
  }

  // Load initial workspace data
  const [inspectionsData, devices, templates, subscription] = await Promise.all([
    db.getInspections(subscriber.workspace.id, 100),
    db.getDevices(subscriber.workspace.id),
    db.getTemplates(subscriber.workspace.id),
    db.getSubscription(subscriber.workspace.id),
  ]);

  const usage = {
    currentMonthCount: inspectionsData.total,
    maxMonthlyLimit: 200,
    totalRetained: inspectionsData.total,
    maxRetainedLimit: 200,
    devicesCount: devices.length,
    maxDevicesLimit: 200,
    templatesCount: templates.length,
    maxTemplatesLimit: 25,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4]">
      <Navbar
        t={t}
        currentLocale={locale}
        isPro={subscriber.isPro}
        userEmail={subscriber.user.email}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkspaceDashboard
          t={t}
          locale={locale}
          user={subscriber.user}
          workspace={subscriber.workspace}
          isPro={subscriber.isPro}
          subscriptionStatus={subscription?.status || 'inactive'}
          renewsAt={subscription?.current_period_end}
          usage={usage}
          initialInspections={inspectionsData.items}
          initialDevices={devices}
          initialTemplates={templates}
        />
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
