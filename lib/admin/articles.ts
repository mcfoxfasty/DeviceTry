/**
 * The admin's read side: articles read from the repository, through the API.
 *
 * WHY NOT THE CONTENT READER THE BLOG USES.
 * `lib/blog/content.ts` wraps Keystatic's reader, which resolves
 * `content/posts/*` from the process's working directory. That is exactly right
 * during a build — the blog is prerendered, so those reads happen where the files
 * are — and exactly wrong in the deployed Worker, which has no working directory
 * with the repository in it: verified on the live deployment (2026-10-07), the
 * management view rendered "No articles yet" while the article file was present
 * in the bundle, because the reader's glob found nothing.
 *
 * So the dashboard asks GitHub. It is the same source the publish endpoint writes
 * to, which also means the list is never a build behind: an article committed a
 * minute ago is listed, and a deleted one is gone, without waiting for a deploy.
 *
 * WHAT IT COSTS. One request for the directory listing and one per article, in
 * parallel: for a single-author blog that is a few hundred milliseconds and a
 * rounding error against the API's rate limit.
 *
 * THE PARSER IS SMALL ON PURPOSE. Only the front matter the dashboard itself
 * writes has to be understood — plain scalars, single-quoted scalars (with `''`
 * for an embedded quote), `null`, and `tags` as a block sequence — plus the body
 * below the closing delimiter. It is not a YAML implementation, and it is tested
 * against the article already in the repository as well as against composed
 * drafts, so a change in that format fails a test rather than the dashboard.
 */

import {
  GithubError,
  contentsUrl,
  githubErrorMessage,
  githubHeaders,
  PUBLISH_BRANCH,
  repository,
} from '@/lib/admin/github';
import { DEFAULT_POST_STATUS } from '@/keystatic.config';

/** What the management table needs from one article. */
export interface ArticleSummary {
  slug: string;
  title: string;
  publishedAt: string;
  category: string;
  status: string;
}

/** One article with everything the editor loads. */
export interface ArticleDetail extends ArticleSummary {
  seoTitle: string;
  seoDescription: string;
  coverImage: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  canonicalUrl: string;
  content: string;
}

export interface FrontMatter {
  /** Scalars and scalar arrays, as written; `null` when the key says null. */
  data: Record<string, string | string[] | null>;
  /** Everything below the closing `---`, without the leading blank line. */
  body: string;
}

/** A scalar: `null`, an empty string, or a quoted or plain string. */
function parseScalar(raw: string): string | null {
  const value = raw.trim();
  if (value === 'null' || value === '~') return null;
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

/**
 * Split an article file into its front matter and its body.
 *
 * A file with no front matter comes back with an empty `data` and the whole text
 * as the body, which is the honest reading of a file that does not declare one.
 */
export function parseFrontMatter(file: string): FrontMatter {
  const text = file.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { data: {}, body: text };

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing === -1) return { data: {}, body: text };

  const data: Record<string, string | string[] | null> = {};
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0 || /^\s/.test(line)) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rest = line.slice(separator + 1);

    if (rest.trim().length === 0) {
      // A block sequence follows, if the next lines are `  - item`.
      const items: string[] = [];
      let cursor = index + 1;
      while (cursor < closing && /^\s+-\s*/.test(lines[cursor])) {
        const parsed = parseScalar(lines[cursor].replace(/^\s+-\s*/, ''));
        if (parsed !== null) items.push(parsed);
        cursor += 1;
      }
      if (items.length > 0) {
        data[key] = items;
        index = cursor - 1;
      } else {
        data[key] = null;
      }
      continue;
    }

    data[key] = parseScalar(rest);
  }

  return { data, body: lines.slice(closing + 1).join('\n').replace(/^\n/, '') };
}

/** base64 → UTF-8 text, without Node's Buffer so the same code runs on a Worker. */
export function decodeBase64Content(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function asString(value: string | string[] | null, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** The slug is the filename: `content/posts/<slug>.md`. */
function slugFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.mdx?$/, '') ?? '';
}

/** The text of one file in the repository, or `null` when it is not there. */
async function fetchFile(
  path: string,
  token: string,
  request: typeof fetch
): Promise<string | null> {
  const response = await request(`${contentsUrl(path)}?ref=${PUBLISH_BRANCH}`, {
    headers: githubHeaders(token),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }
  const body = (await response.json().catch(() => null)) as { content?: unknown; encoding?: unknown } | null;
  if (typeof body?.content !== 'string') {
    throw new GithubError(response.status, `GitHub returned ${path} without its content.`);
  }
  return decodeBase64Content(body.content);
}

/** The paths of every article file in the collection. */
async function listArticlePaths(token: string, request: typeof fetch): Promise<string[]> {
  const response = await request(`${contentsUrl('content/posts')}?ref=${PUBLISH_BRANCH}`, {
    headers: githubHeaders(token),
  });
  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }
  const entries = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(entries)) {
    throw new GithubError(response.status, 'GitHub returned the collection in an unexpected shape.');
  }
  return entries
    .filter(
      (entry): entry is { path: string; type?: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { path?: unknown }).path === 'string' &&
        /\.mdx?$/.test((entry as { path: string }).path) &&
        (entry as { type?: unknown }).type !== 'dir'
    )
    .map((entry) => entry.path);
}

/** Everything a listing needs from one file, or `null` if it cannot be read. */
function summarize(path: string, file: string): ArticleSummary {
  const { data } = parseFrontMatter(file);
  const slug = slugFromPath(path);
  return {
    slug,
    title: asString(data.title, slug),
    publishedAt: asString(data.publishedAt),
    category: asString(data.category, 'how-to'),
    // A file without the field predates it, and reads as the state every article
    // had before: published.
    status: asString(data.status, DEFAULT_POST_STATUS),
  };
}

/** Every article in the collection, newest first — all statuses. */
export async function listArticles(options: {
  token: string;
  request?: typeof fetch;
}): Promise<ArticleSummary[]> {
  const { token, request = fetch } = options;
  const paths = await listArticlePaths(token, request);

  const articles = await Promise.all(
    paths.map(async (path) => {
      const file = await fetchFile(path, token, request);
      return file === null ? null : summarize(path, file);
    })
  );

  return articles
    .filter((article): article is ArticleSummary => article !== null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
}

/** One article with its body, or `null` when the repository has no such file. */
export async function readArticle(
  slug: string,
  options: { token: string; request?: typeof fetch }
): Promise<ArticleDetail | null> {
  const { token, request = fetch } = options;
  const file = await fetchFile(`content/posts/${slug}.md`, token, request);
  if (file === null) return null;

  const { data, body } = parseFrontMatter(file);
  const tags = Array.isArray(data.tags) ? data.tags : [];
  return {
    slug,
    title: asString(data.title, slug),
    publishedAt: asString(data.publishedAt),
    category: asString(data.category, 'how-to'),
    status: asString(data.status, DEFAULT_POST_STATUS),
    seoTitle: asString(data.seoTitle),
    seoDescription: asString(data.seoDescription),
    coverImage: asString(data.coverImage),
    coverImageAlt: asString(data.coverImageAlt),
    author: asString(data.author, 'DeviceTry team'),
    tags,
    canonicalUrl: asString(data.canonicalUrl),
    content: body,
  };
}

/** True when a token is configured, so a page can say what is missing by name. */
export function hasPublishToken(): boolean {
  return (process.env.GITHUB_TOKEN ?? '').trim().length > 0;
}

/** The token the admin reads and writes with. */
export function publishToken(): string {
  return (process.env.GITHUB_TOKEN ?? '').trim();
}

/** The repository the dashboard manages, for a page that wants to name it. */
export function managedRepository(): string {
  return repository();
}
