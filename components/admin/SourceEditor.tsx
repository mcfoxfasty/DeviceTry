'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { sourceProblems } from '@/lib/admin/source-guard';

/**
 * The editor for an imported guide: the module's own source, and Save.
 *
 * WHY THERE IS NO RICH EDITOR HERE. A typed guide is not prose with fields around
 * it. Its figures are registered assets that have to exist at three widths, its
 * sections drive the article template's tables and product boxes, its `proseLinks`
 * are asserted against the prose by tests, and its FAQ set feeds the page's FAQPage
 * graph. A rich editor over that would either drop most of it or invent a second
 * representation of it — so this editor shows the module, and saves the module.
 *
 * WHAT IT PREVENTS, IN THE BROWSER AND AGAIN ON THE SERVER. Three edits would break
 * something a text field cannot repair: changing the `slug` (the live URL), renaming
 * the exported identifier (content/guides/index.ts imports it), and removing the
 * top-level `published` flag (the management table flips it). The same guard runs
 * here for instant feedback and in /api/admin/source as the guarantee, from one
 * shared function — see lib/admin/source-guard.ts for why that function is
 * dependency-free.
 *
 * NOTHING IS AUTO-FORMATTED. The textarea shows what the repository holds and the
 * save commits exactly what is in it, so the diff a reviewer sees is the edit the
 * author made. A formatter or a prettier-on-save would rewrite a 300-line module on
 * every save and make every change unreviewable.
 */

interface Status {
  kind: 'idle' | 'saving' | 'ok' | 'error';
  message?: string;
  errors?: Record<string, string>;
}

export function SourceEditor({
  slug,
  title,
  repoPath,
  exportName,
  published,
  source: initialSource,
}: {
  slug: string;
  title: string;
  repoPath: string;
  exportName: string;
  published: boolean;
  source: string;
}) {
  const [source, setSource] = useState(initialSource);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [attempted, setAttempted] = useState(false);

  const problems = useMemo(
    () => sourceProblems({ source, slug, exportName }),
    [source, slug, exportName]
  );
  const ready = Object.keys(problems).length === 0;
  const dirty = source !== initialSource;

  const save = async (): Promise<void> => {
    setAttempted(true);
    if (!ready) {
      setStatus({ kind: 'error', message: 'Fix the highlighted fields before saving.' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      const response = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, source }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; url?: string; errors?: Record<string, string> }
        | null;
      if (!response.ok || !body?.ok) {
        setStatus({
          kind: 'error',
          message: body?.message ?? `Saving failed (HTTP ${response.status}).`,
          errors: body?.errors,
        });
        return;
      }
      setStatus({
        kind: 'ok',
        message: `${body.message ?? 'Committed to the repository.'}${
          body.url ? ` The page rebuilds at ${body.url} on the next deploy.` : ''
        }`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: `The request did not complete: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  const shown = (field: string): string | undefined =>
    attempted ? (problems[field] ?? status.errors?.[field]) : status.errors?.[field];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{repoPath}</p>
          <p className="mt-0.5 text-xs text-[#8996A6]">
            Exported as <span className="font-mono">{exportName}</span>, currently{' '}
            {published ? 'published' : 'retired'}. Saving commits this file to{' '}
            <span className="font-mono">main</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/guides/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-2.5 py-1.5 text-xs font-medium hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition"
          >
            View page
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-2.5 py-1.5 text-xs font-medium hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition"
          >
            ← All articles
          </Link>
        </div>
      </div>

      {problems.slug || problems.exportName || problems.published || problems.content ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-[#FEF3C7] dark:border-[#451A03] bg-[#FEF3C7] dark:bg-[#451A03] px-3 py-2 text-xs text-[#B45309] dark:text-[#F59E0B]">
          {(['content', 'slug', 'exportName', 'published'] as const).map((field) =>
            shown(field) ? <li key={field}>{shown(field)}</li> : null
          )}
        </ul>
      ) : null}

      <textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        rows={28}
        aria-label={`Source of ${title}`}
        className="w-full rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-3 py-3 font-mono text-[12px] leading-relaxed outline-none focus:border-[#0F766E] dark:focus:border-[#14B8A6] min-h-[420px] resize-y"
      />

      <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#8996A6]">
            {dirty ? 'Unsaved changes.' : 'No changes yet.'} {source.length.toLocaleString()} characters.
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={status.kind === 'saving' || (attempted && !ready)}
            className="rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-4 py-2.5 text-sm font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] disabled:opacity-60 transition"
          >
            {status.kind === 'saving' ? 'Committing…' : 'Commit to GitHub'}
          </button>
        </div>

        {status.kind === 'ok' ? (
          <p className="rounded-lg border border-[#DCFCE7] dark:border-[#052E16] bg-[#DCFCE7] dark:bg-[#052E16] px-3 py-2 text-xs text-[#16A34A] dark:text-[#22C55E]">
            {status.message}
          </p>
        ) : null}
        {status.kind === 'error' ? (
          <p
            role="alert"
            className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-xs text-[#DC2626] dark:text-[#EF4444]"
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
