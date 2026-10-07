/**
 * The dashboard's view of the IMPORTED guides — `content/guides/**\/*.ts`.
 *
 * WHY THE DASHBOARD HAS TO KNOW ABOUT THESE AT ALL.
 * The site has two collections of articles and the management view used to show
 * only one of them. `/admin` listed the CMS articles in `public/guides/*.md` and
 * said nothing about the sixteen typed guides under `content/guides/**` — so the
 * dashboard reported a collection of two while `/guides` served eighteen pages, and
 * the guides that get the most traffic were the ones nobody could see, publish or
 * retire from it. This module closes that gap over the same GitHub API the CMS side
 * uses (see lib/admin/articles.ts for why the API and not the working directory).
 *
 * WHY THESE ARE EDITED AS SOURCE AND NOT CONVERTED TO MARKDOWN.
 * A typed guide is not Markdown with extra fields. Its figures are registered
 * assets, its sections drive the article template's tables and product boxes, its
 * FAQ set feeds the page's FAQPage graph, and `tests/*.test.ts` asserts its prose
 * links resolve. Flattening one into a Markdown file to make it "editable" would
 * change a published page's structure, drop its schema validation, and turn a
 * source module into a lossy copy. So the dashboard manages these where they live:
 * it flips `published`, and the editor for one opens the module itself.
 *
 * THE PARSER IS DELIBERATELY SMALL. It reads the handful of top-level scalar fields
 * the management table needs — the ones written inline, at the object literal's own
 * indentation — and ignores everything nested, which is where the article's prose
 * lives. A guide whose `slug` it cannot read is reported as unreadable rather than
 * listed with an invented one, because a row the dashboard cannot address is a row
 * whose Delete button would remove the wrong file.
 */

import {
  GithubError,
  contentsUrl,
  deleteFile,
  githubErrorMessage,
  githubHeaders,
  commitFile,
  PUBLISH_BRANCH,
  repository,
} from '@/lib/admin/github';
import { decodeBase64Content } from '@/lib/admin/articles';

/** Where the imported guides live, and what counts as one. */
export const LEGACY_GUIDE_ROOT = 'content/guides';

/** The two files in that tree that are not articles. */
const NOT_ARTICLES = new Set([`${LEGACY_GUIDE_ROOT}/index.ts`, `${LEGACY_GUIDE_ROOT}/schema.ts`]);

/** What the management table needs from one imported guide. */
export interface LegacyGuideSummary {
  slug: string;
  title: string;
  /** ISO `YYYY-MM-DD`, from the module's own `publishedAt`. */
  publishedAt: string;
  category: string;
  /** The module's `published` flag. Its whole public visibility, in one boolean. */
  published: boolean;
  /** `published` as the dashboard's status vocabulary. */
  status: 'published' | 'archived';
  /** `content/guides/audio/microphone-not-working.ts`. */
  repoPath: string;
  /** The exported identifier, `microphoneNotWorking` — what index.ts imports. */
  exportName: string;
}

/** A guide's module source, as read for the source editor. */
export interface LegacyGuideSource extends LegacyGuideSummary {
  source: string;
}

/** True when a repository path is an imported guide module rather than index/schema. */
export function isLegacyGuidePath(path: string): boolean {
  if (!path.startsWith(`${LEGACY_GUIDE_ROOT}/`) || !path.endsWith('.ts')) return false;
  if (NOT_ARTICLES.has(path)) return false;
  // One directory deep, which is the shape content/guides uses: a category folder
  // holding the article modules. A deeper path would be a helper, not an article.
  return /^content\/guides\/[^/]+\/[^/]+\.ts$/.test(path);
}

/**
 * The value of a top-level field, from the first line that declares it.
 *
 * Indentation is the signal: the article's own fields are written at the object
 * literal's indentation (two spaces), and everything below them — the sections,
 * with `h2`, `paragraphs`, `steps` — is nested deeper. Requiring the field to sit
 * at 0–3 spaces is what keeps `h2:` and a section's own `slug`-looking text out of
 * the answer.
 */
function topLevelValue(source: string, key: string): string | null {
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^( {0,3})([A-Za-z][A-Za-z0-9_]*):(.*)$/);
    if (!match || match[2] !== key) continue;
    const inline = match[3].trim();
    if (inline.length > 0) return inline;
    // A value written on the following lines (a wrapped `description`, `title` or
    // `intro`). Joined until a line returns to the same or shallower indentation.
    const body: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next];
      if (line.trim().length === 0) break;
      const indent = line.match(/^ */)?.[0].length ?? 0;
      if (indent <= match[1].length) break;
      body.push(line.trim());
    }
    return body.length > 0 ? body.join(' ') : null;
  }
  return null;
}

/** A single-quoted TypeScript string, unescaped the way the modules write them. */
function unquote(value: string): string {
  const trimmed = value.trim().replace(/,$/, '').trim();
  const quoted = trimmed.match(/^'((?:[^'\\]|\\.)*)'$/);
  if (quoted) return quoted[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return trimmed;
}

/** `new Date('2026-08-14')` → `2026-08-14`. */
export function isoDayFromDateExpression(value: string): string {
  const match = value.match(/new Date\(\s*'(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/**
 * Read one guide module's identifying fields, or `null` when it is not an article.
 *
 * `null` is the honest answer for a `.ts` file with no `slug` or no `published`
 * flag: one is a module the dashboard cannot address, the other is a module whose
 * public visibility it cannot report. Both are surfaced as a read error instead.
 */
export function parseLegacyGuide(source: string, path: string): LegacyGuideSummary | null {
  const slug = topLevelValue(source, 'slug');
  const title = topLevelValue(source, 'title');
  const published = topLevelValue(source, 'published');
  const exportName = source.match(/export const ([A-Za-z0-9_]+)\s*:\s*GuideArticle/)?.[1] ?? '';
  if (slug === null || title === null || published === null || exportName.length === 0) return null;

  return {
    slug: unquote(slug),
    title: unquote(title),
    publishedAt: isoDayFromDateExpression(topLevelValue(source, 'publishedAt') ?? ''),
    category: unquote(topLevelValue(source, 'category') ?? '') || 'how-to',
    published: unquote(published).toLowerCase() === 'true',
    status: unquote(published).toLowerCase() === 'true' ? 'published' : 'archived',
    repoPath: path,
    exportName,
  };
}

/**
 * Set the module's `published` flag, and nothing else.
 *
 * The flag is the whole of a guide's public visibility — the guides registry filters
 * on it, which is what keeps an unpublished guide out of `/guides`, the sitemap and
 * the static params — so publishing or retiring a guide is exactly this one edit.
 * Only the FIRST top-level occurrence is rewritten, so a `published:` written inside
 * a section's data (there is no such field today, but there could be) cannot be the
 * one that changes.
 */
export function withLegacyPublished(source: string, published: boolean): string {
  const pattern = /^( {0,3}published:\s*)(true|false)(\s*,?\s*)$/m;
  const match = source.match(pattern);
  if (!match) return source;
  const replaced = `${match[1]}${published ? 'true' : 'false'}${match[3]}`;
  const at = source.indexOf(match[0]);
  return `${source.slice(0, at)}${replaced}${source.slice(at + match[0].length)}`;
}

/**
 * Remove one guide from `content/guides/index.ts` — its import and its array entry.
 *
 * ORDER MATTERS AT THE CALL SITE. Deleting the module first would leave index.ts
 * importing a file that no longer exists, which is a build failure, not a missing
 * article. So the index is committed first: a repository with an unreferenced
 * module is still a repository that builds, and the module is removed after.
 *
 * The module is matched by the PATH its import names, not by the exported
 * identifier, because the path is what has to stop existing. Whatever is returned
 * must differ from the input — the caller refuses to delete a file it could not
 * detach from the index, since that is the one case that breaks the site.
 */
export function withoutGuide(source: string, slug: string): string {
  const importLine = new RegExp(`^import \\{ ([A-Za-z0-9_]+) \\} from '\\./(?:[^'/]+/)?${slug}';\$`, 'm');
  const imported = source.match(importLine);
  if (!imported) return source;
  const exportName = imported[1];

  const entryLine = new RegExp(`^\\s*${exportName},\\s*\$`, 'm');
  if (!entryLine.test(source)) return source;

  return source
    .replace(importLine, '')
    .replace(entryLine, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * The module's identifying fields, and the rules a save has to keep — the guard
 * itself lives in lib/admin/source-guard.ts, which has no imports so the browser
 * editor can run the same function before suggesting a save.
 */
export { sourceProblems } from '@/lib/admin/source-guard';

/** Every guide module's path in the repository, from one recursive tree read. */
export async function listLegacyGuidePaths(
  token: string,
  request: typeof fetch = fetch
): Promise<string[]> {
  const response = await request(
    `https://api.github.com/repos/${repository()}/git/trees/${PUBLISH_BRANCH}?recursive=1`,
    { headers: githubHeaders(token) }
  );
  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }
  const body = (await response.json().catch(() => null)) as { tree?: unknown } | null;
  if (!Array.isArray(body?.tree)) {
    throw new GithubError(response.status, 'GitHub returned the repository tree in an unexpected shape.');
  }
  return body.tree
    .filter(
      (entry): entry is { path: string; type?: string } =>
        typeof entry === 'object' && entry !== null && typeof (entry as { path?: unknown }).path === 'string'
    )
    .filter((entry) => entry.type !== 'tree')
    .map((entry) => entry.path)
    .filter(isLegacyGuidePath);
}

/** One file's text, as base64 through the contents API. */
async function fetchText(path: string, token: string, request: typeof fetch): Promise<string> {
  const response = await request(`${contentsUrl(path)}?ref=${PUBLISH_BRANCH}`, {
    headers: githubHeaders(token),
  });
  if (!response.ok) {
    throw new GithubError(response.status, githubErrorMessage(response.status, await response.text()));
  }
  const body = (await response.json().catch(() => null)) as { content?: unknown } | null;
  if (typeof body?.content !== 'string') {
    throw new GithubError(response.status, `GitHub returned ${path} without its content.`);
  }
  return decodeBase64Content(body.content);
}

/**
 * The whole imported-guide collection, read in one pass.
 *
 * `unreadable` is returned alongside the guides rather than dropped, because a
 * module this parser cannot address is exactly the kind of article the old
 * dashboard hid: it would be missing from the table with nothing said about it. The
 * page names those paths instead, so the fix is a glance rather than an
 * investigation.
 */
export async function readLegacyCollection(options: {
  token: string;
  request?: typeof fetch;
}): Promise<{ guides: LegacyGuideSummary[]; unreadable: string[] }> {
  const { token, request = fetch } = options;
  const paths = await listLegacyGuidePaths(token, request);

  const read = await Promise.all(
    paths.map(async (path) => ({ path, summary: parseLegacyGuide(await fetchText(path, token, request), path) }))
  );

  const guides = read
    .map((entry) => entry.summary)
    .filter((guide): guide is LegacyGuideSummary => guide !== null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));

  return { guides, unreadable: read.filter((entry) => entry.summary === null).map((entry) => entry.path) };
}

/** Every imported guide in the repository, readable ones only. */
export async function listLegacyGuides(options: {
  token: string;
  request?: typeof fetch;
}): Promise<LegacyGuideSummary[]> {
  return (await readLegacyCollection(options)).guides;
}

/**
 * One guide with its module source, addressed by the slug the module declares.
 *
 * The cheap path first: the modules are named after their slugs, so the tree
 * listing usually names the file to read without reading sixteen of them. A module
 * whose filename and declared slug disagree falls back to reading the collection,
 * which is the only way to be sure the answer is the file that actually declares
 * this slug.
 */
export async function readLegacyGuide(
  slug: string,
  options: { token: string; request?: typeof fetch }
): Promise<LegacyGuideSource | null> {
  const { token, request = fetch } = options;
  const paths = await listLegacyGuidePaths(token, request);
  const named = paths.find((path) => path.endsWith(`/${slug}.ts`));
  if (named) {
    const source = await fetchText(named, token, request);
    const summary = parseLegacyGuide(source, named);
    if (summary && summary.slug === slug) return { ...summary, source };
  }

  const guides = await listLegacyGuides({ token, request });
  const found = guides.find((guide) => guide.slug === slug);
  if (!found) return null;
  return { ...found, source: await fetchText(found.repoPath, token, request) };
}

/** Publish or retire an imported guide, by committing its `published` flag. */
export async function setLegacyGuideStatus(options: {
  guide: LegacyGuideSummary;
  published: boolean;
  token: string;
  request?: typeof fetch;
}): Promise<{ path: string; created: boolean }> {
  const { guide, published, token, request = fetch } = options;
  const source = await fetchText(guide.repoPath, token, request);
  const updated = withLegacyPublished(source, published);
  if (updated === source && guide.published !== published) {
    throw new GithubError(
      422,
      `Could not find the top-level \`published\` flag in ${guide.repoPath}, so its visibility cannot be changed from here.`
    );
  }

  const commit = await commitFile({
    path: guide.repoPath,
    message: published ? `Publish guide "${guide.title}"` : `Retire guide "${guide.title}"`,
    base64: base64For(updated),
    token,
    request,
  });
  return { path: commit.path, created: commit.created };
}

/** base64 of a UTF-8 string, without Node's Buffer (this runs on a Worker too). */
function base64For(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The index module that lists every guide, as text. */
export async function readGuidesIndex(token: string, request: typeof fetch = fetch): Promise<string> {
  return fetchText(`${LEGACY_GUIDE_ROOT}/index.ts`, token, request);
}

/**
 * Delete an imported guide: detach it from the index first, then remove the module.
 *
 * The two commits happen in that order deliberately — see withoutGuide. If the
 * module cannot be removed after the index no longer references it, the result is an
 * unreferenced file, which the next publish of the same guide can clean up, rather
 * than an import of a missing file, which fails the build.
 */
export async function deleteLegacyGuide(options: {
  guide: LegacyGuideSummary;
  token: string;
  request?: typeof fetch;
}): Promise<{ path: string; deleted: boolean; indexUpdated: boolean }> {
  const { guide, token, request = fetch } = options;

  const indexSource = await readGuidesIndex(token, request);
  const withoutIt = withoutGuide(indexSource, guide.slug);
  const indexUpdated = withoutIt !== indexSource;
  if (!indexUpdated) {
    throw new GithubError(
      422,
      `${guide.repoPath} is not referenced by ${LEGACY_GUIDE_ROOT}/index.ts in a form this dashboard can edit, so deleting it would break the build. Remove its import and its entry in ${LEGACY_GUIDE_ROOT}/index.ts by hand, then delete it here.`
    );
  }

  await commitFile({
    path: `${LEGACY_GUIDE_ROOT}/index.ts`,
    message: `Remove "${guide.title}" from the guides index`,
    base64: base64For(withoutIt),
    token,
    request,
  });

  const removed = await deleteFile({
    path: guide.repoPath,
    message: `Delete guide "${guide.slug}"`,
    token,
    request,
  });
  return { path: guide.repoPath, deleted: removed.deleted, indexUpdated };
}
