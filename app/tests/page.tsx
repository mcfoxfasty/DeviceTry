import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';
import { CATEGORY_META } from '@/lib/tools/categories';
import { DeviceIllustration } from '@/components/ui/DeviceIllustration';

export const metadata: Metadata = {
  title: 'All Tools — Free Online Device Tests | DeviceTry',
  description:
    'Browse all 15 free browser-based device tests: microphone, webcam, speakers, keyboard, mouse, gamepad, touchscreen, click speed, reaction time, screen, refresh rate, internet speed, and IP lookup.',
  alternates: { canonical: '/tests' },
};

export default function TestsHub() {
  const t = getDictionary();

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold uppercase tracking-wider mb-4">
            <LayoutGrid className="w-3.5 h-3.5" />
            All tools
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Every DeviceTry test, free and browser-based
          </h1>
          <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            {TOOLS_REGISTRY.length} focused tools — no account, no installation. Media and input tests
            run locally in your browser; the network tests connect to their measurement services only
            when you start them.
          </p>
        </div>

        {CATEGORY_META.map((cat) => {
          const tools = TOOLS_REGISTRY.filter((tool) => tool.category === cat.key);
          if (tools.length === 0) return null;
          const Icon = cat.icon;
          return (
            <section key={cat.key} className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
                  {cat.label}
                  <span className="text-[10px] text-[#8996A6] font-semibold">({tools.length})</span>
                </h2>
                <span className="hidden sm:block text-xs text-[#8996A6]">{cat.description}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/test/${tool.slug}`}
                    className="group p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6] hover:shadow-md transition-all flex items-start gap-3"
                  >
                    <div className="shrink-0 group-hover:scale-110 transition-transform">
                      <DeviceIllustration type={tool.iconType} size={40} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] truncate">
                        {tool.title}
                      </p>
                      <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] mt-0.5 line-clamp-2">
                        {tool.shortDesc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <Footer t={t} />
    </div>
  );
}
