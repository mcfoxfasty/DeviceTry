import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArticleEditor } from '@/components/admin/ArticleEditor';
import { isAuthenticated } from '@/lib/admin/session';
import { POST_CATEGORIES } from '@/keystatic.config';

/**
 * The dashboard: the article editor, behind the session cookie.
 *
 * The guard is here, on the server, before anything renders — not in the editor
 * component. An unauthenticated request is redirected to the form and never
 * receives the editor's markup, so there is nothing for a client to un-hide.
 *
 * `force-dynamic` is required rather than optional: the page reads a cookie, so it
 * can never be prerendered, and asking Next not to try keeps the build from
 * producing a static admin page that everyone would share.
 *
 * The categories come from keystatic.config.ts — the same list the article pages
 * use for their labels — so a new category can never exist in the editor and be
 * missing from the site.
 */

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAuthenticated(await cookies()))) redirect('/admin/login');

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">DeviceTry Admin</h1>
            <p className="mt-0.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              Write an article, then publish it straight to the repository.
            </p>
          </div>
          <form method="post" action="/api/admin/logout">
            <button
              type="submit"
              className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-3 py-2 text-sm font-medium hover:border-[#CBD5E1] dark:hover:border-[#31435D] transition"
            >
              Sign out
            </button>
          </form>
        </header>

        <ArticleEditor
          categories={POST_CATEGORIES.map((category) => ({ value: category.value, label: category.label }))}
          today={today}
        />
      </div>
    </main>
  );
}
