import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { GUIDE_CATEGORIES } from '@/lib/guides/registry';
import { listSiteArticles, type PublishedArticleRef } from '@/lib/articles/registry';
import { POST_CATEGORIES } from '@/keystatic.config';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Guides — Troubleshooting & Buying Advice | DeviceTry',
  description:
    'Practical troubleshooting guides and specification-based buying guides for microphones, webcams, keyboards, controllers, screens, and home networks.',
  alternates: { canonical: '/guides' },
  openGraph: siteOpenGraph({
    title: 'Guides — Troubleshooting & Buying Advice | DeviceTry',
    description:
      'Practical troubleshooting guides and specification-based buying guides for microphones, webcams, keyboards, controllers, screens, and home networks.',
    type: 'website',
    url: `${SITE_URL}/guides`,
  }),
};

/**
 * The hub every article lives under.
 *
 * It lists everything the site publishes — the imported guides under
 * `content/guides/**` and the CMS articles under `public/guides/*.md` — from the
 * one registry that knows about both (lib/articles/registry.ts), so an article
 * written in the dashboard is a card here the moment it is published, without
 * anyone remembering to add it to a list: the files in `public/guides/` are the
 * list, and the repository read fills in whatever the build has not seen.
 *
 * The section headings come from the site's taxonomy, merged rather than
 * hardcoded: the guide categories in their established order first, then the two
 * CMS-only categories (`buying`, `how-to`) when anything is filed under them. A
 * category with no articles renders no heading.
 */
const SECTION_ORDER: Array<{ key: string; label: string }> = [
  ...GUIDE_CATEGORIES.map((category) => ({ key: category.key as string, label: category.label })),
  ...POST_CATEGORIES.filter(
    (category) => !GUIDE_CATEGORIES.some((guide) => guide.key === category.value)
  ).map((category) => ({ key: category.value as string, label: category.label })),
];

/** The small label on a card: what kind of article this is. */
function kindLabel(article: PublishedArticleRef): string {
  if (article.source === 'guide') {
    return article.type === 'buying' ? 'Buying guide' : article.type === 'how-to' ? 'How-to' : 'Troubleshooting';
  }
  return POST_CATEGORIES.find((category) => category.value === article.category)?.label ?? 'Article';
}

/**
 * Rendered per request rather than frozen at build time.
 *
 * The list is the site's whole article set: what the build knows plus any published
 * CMS article the build has never seen, read from the repository (see
 * lib/articles/registry.ts). That read is the point — an article published from
 * `/admin` a minute ago belongs on this page now, not after the next deploy — and it
 * cannot happen inside a prerendered page. When no token is configured the read is
 * skipped and the page renders exactly the build's list, so a deployment without one
 * loses nothing it had before.
 */
export const dynamic = 'force-dynamic';

export default async function GuidesHub() {
  const t = getDictionary();
  const articles = await listSiteArticles();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold uppercase tracking-wider mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Guides
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fix it or pick better hardware</h1>
          <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            Step-by-step troubleshooting for hardware that misbehaves, and buying guides built on
            manufacturer specifications — no sponsored rankings, no invented ratings. Every guide links
            the free browser test that verifies the result.
          </p>
        </div>

        {SECTION_ORDER.map((category) => {
          const inCategory = articles.filter((article) => article.category === category.key);
          if (inCategory.length === 0) return null;
          return (
            <section key={category.key} className="mt-10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#172033] dark:text-[#E9EEF4] mb-4">
                {category.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inCategory.map((article) => (
                  <Link
                    key={`${article.source}-${article.slug}`}
                    href={`/guides/${article.slug}`}
                    className="glass group p-4 rounded-xl border border-[#E2E8F0] dark:border-[#223043] hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] transition-all flex flex-col"
                  >
                    <div
                      aria-hidden={!article.coverImage}
                      className="aspect-video w-full overflow-hidden rounded-lg border border-[#E2E8F0] dark:border-[#223043] bg-[#F1F4F7] dark:bg-[#192332] mb-3"
                    >
                      {article.coverImage ? (
                        <Image
                          src={article.coverImage}
                          alt={article.coverImageAlt || article.title}
                          width={1200}
                          height={630}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8996A6]">
                      {kindLabel(article)}
                    </span>
                    <h3 className="mt-1 text-sm font-bold leading-snug text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6]">
                      {article.title}
                    </h3>
                    {article.description ? (
                      <p className="mt-2 text-xs text-[#59677D] dark:text-[#9AA6B8] leading-relaxed line-clamp-3 flex-1">
                        {article.description}
                      </p>
                    ) : (
                      <span className="flex-1" />
                    )}
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F766E] dark:text-[#14B8A6]">
                      Read guide
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </span>
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
