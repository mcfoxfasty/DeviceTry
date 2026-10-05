import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { getGuideBySlug, getPublishedGuides } from '@/lib/guides/registry';
import type { GuideArticle } from '@/content/guides/schema';
import { GUIDE_IMAGE_WIDTHS, guideImageFile } from '@/lib/guides/images';
import { compactTitle, DEFAULT_OG_IMAGE } from '@/lib/seo/metadata';
import { GuideArticleView } from '@/components/guides/GuideArticleView';
import { SITE_URL } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * An article's social card, taken from its OWN lead asset rather than a generic
 * site image, so a shared link previews the article the reader is actually
 * being sent to. The largest pre-rasterised width is used: these figures
 * already ship at 480/768/1152, and re-running them through an optimiser at
 * request time would add a runtime dependency for no gain.
 *
 * A photo has no theme segment; a drawn diagram does, and the LIGHT raster is
 * the right one here because a social card renders on its own background
 * rather than inside the site's dark theme.
 *
 * `undefined` means the article ships no lead artwork, and the caller falls
 * back to the site-wide 1200x630 card.
 *
 * Shared by `generateMetadata` and the JSON-LD graph below. They used to
 * compute it separately: the graph re-derived it from a variable declared
 * inside `generateMetadata`, which is out of scope in the page component — so
 * the structured data could never be sure it named the same image as the
 * `<meta>` tags it is supposed to describe. One helper, one answer.
 */
function guideSocialImage(guide: GuideArticle) {
  // An imported article that ships its own finished card wins over one derived
  // from a guide figure: a shared link should preview the artwork the author
  // chose for it.
  if (guide.socialImage) {
    return {
      url: `${SITE_URL}${guide.socialImage.url}`,
      width: guide.socialImage.width,
      height: guide.socialImage.height,
      alt: guide.socialImage.alt ?? guide.title,
    };
  }
  return guide.featuredImage
    ? {
        url: `${SITE_URL}${guideImageFile(
          guide.featuredImage.src,
          guide.featuredImage.kind === 'photo' ? null : 'light',
          GUIDE_IMAGE_WIDTHS[GUIDE_IMAGE_WIDTHS.length - 1]
        )}`,
        width: guide.featuredImage.width,
        height: guide.featuredImage.height,
        alt: guide.featuredImage.alt,
      }
    : undefined;
}

export function generateStaticParams() {
  // Prerender published guides only; drafts 404 and are never listed.
  return getPublishedGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: 'Guide Not Found — DeviceTry' };

  const socialImage = guideSocialImage(guide);

  // An article without its own lead artwork still needs a card: the site-wide
  // 1200x630 one. A page that declares `openGraph` replaces the root layout's
  // block outright, so omitting `images` here meant the fourteen guides with
  // no featured photo emitted no og:image at all.
  const cardImages = [socialImage ?? DEFAULT_OG_IMAGE];

  // An article imported with its own SEO pack can declare the exact string it
  // wants in the browser/search title. Everything else derives one from the
  // headline, which is right for a headline written for this site.
  const seoTitle = guide.seoTitle ?? compactTitle(guide.title);

  return {
    // The browser/search title is compacted to stay inside the ~60 characters
    // a result shows; the article's own full headline still renders as the H1.
    title: seoTitle,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: seoTitle,
      description: guide.description,
      type: 'article',
      url: `${SITE_URL}/guides/${guide.slug}`,
      siteName: 'DeviceTry',
      publishedTime: guide.publishedAt.toISOString(),
      modifiedTime: guide.updatedAt.toISOString(),
      images: cardImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: guide.description,
      images: [socialImage?.url ?? DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();
  const t = getDictionary();

  // One JSON-LD graph built from the article's own fields, so nothing in it
  // can drift from the page. FAQPage is generated from `guide.faqs` rather
  // than pasted in, which is what keeps a hand-written copy from ending up
  // describing Q&As the reader cannot find on the page.
  const url = `${SITE_URL}/guides/${guide.slug}`;
  const imageUrl = guideSocialImage(guide)?.url ?? `${SITE_URL}${DEFAULT_OG_IMAGE.url}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `${url}#article`,
        headline: guide.title,
        description: guide.seoDescription ?? guide.description,
        image: [imageUrl],
        datePublished: guide.publishedAt.toISOString(),
        dateModified: guide.updatedAt.toISOString(),
        inLanguage: 'en',
        author: { '@type': 'Organization', name: 'DeviceTry', url: `${SITE_URL}/about` },
        publisher: {
          '@type': 'Organization',
          name: 'DeviceTry',
          url: `${SITE_URL}/`,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/devicetry-mark.png` },
        },
        mainEntityOfPage: url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 3, name: guide.title, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main-content" className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
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
