'use client';

import React from 'react';
import { ClipboardCheck, History } from 'lucide-react';
import { getDictionary } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GuidedInspectionFlow } from '@/components/inspection/GuidedInspectionFlow';
import { LocalHistoryList } from '@/components/LocalHistoryList';

export default function InspectionPage() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto pt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Structured Checklist • Printable Report • 100% Local
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#142033] dark:text-[#E9EEF4] tracking-tight">
            {t.inspection.title}
          </h1>
          <p className="mt-2 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            {t.inspection.subtitle}
          </p>
        </div>

        <GuidedInspectionFlow t={t} />

        <section>
          <h2 className="text-sm font-bold text-[#172033] dark:text-[#E9EEF4] uppercase tracking-wider mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
            Local Inspection History
          </h2>
          <LocalHistoryList t={t} />
        </section>
      </main>

      <Footer t={t} />
    </div>
  );
}
