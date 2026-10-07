import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SourceEditor } from '@/components/admin/SourceEditor';
import { publishToken } from '@/lib/admin/articles';
import { readLegacyGuide } from '@/lib/admin/legacy-guides';
import { GithubError } from '@/lib/admin/github';
import { isAuthenticated } from '@/lib/admin/session';

/**
 * Editing an imported guide: `/admin/source/<slug>`.
 *
 * WHY THE EDITOR IS NOT THE MARKDOWN ONE. The article's file is a typed module —
 * `content/guides/<category>/<slug>.ts` — whose fields drive the article template's
 * figures, tables, product boxes, prose links and FAQ set. Its prose is in `sections`
 * arrays, not in a Markdown body, so the Markdown editor has nowhere to put it. This
 * page hands the author the module instead: the same file the repository builds, and
 * a save that commits it unchanged.
 *
 * The guard runs on the server before anything renders, like every other admin page,
 * and an unknown slug is a 404 rather than an editor with empty fields — an editor
 * that opened on nothing would invite a save that deleted a file.
 *
 * A guide is looked up by the slug it DECLARES, so a module whose filename and slug
 * disagree is still found and still editable, which is the only way this page can be
 * the whole answer to "where do I edit this".
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Guide Module — DeviceTry Admin',
};

export default async function SourceEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthenticated(await cookies()))) redirect('/admin/login');

  const { slug } = await params;
  const token = publishToken();

  if (token.length === 0) {
    return (
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <p
            role="alert"
            className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-sm text-[#DC2626] dark:text-[#EF4444]"
          >
            GITHUB_TOKEN is not set for this deployment, so a guide module cannot be read or saved. Bind it
            as a Worker secret (or in the workspace environment) and reload.
          </p>
          <Link href="/admin" className="mt-4 inline-block text-sm underline">
            ← All articles
          </Link>
        </div>
      </main>
    );
  }

  let guide: Awaited<ReturnType<typeof readLegacyGuide>>;
  try {
    guide = await readLegacyGuide(slug, { token });
  } catch (error) {
    return (
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <p
            role="alert"
            className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-sm text-[#DC2626] dark:text-[#EF4444]"
          >
            {error instanceof GithubError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'The guide module could not be read.'}
          </p>
          <Link href="/admin" className="mt-4 inline-block text-sm underline">
            ← All articles
          </Link>
        </div>
      </main>
    );
  }

  if (!guide) notFound();

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight">{guide.title}</h1>
          <p className="mt-0.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
            An imported guide, edited as the module it is. Saving commits{' '}
            <span className="font-mono">{guide.repoPath}</span> to{' '}
            <span className="font-mono">main</span>; it appears on the site after the next build.
          </p>
        </header>

        <SourceEditor
          slug={guide.slug}
          title={guide.title}
          repoPath={guide.repoPath}
          exportName={guide.exportName}
          published={guide.published}
          source={guide.source}
        />
      </div>
    </main>
  );
}
