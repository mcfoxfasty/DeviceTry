/**
 * Publishing by committing to the repository — no OAuth, no GitHub App.
 *
 * The dashboard's server side holds one credential (`GITHUB_TOKEN`) and uses the
 * contents API directly:
 *
 *     PUT https://api.github.com/repos/{owner}/{repo}/contents/{path}
 *
 * with the file as base64, the branch, and the existing blob's `sha` when the file
 * is already there. That is the whole of it. There is no per-user identity to
 * obtain, so there is nothing to hand off to github.com and nothing that can come
 * back with a token that does not work — the two failure modes that made the
 * previous Keystatic flow fragile.
 *
 * WHY IMAGES ARE COMMITTED BEFORE THE ARTICLE.
 * The Markdown links images at their final public paths. If the article landed
 * first, a build between the two commits would publish an article whose images
 * 404. Images first means the worst case is an unreferenced image, which is
 * invisible to readers and fixed by the next publish of the same article.
 *
 * WHY EVERY PUT LOOKS UP A `sha` FIRST.
 * The contents API refuses to overwrite an existing file without one (it answers
 * 409), so an edit has to read the current blob before writing. A 404 from that
 * lookup is the normal case for a brand-new article, not an error.
 *
 * Errors are turned into a sentence that names the status and GitHub's own
 * message, because the operator only sees this in a toast in the dashboard: "401
 * Bad credentials" is actionable, "publish failed" is not.
 */

import keystaticConfig from '@/keystatic.config';
import { composePostFile, imageRepoPath, postRepoPath, type PostDraft, type UploadedImage } from '@/lib/admin/authoring';

/** Articles are published straight to the branch the site builds from. */
export const PUBLISH_BRANCH = 'main';

/** The repository the CMS commits to, read from the schema that reads it back. */
export function repository(): string {
  const storage = keystaticConfig.storage;
  if (storage.kind !== 'github') return '';
  return typeof storage.repo === 'string' ? storage.repo : `${storage.repo.owner}/${storage.repo.name}`;
}

/** The contents endpoint for one path in the repository. */
export function contentsUrl(path: string): string {
  const encoded = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://api.github.com/repos/${repository()}/contents/${encoded}`;
}

/** What one committed file produced. */
export interface CommitResult {
  path: string;
  sha: string;
  created: boolean;
}

/** A refusal from GitHub, carrying enough detail to explain it. */
export class GithubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GithubError';
    this.status = status;
  }
}

function headers(token: string, json = false): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'devicetry-admin',
    // GitHub rejects the write without this header on API versions after 2022.
    'x-github-api-version': '2022-11-28',
    ...(json ? { 'content-type': 'application/json' } : {}),
  };
}

/** The `message` GitHub sent, or a fallback built from the status. */
export function githubErrorMessage(status: number, body: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { message?: unknown; errors?: unknown };
    if (typeof parsed.message === 'string') detail = parsed.message;
    if (detail.length === 0 && Array.isArray(parsed.errors)) {
      detail = parsed.errors
        .map((entry) => (typeof entry === 'object' && entry && 'message' in entry ? String(entry.message) : ''))
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    detail = body.slice(0, 200);
  }

  const advice =
    status === 401
      ? ' GITHUB_TOKEN is missing, expired, or not accepted — it must be a token with Contents: read and write on this repository.'
      : status === 403
        ? ' The token may lack Contents: write, or the API rate limit was hit.'
        : status === 404
          ? ' The repository or branch may not exist, or the token cannot see it.'
          : status === 409
            ? ' The file changed on GitHub since it was read; publish again to pick up the new version.'
            : '';

  return `GitHub refused the request (${status})${detail ? `: ${detail}` : ''}.${advice}`;
}

/** The `sha` of a file already in the repository, or `undefined` when new. */
async function existingSha(
  path: string,
  token: string,
  request: typeof fetch
): Promise<string | undefined> {
  const response = await request(`${contentsUrl(path)}?ref=${PUBLISH_BRANCH}`, {
    headers: headers(token),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }
  const body = (await response.json().catch(() => null)) as { sha?: unknown } | null;
  return typeof body?.sha === 'string' ? body.sha : undefined;
}

/** Create or update one file in the repository. */
export async function commitFile(options: {
  path: string;
  message: string;
  base64: string;
  token: string;
  request?: typeof fetch;
}): Promise<CommitResult> {
  const { path, message, base64, token, request = fetch } = options;
  const sha = await existingSha(path, token, request);

  const response = await request(contentsUrl(path), {
    method: 'PUT',
    headers: headers(token, true),
    body: JSON.stringify({
      message,
      content: base64,
      branch: PUBLISH_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }

  const body = (await response.json().catch(() => null)) as { content?: { sha?: unknown } } | null;
  return {
    path,
    sha: typeof body?.content?.sha === 'string' ? body.content.sha : '',
    created: sha === undefined,
  };
}

/** What a publish produced, in commit order. */
export interface PublishResult {
  slug: string;
  articlePath: string;
  commits: CommitResult[];
}

/**
 * Commit an article and its images.
 *
 * `request` is injectable so the whole flow — payload shape, order, sha handling,
 * error text — can be exercised against a fake GitHub in tests.
 */
export async function publishArticle(options: {
  draft: PostDraft;
  images: UploadedImage[];
  token: string;
  request?: typeof fetch;
}): Promise<PublishResult> {
  const { draft, images, token, request = fetch } = options;
  const slug = draft.slug.trim();
  const commits: CommitResult[] = [];

  for (const image of images) {
    commits.push(
      await commitFile({
        path: imageRepoPath(image.filename),
        message: `Add image ${image.filename} for "${draft.title.trim()}"`,
        base64: image.base64,
        token,
        request,
      })
    );
  }

  const articlePath = postRepoPath(slug);
  commits.push(
    await commitFile({
      path: articlePath,
      message: `Publish "${draft.title.trim()}"`,
      base64: base64EncodeUtf8(composePostFile(draft)),
      token,
      request,
    })
  );

  return { slug, articlePath, commits };
}

/**
 * base64 of a UTF-8 string.
 *
 * `btoa` alone corrupts anything outside Latin-1 — an em dash or a curly quote in
 * an article title would commit mangled bytes — so the string is encoded to UTF-8
 * first.
 */
export function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
