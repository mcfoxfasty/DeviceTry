import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { getGuideBySlug, getPublishedGuides } from '@/lib/guides/registry';
import { GuideArticleView } from '@/components/guides/GuideArticleView';
import { SITE_URL } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // Prerender published guides only; drafts 404 and are never listed.
  return getPublishedGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: 'Guide Not Found — DeviceTry' };

  return {
    title: `${guide.title} | DeviceTry`,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: 'article',
      url: `${SITE_URL}/guides/${guide.slug}`,
      publishedTime: guide.publishedAt.toISOString(),
      modifiedTime: guide.updatedAt.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();
  const t = getDictionary();

  // FAQPage JSON-LD from the article's real Q&A content.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-3xl mx-auto mb-6">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            All guides
          </Link>
        </div>
        <GuideArticleView guide={guide} />
      </main>
      <Footer t={t} />
    </div>
  );
}
