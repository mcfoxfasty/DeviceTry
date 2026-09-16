import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDictionary, isValidLocale } from '@/lib/i18n';
import { Locale, DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/types';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToolDetailView } from '@/components/ToolDetailView';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export function generateStaticParams() {
  return TOOLS_REGISTRY.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const langParam = typeof query.lang === 'string' ? query.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const tool = TOOLS_REGISTRY.find((item) => item.slug === slug);

  if (!tool) {
    return { title: 'Test Not Found — DeviceTry' };
  }

  const title = `${tool.title[locale] || tool.title.en} — Free Online Tool | DeviceTry`;
  const description = tool.shortDesc[locale] || tool.shortDesc.en;

  return {
    title,
    description,
    keywords: tool.keywords,
    alternates: {
      canonical: `/test/${tool.slug}`,
      languages: {
        en: `/test/${tool.slug}?lang=en`,
        fr: `/test/${tool.slug}?lang=fr`,
        ar: `/test/${tool.slug}?lang=ar`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: LOCALES[locale].localeString,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ToolPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const langParam = typeof query.lang === 'string' ? query.lang : DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;
  const t = getDictionary(locale);

  const tool = TOOLS_REGISTRY.find((item) => item.slug === slug);
  if (!tool) {
    notFound();
  }

  const relatedTools = tool.relatedToolIds
    .map((id) => TOOLS_REGISTRY.find((item) => item.id === id || item.slug === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const isRtl = LOCALES[locale].dir === 'rtl';

  return (
    <div
      dir={LOCALES[locale].dir}
      className={`min-h-screen flex flex-col bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans ${
        isRtl ? 'rtl' : 'ltr'
      }`}
    >
      <Navbar t={t} currentLocale={locale} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <Link
            href={`/?test=${tool.slug}&lang=${locale}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            {t.nav.tools}
          </Link>
        </div>

        <ToolDetailView tool={tool} t={t} locale={locale} titleHeading="h1" />

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <section className="pt-4">
            <h2 className="text-sm font-bold text-[#172033] dark:text-[#E9EEF4] uppercase tracking-wider mb-3">
              Related Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {relatedTools.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/test/${rel.slug}?lang=${locale}`}
                  className="group p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] transition-colors"
                >
                  <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6]">
                    {rel.title[locale] || rel.title.en}
                  </p>
                  <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] mt-1 line-clamp-2">
                    {rel.shortDesc[locale] || rel.shortDesc.en}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer t={t} currentLocale={locale} />
    </div>
  );
}
