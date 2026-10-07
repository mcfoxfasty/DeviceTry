import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, User } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import { getPost, listPublishedPosts } from '@/lib/blog/content';
import { BLOG_PATH, buildPostJsonLd, buildPostMetadata } from '@/lib/blog/seo';
import { postCategoryLabel } from '@/keystatic.config';
import { PostBody } from '@/components/blog/PostBody';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Articles are prerendered, and a slug that is not in the repository is a 404
 * rather than a page rendered on demand.
 *
 * `dynamicParams: false` is what makes that true. With the default (true), Next
 * would try to render an unknown slug at request time — and because nothing in
 * the CMS requires a rebuild to publish, that path would compile MDX inside the
 * Cloudflare Worker, where dynamic code evaluation is unavailable. Publishing an
 * article is therefore a commit followed by a build, which is the honest
 * description of how this site ships content.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  // Published articles only. A draft or an archived article gets no route at all,
  // which — with `dynamicParams = false` below — means its URL is a 404 rather
  // than a page that has to remember not to index itself.
  const posts = await listPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || post.status !== 'published') return { title: 'Article Not Found — DeviceTry' };
  return buildPostMetadata(post);
}

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

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  // The management dashboard can read a draft or an archived article; the public
  // site cannot. Its state is decided in the file, so a status change publishes
  // or unpublishes on the next build without any other edit.
  if (!post || post.status !== 'published') notFound();
  const t = getDictionary();

  /**
   * The structured data is built from the post itself, so it cannot describe a
   * headline, an image or a date the reader cannot see on the page. See
   * lib/blog/seo.ts for the graph and tests/blogCms.test.ts for the assertions.
   */
  const jsonLd = buildPostJsonLd(post);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main id="main-content" className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
        <article className="max-w-3xl mx-auto">
          <Link
            href={BLOG_PATH}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            All articles
          </Link>

          <header>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6]">
              {postCategoryLabel(post.category)}
            </span>
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
            <PostBody content={post.content} />
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
        </article>
      </main>

      <Footer t={t} />
    </div>
  );
}
