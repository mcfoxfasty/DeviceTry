import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, User } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import type { GuideArticle } from '@/content/guides/schema';
import { GUIDE_IMAGE_WIDTHS, guideImageFile } from '@/lib/guides/images';
import { compactTitle, DEFAULT_OG_IMAGE } from '@/lib/seo/metadata';
import { GuideArticleView } from '@/components/guides/GuideArticleView';
import { PostBody } from '@/components/blog/PostBody';
import { PostBodyHtml } from '@/components/blog/PostBodyHtml';
import { ArticleFooter } from '@/components/blog/ArticleFooter';
import { buildArticleFooter } from '@/lib/blog/footers';
import { buildPostJsonLd, buildPostMetadata, ARTICLE_PATH } from '@/lib/blog/seo';
import {
  listPublishedArticles,
  listSiteArticles,
  resolveLiveArticle,
  resolvePublishedArticle,
  type ResolvedArticle,
} from '@/lib/articles/registry';
import { postCategoryLabel } from '@/keystatic.config';
import { SITE_URL } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * One article, at `/guides/<slug>`.
 *
 * TWO SOURCES, ONE URL SPACE. This route serves both kinds of article the site
 * has: an imported guide written as a typed module under `content/guides/**`
 * (rendered by GuideArticleView, with its own sections, figures and FAQ set) and a
 * CMS article written as `public/guides/<slug>.md` in the dashboard (compiled by
 * PostBody). lib/articles/registry.ts decides which one a slug names, preferring
 * the guide when somehow both exist.
 *
 * WHY `dynamicParams = true`. Every article the build knows is prerendered — fast,
 * static output — and a slug the build has never seen is rendered on demand instead
 * of 404ing. That is the difference between "publishing is a commit that the next
 * deploy turns into a page" and "publishing works". The on-demand path reads the
 * article from the repository (lib/articles/registry.ts) and renders its body with
 * the eval-free renderer, because the Cloudflare Worker bans dynamic code
 * evaluation and the MDX compiler needs exactly that. A slug in neither the build
 * nor the repository still 404s, so a genuinely missing URL stays missing.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  // Published articles only, from both collections — the set that is prerendered.
  // A draft or an archived article gets no prerendered route, which is what keeps
  // its URL out of the static output rather than hiding it after the fact. (It is
  // not a 404 by construction any more: the route renders unknown slugs on demand,
  // and the on-demand read applies the same published-only rule — see
  // lib/articles/registry.ts.)
  const articles = await listPublishedArticles();
  return articles.map((article) => ({ slug: article.slug }));
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

/** The metadata for an imported guide. */
function guideMetadata(guide: GuideArticle): Metadata {
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) return { title: 'Article Not Found — DeviceTry' };
  return article.source === 'cms' ? buildPostMetadata(article.post) : guideMetadata(article.guide);
}

/**
 * The article a slug names, from the build first and the repository second.
 *
 * One resolver used by both `generateMetadata` and the page, so the `<title>` a
 * crawler reads is derived from the same article the page renders — a metadata
 * pass that resolved a different version of the article than the body would be a
 * page describing itself incorrectly.
 */
async function resolveArticle(slug: string): Promise<ResolvedArticle | null> {
  return (await resolvePublishedArticle(slug)) ?? (await resolveLiveArticle(slug));
}

/** A publication date a reader can read: ISO in the data, prose in the page. */
function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) notFound();
  const t = getDictionary();

  // ------------------------------------------------------------ CMS article
  if (article.source === 'cms') {
    const { post } = article;

    // The generated foot is part of the page's data, not decoration: the FAQ it
    // produces is also what the FAQPage graph below describes, so structured data
    // and visible page cannot disagree about what the article answers.
    //
    // The candidates are the SITE's whole list — built and repository articles
    // together — so a newly published article can be recommended by an older one,
    // and never itself (the ranking excludes the article being read).
    const footer = buildArticleFooter(post, { candidates: await listSiteArticles() });
    const jsonLd = buildPostJsonLd(post, { faqs: footer.faqs });

    return (
      <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
        <Navbar t={t} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <main id="main-content" className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
          <article className="max-w-3xl mx-auto">
            <Link
              href={ARTICLE_PATH}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              All guides
            </Link>

            <header>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6]">
                  {postCategoryLabel(post.category)}
                </span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-[#142033] dark:text-[#E9EEF4]">
                {post.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-[#8996A6]">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5" aria-hidden="true" />
                  {post.author}
                </span>
                {post.publishedAt ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </span>
                ) : null}
              </div>
            </header>

            {/* The cover reserves its box before the bytes arrive, so a slow image
                cannot shift the whole article down the page. */}
            {post.coverImage ? (
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- CMS uploads have no known intrinsic size for next/image. */}
                <img
                  src={post.coverImage}
                  alt={post.coverImageAlt}
                  width={1200}
                  height={630}
                  className="w-full aspect-[1200/630] object-cover rounded-2xl border border-[#DFE5EB] dark:border-[#223043]"
                />
              </figure>
            ) : null}

            <div className="mt-8">
              {/* The body renderer follows the article's ORIGIN, not a preference:
                  a compiled article was compiled during the build, and a body read
                  at request time cannot be compiled at all in the Worker. */}
              {article.origin === 'repository' ? (
                <PostBodyHtml content={post.content} />
              ) : (
                <PostBody content={post.content} />
              )}
            </div>

            {post.tags.length > 0 ? (
              <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-[#DFE5EB] dark:border-[#223043] pt-5">
                <span className="text-[11px] font-semibold text-[#8996A6]">Tags</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#F1F4F7] dark:bg-[#192332] px-2.5 py-1 text-[11px] font-medium text-[#5F6B7A] dark:text-[#9AA6B8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <ArticleFooter content={footer} />
          </article>
        </main>

        <Footer t={t} />
      </div>
    );
  }

  // --------------------------------------------------------- imported guide
  const { guide } = article;

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
