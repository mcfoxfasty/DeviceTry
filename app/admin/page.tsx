import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArticlesTable, type ArticleRow } from '@/components/admin/ArticlesTable';
import { listArticles, publishToken } from '@/lib/admin/articles';
import { GithubError } from '@/lib/admin/github';
import { isAuthenticated } from '@/lib/admin/session';
import { postCategoryLabel, postStatusLabel } from '@/keystatic.config';
import { BLOG_PATH } from '@/lib/blog/seo';

/**
 * The management view: every article in the collection, with its state.
 *
 * The list is read from the repository through the GitHub API — see
 * lib/admin/articles.ts for why the dashboard does not use the build-time content
 * reader. The practical consequence is the one that matters here: the table shows
 * what the repository holds right now, including an article committed a moment
 * ago and not yet built, and an article deleted a moment ago is gone from it.
 *
 * The guard is here, on the server, before anything renders — not in the table
 * component. An unauthenticated request is redirected to the form and never
 * receives the page's markup, so there is nothing for a client to un-hide.
 *
 * `force-dynamic` is required rather than optional: the page reads a cookie and
 * an upstream API, so it can never be prerendered, and asking Next not to try
 * keeps the build from producing a static admin page that everyone would share.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All Articles — DeviceTry Admin',
};

export default async function AdminPage() {
  if (!(await isAuthenticated(await cookies()))) redirect('/admin/login');

  const token = publishToken();
  let articles: ArticleRow[] = [];
  let readError: string | null = null;

  if (token.length === 0) {
    // Nothing to read with, and no point pretending the collection is empty.
    readError =
      'GITHUB_TOKEN is not set for this deployment, so the article collection cannot be read. Bind it as a Worker secret (or in the workspace environment) and reload.';
  } else {
    try {
      const posts = await listArticles({ token });
      articles = posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        publishedAt: post.publishedAt,
        categoryLabel: postCategoryLabel(post.category),
        statusValue: post.status,
        statusLabel: postStatusLabel(post.status),
        // A draft or an archived article has no public URL to link to — that is
        // what its status means.
        publicPath: post.status === 'published' ? `${BLOG_PATH}/${post.slug}` : null,
      }));
    } catch (error) {
      readError =
        error instanceof GithubError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The article collection could not be read.';
    }
  }

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">DeviceTry Admin</h1>
            <p className="mt-0.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              {readError
                ? 'The article list could not be read.'
                : `${articles.length} article${articles.length === 1 ? '' : 's'} in the collection.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/new"
              className="rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-3 py-2 text-sm font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] transition"
            >
              + New Article
            </Link>
            <form method="post" action="/api/admin/logout">
              <button
                type="submit"
                className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-3 py-2 text-sm font-medium hover:border-[#CBD5E1] dark:hover:border-[#31435D] transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {readError ? (
          <div className="flex flex-col gap-4">
            <p
              role="alert"
              className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-sm text-[#DC2626] dark:text-[#EF4444]"
            >
              {readError}
            </p>
            <Link
              href="/admin/new"
              className="self-start rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-4 py-2.5 text-sm font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] transition"
            >
              + New Article
            </Link>
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-8 text-center">
            <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              No articles yet. The first one is a click away.
            </p>
            <Link
              href="/admin/new"
              className="mt-4 inline-flex rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-4 py-2.5 text-sm font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] transition"
            >
              + New Article
            </Link>
          </div>
        ) : (
          <ArticlesTable articles={articles} />
        )}
      </div>
    </main>
  );
}
