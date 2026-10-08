/**
 * The admin's read side: articles read from the repository, through the API.
 *
 * WHY NOT THE CONTENT READER THE BLOG USES.
 * `lib/blog/content.ts` wraps Keystatic's reader, which resolves
 * `public/guides/*` from the process's working directory. That is exactly right
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
 *
 * TWO CONSUMERS, ONE READER. The dashboard reads the collection to list and edit
 * it, and the PUBLIC site reads it through `lib/articles/registry.ts` to serve an
 * article whose build never saw it (a publish between deploys). Both go through
 * this file, so a CMS article cannot mean one thing to the dashboard and another
 * to the page a reader opens — and both go through the API for the same reason:
 * the build-time reader resolves `public/guides/*` from a working directory that a
 * deployed Worker does not have.
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

/**
 * What the management table needs from one article.
 *
 * `source` and `repoPath` are what let one table hold both collections. An article
 * is either a Markdown file the dashboard writes (`cms`) or a typed module under
 * `content/guides/**` (`legacy`), and every action the table offers has to be sent
 * to the right one — a Delete aimed at the wrong source removes the wrong file.
 */
export interface ArticleSummary {
  slug: string;
  title: string;
  publishedAt: string;
  category: string;
  status: string;
  source: 'cms' | 'legacy';
  /** `public/guides/<slug>.md` for a CMS article; the module path for a guide. */
  repoPath: string;
}

/**
 * One article with everything the editor loads.
 *
 * An edit is always a CMS article — an imported guide is edited as source through
 * its own page — so `source` and `repoPath` are omitted rather than filled with
 * values nothing here uses.
 */
export interface ArticleDetail extends Omit<ArticleSummary, 'source' | 'repoPath'> {
  seoTitle: string;
  seoDescription: string;
  coverImage: string;
  coverImageAlt: string;
  author: string;
  tags: string[];
  canonicalUrl: string;
  content: string;
}

/**
 * One article file, parsed whole: front matter and body together, plus the path it
 * was read from.
 *
 * The management table wants summaries and the site's request-time reader
 * (lib/articles/registry.ts) wants full articles; both are projections of this one
 * record, so front matter is parsed in exactly one place and a field cannot be
 * extracted one way for the dashboard and another way for the site.
 */
export interface ArticleRecord extends ArticleDetail {
  /** `public/guides/<slug>.md`. */
  repoPath: string;
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

/** The slug is the filename: `public/guides/<slug>.md`. */
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
  const response = await request(`${contentsUrl('public/guides')}?ref=${PUBLISH_BRANCH}`, {
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

/**
 * One article file, as a record: front matter plus the body below it.
 *
 * A file with no `status` key predates the field and reads as the state every
 * article had before it existed — `published` — which is what keeps an older file's
 * live URL independent of anyone adding the key.
 */
export function articleFromFile(path: string, file: string): ArticleRecord {
  const { data, body } = parseFrontMatter(file);
  const slug = slugFromPath(path);
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
    repoPath: path,
  };
}

/** Everything a listing needs from one file. */
function summarize(article: ArticleRecord): ArticleSummary {
  return {
    slug: article.slug,
    title: article.title,
    publishedAt: article.publishedAt,
    category: article.category,
    status: article.status,
    source: 'cms',
    repoPath: article.repoPath,
  };
}

/**
 * Every article in the collection with its body, newest first.
 *
 * One request for the listing plus one per file, in parallel. This is what a
 * request-time read of the whole CMS needs: the guide hub lists cards built from
 * front matter, and an article page renders a body, and both are the same read.
 */
export async function listArticleDetails(options: {
  token: string;
  request?: typeof fetch;
}): Promise<ArticleRecord[]> {
  const { token, request = fetch } = options;
  const paths = await listArticlePaths(token, request);

  const records = await Promise.all(
    paths.map(async (path) => {
      const file = await fetchFile(path, token, request);
      return file === null ? null : articleFromFile(path, file);
    })
  );

  return records
    .filter((article): article is ArticleRecord => article !== null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
}

/** Every article in the collection, newest first — all statuses, no bodies. */
export async function listArticles(options: {
  token: string;
  request?: typeof fetch;
}): Promise<ArticleSummary[]> {
  return (await listArticleDetails(options)).map(summarize);
}

/** One article with its body, or `null` when the repository has no such file. */
export async function readArticle(
  slug: string,
  options: { token: string; request?: typeof fetch }
): Promise<ArticleDetail | null> {
  const { token, request = fetch } = options;
  const path = `public/guides/${slug}.md`;
  const file = await fetchFile(path, token, request);
  return file === null ? null : articleFromFile(path, file);
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

/**
 * One article's body and front matter, by source — the read a status change needs.
 *
 * A status change rewrites a file, so it has to read that file first (the contents
 * API refuses a write without the current `sha`, and lib/admin/authoring.ts rewrites
 * only the one key). Returning `null` rather than throwing lets the endpoint answer
 * "that article is not in the repository" as a 404 instead of a 500.
 */
export async function readArticleFile(
  slug: string,
  options: { token: string; request?: typeof fetch }
): Promise<{ path: string; file: string } | null> {
  const { token, request = fetch } = options;
  const path = `public/guides/${slug}.md`;
  const file = await fetchFile(path, token, request);
  return file === null ? null : { path, file };
}