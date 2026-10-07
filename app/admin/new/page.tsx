import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArticleEditor } from '@/components/admin/ArticleEditor';
import { isAuthenticated } from '@/lib/admin/session';
import { POST_CATEGORIES, POST_STATUSES } from '@/keystatic.config';

/**
 * A new article.
 *
 * The categories and statuses come from keystatic.config.ts — the same lists the
 * article pages and the management table use — so a new value can never exist in
 * the editor and be missing from the site.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New Article — DeviceTry Admin',
};

export default async function NewArticlePage() {
  if (!(await isAuthenticated(await cookies()))) redirect('/admin/login');

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">New article</h1>
            <p className="mt-0.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              Write it, preview it, then commit it to the repository.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-3 py-2 text-sm font-medium hover:border-[#CBD5E1] dark:hover:border-[#31435D] transition"
          >
            ← All articles
          </Link>
        </header>

        <ArticleEditor
          categories={POST_CATEGORIES.map((category) => ({ value: category.value, label: category.label }))}
          statuses={POST_STATUSES.map((option) => ({ value: option.value, label: option.label }))}
          today={today}
        />
      </div>
    </main>
  );
}
