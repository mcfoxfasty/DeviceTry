import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Tag } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { listPublishedPosts } from '@/lib/blog/content';
import { BLOG_PATH } from '@/lib/blog/seo';
import { postCategoryLabel } from '@/keystatic.config';
import { siteOpenGraph } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Blog — DeviceTry',
  description:
    'Practical device diagnostics: how to tell a hardware fault from a software one, and what each measurement actually means.',
  alternates: { canonical: BLOG_PATH },
  openGraph: siteOpenGraph({
    title: 'Blog — DeviceTry',
    description:
      'Practical device diagnostics: how to tell a hardware fault from a software one, and what each measurement actually means.',
    url: `${SITE_URL}${BLOG_PATH}`,
    type: 'website',
  }),
};

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

export default async function BlogIndexPage() {
  const t = getDictionary();
  const posts = await listPublishedPosts();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />

      <main id="main-content" className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
              <Tag className="w-3.5 h-3.5" aria-hidden="true" />
              Blog
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4]">
              Device diagnostics, written from the measurements
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
              Every article here is written to be checked rather than believed: what to run, what the result
              means, and what the test cannot tell you.
            </p>
          </header>

          {posts.length === 0 ? (
            <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              No articles have been published yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.slug}>
                  <article className="group bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 transition-colors overflow-hidden">
                    <Link href={`${BLOG_PATH}/${post.slug}`} className="block sm:flex sm:items-stretch">
                      {post.coverImage ? (
                        <span className="block sm:w-56 shrink-0 bg-[#F1F4F7] dark:bg-[#192332]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- CMS uploads have no known intrinsic size for next/image. */}
                          <img
                            src={post.coverImage}
                            alt={post.coverImageAlt}
                            loading="lazy"
                            decoding="async"
                            className="h-40 w-full object-cover sm:h-full"
                          />
                        </span>
                      ) : null}
                      <span className="block p-5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6]">
                          {postCategoryLabel(post.category)}
                        </span>
                        <span className="mt-1.5 block text-base font-bold leading-snug text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] transition-colors">
                          {post.title}
                        </span>
                        {/* The excerpt is the author's own meta description, and is
                            omitted rather than replaced by filler when they have
                            not written one: `listPosts` reads front matter only, so
                            the body is not available here to derive one from. */}
                        {post.seoDescription ? (
                          <span className="mt-2 block text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
                            {post.seoDescription}
                          </span>
                        ) : null}
                        <span className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#8996A6]">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                          </span>
                          <span>{post.author}</span>
                        </span>
                      </span>
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer t={t} />
    </div>
  );
}
