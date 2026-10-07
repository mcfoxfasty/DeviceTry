import type { NextRequest } from 'next/server';
import { GithubError, commitFile, repository } from '@/lib/admin/github';
import { readLegacyGuide } from '@/lib/admin/legacy-guides';
import { sourceProblems } from '@/lib/admin/source-guard';
import { isAuthenticated } from '@/lib/admin/session';

/**
 * Saving an imported guide — `content/guides/<category>/<slug>.ts` — as source.
 *
 * WHY THE MODULE ITSELF AND NOT A MARKDOWN CONVERSION.
 * A typed guide is not a document with extra fields. Its figures are registered
 * assets that must each exist at three widths, its sections drive the article
 * template's tables and product boxes, its `proseLinks` are asserted against the
 * prose by tests, and its FAQ set feeds the page's FAQPage graph. Converting one to
 * Markdown in order to "edit" it would drop all of that and change a published
 * page's structure. So the dashboard's editor for one is a source editor: it loads
 * the module, and it commits the module.
 *
 * WHAT THIS ENDPOINT REFUSES, AND WHY EACH REFUSAL MATTERS.
 *  1. A path. It takes a SLUG and looks the module up — the request cannot name a
 *     file. Without that, this would be an authenticated arbitrary-file-write to the
 *     repository, which is a far bigger thing than an article editor.
 *  2. A body that no longer declares the same slug. This is the check that stops a
 *     paste from turning "the article I opened" into "a different article", which
 *     would leave the old slug 404ing and the new one appearing with no explanation.
 *  3. A body that no longer exports the same identifier. `content/guides/index.ts`
 *     imports that name; renaming it here would break the build until someone also
 *     edited the index, which is not something a body field can do safely.
 *  4. A body with no top-level `published` flag. The management table's Publish and
 *     Archive actions rewrite that flag, so a module without one would become a
 *     guide the dashboard can no longer publish or retire.
 *
 * Everything else — the prose, the sections, the FAQs, the tool links — is the
 * author's, and is committed exactly as written. That is the point of editing source.
 */

export const dynamic = 'force-dynamic';

/** 400 KB: a guide module is ~30 KB, and a paste three times over is a mistake. */
const MAX_SOURCE_BYTES = 400 * 1024;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** base64 of a UTF-8 string, without Node's Buffer (this runs on a Worker too). */
function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!(await isAuthenticated(request.cookies))) {
    return json(401, { ok: false, message: 'Your session has expired. Sign in again and retry.' });
  }

  const token = (process.env.GITHUB_TOKEN ?? '').trim();
  if (token.length === 0) {
    return json(503, {
      ok: false,
      message:
        'GITHUB_TOKEN is not set for this deployment, so nothing can be committed. Bind it as a Worker secret (or in the workspace environment) and try again.',
    });
  }

  const repo = repository();
  if (repo.length === 0) {
    return json(503, { ok: false, message: 'The CMS schema does not name a GitHub repository to publish to.' });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_SOURCE_BYTES) {
    return json(413, { ok: false, message: 'That module is larger than this endpoint accepts (400 KB).' });
  }

  const body = (await request.json().catch(() => null)) as { slug?: unknown; source?: unknown } | null;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const source = typeof body?.source === 'string' ? body.source : '';
  if (!SLUG.test(slug) || source.length === 0) {
    return json(400, { ok: false, message: 'A module save needs the article’s slug and its source text.' });
  }

  try {
    // The module is looked up, never named by the request — see the header comment.
    const guide = await readLegacyGuide(slug, { token });
    if (!guide) {
      return json(404, { ok: false, message: `No imported guide declares the slug “${slug}”.` });
    }

    const problems = sourceProblems({ source, slug, exportName: guide.exportName });
    if (Object.keys(problems).length > 0) {
      return json(400, { ok: false, message: 'The module is not ready to save.', errors: problems });
    }

    const commit = await commitFile({
      path: guide.repoPath,
      message: `Edit guide "${guide.title}"`,
      base64: base64Encode(source),
      token,
    });

    return json(200, {
      ok: true,
      slug,
      source: 'legacy',
      repository: repo,
      path: commit.path,
      commit: { created: commit.created },
      url: `/guides/${slug}`,
    });
  } catch (error) {
    if (error instanceof GithubError) {
      return json(502, { ok: false, message: error.message });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return json(500, { ok: false, message: `Saving failed before GitHub accepted the request: ${detail}` });
  }
}
