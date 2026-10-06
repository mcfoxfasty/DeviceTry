import {
  MAX_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  base64ByteLength,
  publicImagePath,
  referencedUploads,
  validateDraft,
  validateImage,
  type PostDraft,
  type PublishPayload,
  type UploadedImage,
} from '@/lib/admin/authoring';
import type { NextRequest } from 'next/server';
import { GithubError, publishArticle, repository } from '@/lib/admin/github';
import { isAuthenticated } from '@/lib/admin/session';

/**
 * Publishing: authenticated, validated, then committed to GitHub.
 *
 * THE ORDER OF THE CHECKS MATTERS.
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

/** Structural check of the payload, before any rule that needs real fields. */
function readPayload(value: unknown): PublishPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { draft?: unknown; images?: unknown };
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
    'canonicalUrl',
    'content',
  ] as const;
  for (const field of strings) {
    if (typeof draft[field] !== 'string') return null;
  }
  if (!Array.isArray(draft.tags) || draft.tags.some((tag) => typeof tag !== 'string')) return null;

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

  return { draft: draft as unknown as PostDraft, images };
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

  // The cover is committed like any other image, so it has to be one of them:
  // a path that points at a file nobody uploaded would publish a broken lead image.
  const cover = draft.coverImage.trim();
  if (cover.startsWith('/images/posts/') && !images.some((image) => publicImagePath(image.filename) === cover)) {
    return json(400, {
      ok: false,
      message: 'The cover image is not part of this upload. Choose the cover again so it is included.',
    });
  }

  const { missing } = referencedUploads(draft.content, images);
  if (missing.length > 0) {
    return json(400, {
      ok: false,
      message: `The body references ${missing.join(', ')}, which this upload does not contain. Re-insert those images so they are uploaded with the article.`,
    });
  }

  // 4. Commit. Images first, then the article — see lib/admin/github.ts.
  const repo = repository();
  if (repo.length === 0) {
    return json(503, { ok: false, message: 'The CMS schema does not name a GitHub repository to publish to.' });
  }

  try {
    const result = await publishArticle({ draft, images, token });
    return json(200, {
      ok: true,
      slug: result.slug,
      url: `/blog/${result.slug}`,
      repository: repo,
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
