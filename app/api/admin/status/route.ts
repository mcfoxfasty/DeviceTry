import type { NextRequest } from 'next/server';
import { POST_STATUSES, type PostStatus } from '@/keystatic.config';
import { readArticleFile } from '@/lib/admin/articles';
import { GithubError, commitFile, repository } from '@/lib/admin/github';
import { withFrontMatterStatus } from '@/lib/admin/authoring';
import { readLegacyGuide, setLegacyGuideStatus } from '@/lib/admin/legacy-guides';
import { isAuthenticated } from '@/lib/admin/session';

/**
 * The one-field change the management table makes: an article's status.
 *
 * WHY IT IS NOT A SAVE THROUGH THE EDITOR. Publishing or retiring an article from
 * the list is not an edit — the body, the cover, the tags and the metadata are all
 * untouched. Routing it through the editor's own endpoint would mean posting a whole
 * draft back, and a whole draft is composed rather than patched: the file would come
 * out re-quoted, re-ordered and re-wrapped, so a one-line change would land as a
 * rewritten article in the repository's history. This endpoint reads the file,
 * rewrites the single key that changed and commits that.
 *
 * BOTH SOURCES, ONE VOCABULARY. A CMS article has three states in its front matter.
 * An imported guide has a `published` boolean — the guides registry filters on it,
 * so false is what keeps a guide out of `/guides`, the sitemap and the static
 * params. The endpoint accepts the same three statuses for both and maps them onto
 * what each format can actually express: `published` and `draft` both mean
 * `published: false` for a guide, and the answer says which state the file now
 * holds rather than repeating back the one that was asked for.
 *
 * The order of checks is the publish endpoint's, for the same reasons: session
 * first (an anonymous caller learns nothing), then the credential and the
 * repository (a misconfigured deployment says so by name), then the input, and only
 * then does anything leave this process.
 */

export const dynamic = 'force-dynamic';

/** A JSON answer with no caching, like every other admin endpoint. */
function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** The slug shape every admin path assumes before a slug becomes a file path. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface StatusPayload {
  slug: string;
  source: 'cms' | 'legacy';
  status: PostStatus;
}

function readPayload(value: unknown): StatusPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.slug !== 'string' || !SLUG.test(candidate.slug)) return null;
  if (candidate.source !== 'cms' && candidate.source !== 'legacy') return null;
  if (!POST_STATUSES.some((option) => option.value === candidate.status)) return null;
  return { slug: candidate.slug, source: candidate.source, status: candidate.status as PostStatus };
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

  const payload = readPayload(await request.json().catch(() => null));
  if (!payload) {
    return json(400, {
      ok: false,
      message: 'A status change needs a slug, a source (cms or legacy) and one of the schema’s statuses.',
    });
  }

  const { slug, source, status } = payload;

  try {
    if (source === 'legacy') {
      const guide = await readLegacyGuide(slug, { token });
      if (!guide) {
        return json(404, { ok: false, message: `No imported guide declares the slug “${slug}”.` });
      }

      // A module has one visibility flag, so anything that is not `published`
      // retires it — there is no third state for the file to hold.
      const published = status === 'published';
      await setLegacyGuideStatus({ guide, published, token });
      return json(200, {
        ok: true,
        slug,
        source,
        // The state the FILE now holds, not the one that was requested.
        status: published ? 'published' : 'archived',
        repository: repo,
        path: guide.repoPath,
        message: published
          ? `“${guide.title}” is published. The guides hub, the sitemap and its own page include it after the next build.`
          : `“${guide.title}” is retired. Its page stops being built and it leaves the sitemap and the guides hub on the next build.`,
      });
    }

    const article = await readArticleFile(slug, { token });
    if (!article) {
      return json(404, { ok: false, message: `public/guides/${slug}.md is not in the repository.` });
    }

    const updated = withFrontMatterStatus(article.file, status);
    if (updated === article.file && !article.file.includes(`status: ${status}`)) {
      return json(422, {
        ok: false,
        message: `public/guides/${slug}.md has no front matter to set a status in, so it cannot be published or retired from here.`,
      });
    }

    const encoded = new TextEncoder().encode(updated);
    let binary = '';
    for (const byte of encoded) binary += String.fromCharCode(byte);

    const commit = await commitFile({
      path: article.path,
      message: `Set "${slug}" status to ${status}`,
      base64: btoa(binary),
      token,
    });

    return json(200, {
      ok: true,
      slug,
      source,
      status,
      repository: repo,
      path: commit.path,
      commit: { created: commit.created },
      message:
        status === 'published'
          ? 'Status set to published. The article appears on the site after the next build.'
          : `Status set to ${status}. The article leaves the public site on the next build.`,
    });
  } catch (error) {
    if (error instanceof GithubError) {
      return json(502, { ok: false, message: error.message });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return json(500, { ok: false, message: `The status change failed before GitHub accepted it: ${detail}` });
  }
}
