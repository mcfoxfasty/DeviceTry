import {
  MAX_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  base64ByteLength,
  imageRepoPath,
  postRepoPath,
  publicImagePath,
  referencedUploads,
  validateDraft,
  validateImage,
  type PostDraft,
  type PublishPayload,
  type UploadedImage,
} from '@/lib/admin/authoring';
import { POST_IMAGE_PUBLIC_PATH } from '@/keystatic.config';
import type { NextRequest } from 'next/server';
import { GithubError, deleteFile, fileExists, publishArticle, repository } from '@/lib/admin/github';
import { deleteLegacyGuide, readLegacyGuide } from '@/lib/admin/legacy-guides';
import { isAuthenticated } from '@/lib/admin/session';

/**
 * The article's lifecycle endpoint.
 *
 * `POST` saves an article — new or edited — and its images; `DELETE?slug=…`
 * removes one. Both authenticate the session first, then the token, then the
 * payload, and both answer with GitHub's own words when GitHub refuses.
 *
 * POST: THE ORDER OF THE CHECKS MATTERS.
 * 1. Session first. An unauthenticated caller learns nothing about the payload,
 *    the repository or the token.
 * 2. Then the credential, so a misconfigured deployment says so immediately
 *    instead of after uploading an article's images.
 * 3. Then the draft and the images — including the two rules that protect the
 *    published page: a cover image with real alt text, and alt text on every
 *    inline image reference in the body.
 * 4. Only then does anything leave this process.
 *
 * WHY IT ANSWERS WITH THE COMMIT LIST.
 * Publishing is several commits (every image, then the article). The response
 * names what was written, so a failure halfway through is legible rather than a
 * bare 500 — the dashboard shows the article's URL and which files landed.
 *
 * The body limit is checked before parsing: an article with a phone photo in it is
 * a few megabytes, and anything far beyond that is a mistake or an attack, not a
 * publish. Failures carry a sentence an operator can act on; the token itself is
 * never echoed.
 */

export const dynamic = 'force-dynamic';

/** 25 MB: comfortably more than a full article with several photos. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

/** A JSON answer with no caching, for the same reason the login route has none. */
function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * The one irreversible action, and the checks it cannot skip.
 *
 * The slug names the file; a well-formed slug is required before anything is
 * looked up, because a traversal (`..%2F…`) must be rejected as a slug rather
 * than survive into a path. The session and the token are checked first, in the
 * same order the publish handler uses: an unauthenticated caller learns nothing
 * about the repository, and a misconfigured deployment says so by name.
 *
 * Deleting a file that is not there is a success (`deleted: false`), not an
 * error — a double click, or a delete racing a rebuild, should not read as a
 * failure when the requested state, no file, is exactly what exists.
 *
 * TWO SOURCES, ONE ACTION. `?source=legacy` deletes an imported guide module, which
 * is a two-step operation rather than one: the module is detached from
 * `content/guides/index.ts` FIRST and the file removed second, so a failure between
 * them leaves an unreferenced module rather than an import of a missing file. See
 * lib/admin/legacy-guides.ts. A guide whose import the dashboard cannot find is
 * refused outright — deleting it would break the build, which is the one outcome
 * worse than a delete that did not happen.
 */
export async function DELETE(request: NextRequest): Promise<Response> {
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

  const slug = (request.nextUrl.searchParams.get('slug') ?? '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json(400, { ok: false, message: 'That slug does not name an article file.' });
  }

  const repo = repository();
  if (repo.length === 0) {
    return json(503, { ok: false, message: 'The CMS schema does not name a GitHub repository to publish to.' });
  }

  const source = request.nextUrl.searchParams.get('source') === 'legacy' ? 'legacy' : 'cms';

  try {
    if (source === 'legacy') {
      const guide = await readLegacyGuide(slug, { token });
      if (!guide) {
        return json(404, { ok: false, message: `No imported guide declares the slug “${slug}”.` });
      }
      const result = await deleteLegacyGuide({ guide, token });
      return json(200, {
        ok: true,
        slug,
        source,
        path: result.path,
        deleted: result.deleted,
        indexUpdated: result.indexUpdated,
        repository: repo,
      });
    }

    const result = await deleteFile({
      path: postRepoPath(slug),
      message: `Delete "${slug}"`,
      token,
    });
    return json(200, { ok: true, slug, source, deleted: result.deleted, repository: repo });
  } catch (error) {
    if (error instanceof GithubError) {
      return json(502, { ok: false, message: error.message });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return json(500, { ok: false, message: `Deleting failed before GitHub accepted the request: ${detail}` });
  }
}

/** Structural check of the payload, before any rule that needs real fields. */
function readPayload(value: unknown): PublishPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { draft?: unknown; images?: unknown; previousSlug?: unknown };
  if (typeof candidate.draft !== 'object' || candidate.draft === null) return null;
  if (!Array.isArray(candidate.images)) return null;

  const draft = candidate.draft as Record<string, unknown>;
  const strings = [
    'title',
    'slug',
    'seoTitle',
    'seoDescription',
    'coverImage',
    'coverImageAlt',
    'publishedAt',
    'author',
    'category',
    'status',
    'canonicalUrl',
    'content',
  ] as const;
  for (const field of strings) {
    if (typeof draft[field] !== 'string') return null;
  }
  if (!Array.isArray(draft.tags) || draft.tags.some((tag) => typeof tag !== 'string')) return null;

  // A rename carries the slug the article is filed under today. Anything that is
  // not a plain slug would not name a real file to remove.
  let previousSlug: string | undefined;
  if (candidate.previousSlug !== undefined) {
    if (typeof candidate.previousSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.previousSlug)) {
      return null;
    }
    previousSlug = candidate.previousSlug;
  }

  const images: UploadedImage[] = [];
  for (const entry of candidate.images) {
    if (typeof entry !== 'object' || entry === null) return null;
    const image = entry as Record<string, unknown>;
    if (
      typeof image.filename !== 'string' ||
      typeof image.contentType !== 'string' ||
      typeof image.base64 !== 'string'
    ) {
      return null;
    }
    images.push({ filename: image.filename, contentType: image.contentType, base64: image.base64 });
  }

  return { draft: draft as unknown as PostDraft, images, previousSlug };
}

export async function POST(request: NextRequest): Promise<Response> {
  // 1. The session cookie. Everything below this line assumes the site owner.
  if (!(await isAuthenticated(request.cookies))) {
    return json(401, { ok: false, message: 'Your session has expired. Sign in again and retry.' });
  }

  // 2. The credential that publishes. Named in the message so a fresh deployment
  //    says exactly which setting is missing.
  const token = (process.env.GITHUB_TOKEN ?? '').trim();
  if (token.length === 0) {
    return json(503, {
      ok: false,
      message:
        'GITHUB_TOKEN is not set for this deployment, so nothing can be committed. Bind it as a Worker secret (or in the workspace environment) and try again.',
    });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: 'That article is larger than this endpoint accepts (25 MB).' });
  }

  const payload = readPayload(await request.json().catch(() => null));
  if (!payload) {
    return json(400, { ok: false, message: 'The publish payload was not in the expected shape.' });
  }

  const { draft, images } = payload;

  // 3. The article's own rules.
  const errors = validateDraft(draft);
  if (Object.keys(errors).length > 0) {
    return json(400, { ok: false, message: 'The article is not ready to publish.', errors });
  }

  // ...and the images'.
  if (images.length > MAX_IMAGES) {
    return json(400, { ok: false, message: `An article can carry at most ${MAX_IMAGES} images.` });
  }
  const totalBytes = images.reduce((sum, image) => sum + base64ByteLength(image.base64), 0);
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return json(400, { ok: false, message: 'The images total more than 20 MB. Resize them and retry.' });
  }
  for (const image of images) {
    const problem = validateImage(image);
    if (problem) return json(400, { ok: false, message: problem });
  }

  //
  // Every image the article references must either be part of this upload or
  // already be in the repository. The first case is a new image; the second is an
  // edit's body pointing at images an earlier publish committed — which is normal,
  // and the reason this check is an existence lookup rather than a demand that
  // everything be re-uploaded on every save.
  const inUpload = new Set(images.map((image) => publicImagePath(image.filename)));
  const absent: string[] = [];

  const cover = draft.coverImage.trim();
  if (cover.startsWith(POST_IMAGE_PUBLIC_PATH) && !inUpload.has(cover)) {
    if (!(await fileExists(imageRepoPath(cover.slice(POST_IMAGE_PUBLIC_PATH.length)), token))) {
      absent.push(cover);
    }
  }

  const { missing } = referencedUploads(draft.content, images);
  for (const url of missing) {
    if (!(await fileExists(imageRepoPath(url.slice(POST_IMAGE_PUBLIC_PATH.length)), token))) {
      absent.push(url);
    }
  }
  if (absent.length > 0) {
    return json(400, {
      ok: false,
      message: `The article references ${absent.join(', ')}, which is neither part of this upload nor in the repository. Re-insert those images so they are uploaded with the article.`,
    });
  }

  // 4. Commit. Images first, then the article — see lib/admin/github.ts.
  const repo = repository();
  if (repo.length === 0) {
    return json(503, { ok: false, message: 'The CMS schema does not name a GitHub repository to publish to.' });
  }

  try {
    const result = await publishArticle({ draft, images, token });

    // A rename: the new file is committed above, the old one is removed here —
    // in that order, so the article is never missing while the rename is in
    // flight. A failure to remove is reported as a warning rather than an error,
    // because the save itself succeeded.
    const warnings: string[] = [];
    if (payload.previousSlug && payload.previousSlug !== draft.slug.trim()) {
      try {
        await deleteFile({
          path: postRepoPath(payload.previousSlug),
          message: `Rename "${draft.title.trim()}" to ${draft.slug.trim()}`,
          token,
        });
      } catch (renameError) {
        warnings.push(
          renameError instanceof GithubError
            ? `The article was saved, but removing the old file failed: ${renameError.message}`
            : `The article was saved, but removing the old file failed: ${renameError instanceof Error ? renameError.message : String(renameError)}`
        );
      }
    }

    return json(200, {
      ok: true,
      slug: result.slug,
      // The route the site actually serves the article from. It moved from
      // `/blog` to `/guides` when the two content trees were merged; the old
      // path survives only as a permanent redirect, so this is the address to
      // link to and the one the dashboard shows back to the author.
      url: `/guides/${result.slug}`,
      repository: repo,
      ...(warnings.length > 0 ? { warnings } : {}),
      commits: result.commits.map((commit) => ({ path: commit.path, created: commit.created })),
    });
  } catch (error) {
    if (error instanceof GithubError) {
      // 502: the failure is upstream, and GitHub's own words are in the message.
      return json(502, { ok: false, message: error.message });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return json(500, { ok: false, message: `Publishing failed before GitHub accepted the request: ${detail}` });
  }
}
