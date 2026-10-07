'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The articles table: every article in the repository, and every action on one.
 *
 * A client component for exactly one reason: the actions talk to the API and then
 * re-read the list. Everything else — the data, the labels, the badge colours —
 * arrives as props from the server page, which reads both collections.
 *
 * BOTH SOURCES, DELIBERATELY VISIBLE. A row says whether it is a CMS article
 * (`public/guides/<slug>.md`, written in this dashboard) or an imported guide
 * (`content/guides/<category>/<slug>.ts`, a typed module). The distinction is not
 * decoration: it decides which editor opens, which file Delete removes, and why
 * Publish/Archive behaves as it does. A guide has one visibility flag and no draft
 * state, so its button says Publish or Archive and never Draft — offering a state
 * the file cannot hold would be a button that silently does something else.
 *
 * THE CONFIRMATION IS A NATIVE DIALOG. `window.confirm` shows exactly the sentence
 * the flow asks for, works on iOS Safari and every in-app browser without a
 * focus-trap implementation, and cannot be styled into something a hurried tap can
 * dismiss by accident. Delete is the one action that removes a file, and now also
 * the one that can remove a guide from the index that references it, so it earns an
 * unavoidable question.
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
  /** Which collection the article lives in. */
  source: 'cms' | 'legacy';
  /** The file this row edits, deletes and re-publishes. */
  repoPath: string;
}

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-[#DCFCE7] dark:bg-[#052E16] text-[#16A34A] dark:text-[#22C55E]',
  draft: 'bg-[#FEF3C7] dark:bg-[#451A03] text-[#B45309] dark:text-[#F59E0B]',
  archived: 'bg-[#E2E8F0] dark:bg-[#1B2735] text-[#5F6B7A] dark:text-[#9AA6B8]',
};

const SOURCE_BADGE: Record<ArticleRow['source'], { label: string; className: string; title: string }> = {
  cms: {
    label: 'CMS',
    className: 'bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]',
    title: 'A Markdown article in public/guides, written in this dashboard.',
  },
  legacy: {
    label: 'Guide',
    className: 'bg-[#EDE9FE] dark:bg-[#231A3D] text-[#6D28D9] dark:text-[#A78BFA]',
    title: 'A typed guide module in content/guides, edited as source.',
  },
};

const actionButton =
  'rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-2.5 py-1.5 text-xs font-medium hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition disabled:opacity-50';

export function ArticlesTable({ articles }: { articles: ArticleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Where a row's Edit button goes: the Markdown editor, or the source editor. */
  const editHref = (article: ArticleRow): string =>
    article.source === 'legacy'
      ? `/admin/source/${encodeURIComponent(article.slug)}`
      : `/admin/edit/${encodeURIComponent(article.slug)}`;

  /**
   * Publish, draft or archive from the list.
   *
   * The endpoint answers with the state the FILE now holds, and that is what is
   * shown: asking a typed guide for `draft` retires it (`published: false`), and
   * saying "saved as draft" would describe a state no part of the repository
   * contains.
   */
  const changeStatus = async (article: ArticleRow, status: 'published' | 'draft' | 'archived'): Promise<void> => {
    setBusy(`${article.slug}:${status}`);
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: article.slug, source: article.source, status }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !body?.ok) {
        setFailure(body?.message ?? `Changing the status failed (HTTP ${response.status}).`);
        return;
      }
      setNotice(body.message ?? 'Status changed.');
      router.refresh();
    } catch (error) {
      setFailure(
        `The request did not complete: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async (article: ArticleRow): Promise<void> => {
    const described = article.source === 'legacy' ? `the guide module ${article.repoPath}` : article.repoPath;
    // The one irreversible action in the dashboard, so it asks in full sentences —
    // and names the file, because the two sources remove different things.
    if (!window.confirm(`Are you sure you want to delete this article? This removes ${described}.`)) return;

    setBusy(`${article.slug}:delete`);
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/publish?slug=${encodeURIComponent(article.slug)}&source=${article.source}`,
        { method: 'DELETE' }
      );
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
      setBusy(null);
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
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-[#DCFCE7] dark:border-[#052E16] bg-[#DCFCE7] dark:bg-[#052E16] px-3 py-2 text-sm text-[#16A34A] dark:text-[#22C55E]"
        >
          {notice}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27]">
        {/* The table scrolls sideways rather than crushing eight columns onto a
            phone; the actions stay reachable because they are the last columns. */}
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DFE5EB] dark:border-[#223043] text-[11px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8]">
              <th scope="col" className="px-4 py-3 font-semibold">Title</th>
              <th scope="col" className="px-4 py-3 font-semibold">Slug</th>
              <th scope="col" className="px-4 py-3 font-semibold">Source</th>
              <th scope="col" className="px-4 py-3 font-semibold">Publish date</th>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const source = SOURCE_BADGE[article.source];
              const publishing = busy === `${article.slug}:published`;
              const archiving = busy === `${article.slug}:archived`;
              const deleting = busy === `${article.slug}:delete`;
              const isPublished = article.statusValue === 'published';
              return (
                <tr
                  key={`${article.source}:${article.slug}`}
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
                    <span className="mt-0.5 block font-mono text-[10px] text-[#8996A6]">{article.repoPath}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{article.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      title={source.title}
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${source.className}`}
                    >
                      {source.label}
                    </span>
                  </td>
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
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={editHref(article)}
                        className={actionButton}
                        aria-label={`Edit ${article.title}`}
                      >
                        Edit
                      </Link>
                      {isPublished ? (
                        <button
                          type="button"
                          onClick={() => void changeStatus(article, 'archived')}
                          disabled={busy !== null}
                          className={actionButton}
                          aria-label={`Archive ${article.title}`}
                        >
                          {archiving ? 'Archiving…' : 'Archive'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void changeStatus(article, 'published')}
                          disabled={busy !== null}
                          className={`${actionButton} hover:!border-[#16A34A] dark:hover:!border-[#22C55E] hover:text-[#16A34A] dark:hover:text-[#22C55E]`}
                          aria-label={`Publish ${article.title}`}
                        >
                          {publishing ? 'Publishing…' : 'Publish'}
                        </button>
                      )}
                      {/* A draft is a CMS-only state: a guide module holds one
                          visibility flag, so the button is offered only where the
                          file can actually express it. */}
                      {article.source === 'cms' && article.statusValue !== 'draft' ? (
                        <button
                          type="button"
                          onClick={() => void changeStatus(article, 'draft')}
                          disabled={busy !== null}
                          className={actionButton}
                          aria-label={`Move ${article.title} back to draft`}
                        >
                          Draft
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(article)}
                        disabled={busy !== null}
                        className={`${actionButton} hover:!border-[#DC2626] dark:hover:!border-[#EF4444] hover:text-[#DC2626] dark:hover:text-[#EF4444]`}
                        aria-label={`Delete ${article.title}`}
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
