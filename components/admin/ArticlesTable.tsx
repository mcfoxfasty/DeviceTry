'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The articles table.
 *
 * A client component for exactly one reason: Delete asks for confirmation and
 * then talks to the API. Everything else — the data, the labels, the badge
 * colours — arrives as props from the server page, which reads the collection.
 *
 * THE CONFIRMATION IS A NATIVE DIALOG. `window.confirm` shows exactly the
 * sentence the flow asks for, works on iOS Safari and every in-app browser
 * without a focus-trap implementation, and cannot be styled into something a
 * hurried tap can dismiss by accident. A delete that destroys a file on GitHub
 * earns one unavoidable question, not a bespoke modal.
 */

export interface ArticleRow {
  slug: string;
  title: string;
  publishedAt: string;
  categoryLabel: string;
  statusValue: string;
  statusLabel: string;
  /** The public URL, for published articles only — a draft has none. */
  publicPath: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-[#DCFCE7] dark:bg-[#052E16] text-[#16A34A] dark:text-[#22C55E]',
  draft: 'bg-[#FEF3C7] dark:bg-[#451A03] text-[#B45309] dark:text-[#F59E0B]',
  archived: 'bg-[#E2E8F0] dark:bg-[#1B2735] text-[#5F6B7A] dark:text-[#9AA6B8]',
};

const actionButton =
  'rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-2.5 py-1.5 text-xs font-medium hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition disabled:opacity-50';

export function ArticlesTable({ articles }: { articles: ArticleRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const remove = async (slug: string): Promise<void> => {
    // The one irreversible action in the dashboard, so it asks in full sentences.
    if (!window.confirm('Are you sure you want to delete this article?')) return;

    setDeleting(slug);
    setFailure(null);
    try {
      const response = await fetch(`/api/admin/publish?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setFailure(body?.message ?? `Deleting failed (HTTP ${response.status}).`);
        return;
      }
      // The row disappears when the page re-renders from the same collection the
      // delete just emptied.
      router.refresh();
    } catch (error) {
      setFailure(
        `The request did not complete: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {failure ? (
        <p
          role="alert"
          className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-sm text-[#DC2626] dark:text-[#EF4444]"
        >
          {failure}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27]">
        {/* The table scrolls sideways rather than crushing six columns onto a
            phone; the actions stay reachable because they are the last columns. */}
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DFE5EB] dark:border-[#223043] text-[11px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8]">
              <th scope="col" className="px-4 py-3 font-semibold">Title</th>
              <th scope="col" className="px-4 py-3 font-semibold">Slug</th>
              <th scope="col" className="px-4 py-3 font-semibold">Publish date</th>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr
                key={article.slug}
                className="border-b border-[#DFE5EB] dark:border-[#223043] last:border-b-0 align-middle"
              >
                <td className="px-4 py-3 font-medium text-[#142033] dark:text-[#E9EEF4]">
                  {article.publicPath ? (
                    <a
                      href={article.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#0F766E] dark:hover:text-[#14B8A6] hover:underline"
                    >
                      {article.title}
                    </a>
                  ) : (
                    article.title
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{article.slug}</td>
                <td className="px-4 py-3 text-[#5F6B7A] dark:text-[#9AA6B8]">{article.publishedAt}</td>
                <td className="px-4 py-3 text-[#5F6B7A] dark:text-[#9AA6B8]">{article.categoryLabel}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      STATUS_BADGE[article.statusValue] ?? STATUS_BADGE.archived
                    }`}
                  >
                    {article.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/edit/${encodeURIComponent(article.slug)}`}
                      className={actionButton}
                      aria-label={`Edit ${article.title}`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(article.slug)}
                      disabled={deleting !== null}
                      className={`${actionButton} hover:!border-[#DC2626] dark:hover:!border-[#EF4444] hover:text-[#DC2626] dark:hover:text-[#EF4444]`}
                      aria-label={`Delete ${article.title}`}
                    >
                      {deleting === article.slug ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
