/**
 * One URL space for every article the site publishes, whatever wrote it.
 *
 * The site has two kinds of article and they now share `/guides/<slug>`:
 *
 *  - an IMPORTED guide — a typed module under `content/guides/**` with sections,
 *    figures, product boxes and its own FAQ set, rendered by GuideArticleView;
 *  - a CMS article — a Markdown file at `public/guides/<slug>.md`, written in the
 *    dashboard and compiled by PostBody.
 *
 * WHY THIS MODULE EXISTS. Before it, the two lived at two roots (`/guides` and
 * `/blog`) and each had its own index, its own static params and its own sitemap
 * loop. Three places that must agree about "which articles exist" is three places
 * that can disagree, and the sitemap had already grown a comment explaining why
 * it read the collection twice. This is that list, once.
 *
 * HOW AN ARTICLE IS FOUND, IN ORDER:
 *
 *  1. THE BUILD — the typed guides and the CMS files that existed when the bundle
 *     was built, read through the build-time readers. These pages are prerendered,
 *     so this is the fast path and the one that serves almost every request.
 *  2. THE REPOSITORY — when a slug names no built article, the CMS collection is
 *     read live through the GitHub API (`listLiveArticles` / `resolveLiveArticle`),
 *     which is what makes an article published a minute ago reachable instead of
 *     answering 404 until the next deploy. It runs only when a token is configured;
 *     without one the site behaves exactly as it did before — build-time content,
 *     nothing more.
 *  3. NOTHING — a slug in neither is a 404, and that is the honest answer.
 *
 * WHY THE LIVE READ IS A FILL, NOT A REPLACEMENT. A prerendered page cannot be
 * recalled at request time, so serving an edited article from the repository while
 * its static page still says otherwise would put two versions of one article on the
 * site at once. The bundle stays the snapshot a reader sees; the live read answers
 * for slugs the snapshot does not have, and the hub lists those alongside the rest.
 * An edit therefore reaches readers on the next build, and a *new* article reaches
 * them immediately — which is the case that used to 404.
 *
 * COLLISIONS RESOLVE TO THE GUIDE, deterministically. A typed guide is
 * hand-authored: its figures are registered assets, its FAQ set is written, and its
 * prose is link-checked by tests. A CMS article is a Markdown file that can be
 * renamed in a dashboard. If a slug somehow names both, the richer, test-covered
 * article wins rather than whatever the filesystem listed first. `collidingSlugs`
 * reports the overlap so the dashboard can surface it instead of the site
 * silently serving one of them.
 */

import { getGuideBySlug, getPublishedGuides } from '@/lib/guides/registry';
import { getPost, listPublishedPosts } from '@/lib/blog/content';
import {
  hasPublishToken,
  listArticleDetails,
  publishToken,
  readArticle as readArticleFromRepository,
} from '@/lib/admin/articles';
import type { ArticleDetail } from '@/lib/admin/articles';
import type { GuideArticle } from '@/content/guides/schema';
import type { BlogPost, BlogPostMeta } from '@/lib/blog/content';

/** Which file wrote an article: a typed module, or a Markdown file from the CMS. */
export type ArticleSource = 'guide' | 'cms';

/** Everything an index, a listing or a sitemap entry needs — and no body. */
export interface PublishedArticleRef {
  slug: string;
  source: ArticleSource;
  title: string;
  /** The site's taxonomy value: `audio`, `input-gaming`, `how-to`, … */
  category: string;
  /** ISO `YYYY-MM-DD` where the source has one. */
  publishedAt: string;
  description: string;
  coverImage: string;
  coverImageAlt: string;
  /** The article's own kind, for a card's label. */
  type: string;
  /**
   * The article's own tags. Empty for an imported guide, which has no tag field
   * — its `relatedToolSlugs` and category are what its subject is expressed as.
   * Carried here because the related-articles footer ranks on shared topics and
   * an article's tags are the clearest statement of what it is about.
   */
  tags: string[];
}

/**
 * Where a resolved article was read from. Not decoration: an article from the
 * BUILD is prerendered and its body was compiled by the MDX compiler, while an
 * article from the REPOSITORY was read at request time and must be rendered by the
 * eval-free renderer — the Worker bans dynamic code evaluation, which is exactly
 * what compiling MDX at request time would need. The page branches on this.
 */
export type ArticleOrigin = 'build' | 'repository';

/** A resolved article, carrying the source object so the page can render it. */
export type ResolvedArticle =
  | { source: 'guide'; slug: string; guide: GuideArticle }
  | { source: 'cms'; slug: string; post: BlogPost; origin: ArticleOrigin };

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/** An imported guide, as the shared shape. */
function guideRef(guide: GuideArticle): PublishedArticleRef {
  return {
    slug: guide.slug,
    source: 'guide',
    title: guide.title,
    category: guide.category,
    publishedAt: isoDay(guide.publishedAt),
    description: guide.description,
    coverImage: guide.featuredImage?.src ?? '',
    coverImageAlt: guide.featuredImage?.alt ?? '',
    type: guide.type,
    tags: [],
  };
}

/** A CMS article, as the shared shape. `listPosts` returns front matter only. */
function postRef(post: BlogPostMeta): PublishedArticleRef {
  return {
    slug: post.slug,
    source: 'cms',
    title: post.title,
    category: post.category,
    publishedAt: post.publishedAt,
    description: post.seoDescription ?? '',
    coverImage: post.coverImage,
    coverImageAlt: post.coverImageAlt,
    type: 'how-to',
    tags: [...post.tags],
  };
}

/** A repository-read article, as the shared shape. */
function articleDetailRef(article: ArticleDetail): PublishedArticleRef {
  return {
    slug: article.slug,
    source: 'cms',
    title: article.title,
    category: article.category,
    publishedAt: article.publishedAt,
    description: article.seoDescription,
    coverImage: article.coverImage,
    coverImageAlt: article.coverImageAlt,
    type: 'how-to',
    tags: [...article.tags],
  };
}

/**
 * A repository-read article, as the post shape the article page and its foot
 * already work with. The empty strings the reader uses for an absent optional field
 * (`seoTitle`, `canonicalUrl`) are what `lib/blog/seo.ts` treats as "not set", so
 * the two readers agree on what a missing field means.
 */
function postFromArticleDetail(article: ArticleDetail): BlogPost {
  return {
    slug: article.slug,
    title: article.title,
    content: article.content,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    coverImage: article.coverImage,
    coverImageAlt: article.coverImageAlt,
    publishedAt: article.publishedAt,
    author: article.author,
    category: article.category,
    status: article.status,
    tags: [...article.tags],
    canonicalUrl: article.canonicalUrl,
  };
}

/**
 * What a slug may look like before it is used as a path.
 *
 * The same rule `/api/admin/publish` applies to its own input, for the same
 * reason: a slug becomes `public/guides/<slug>.md`, so anything that could climb
 * out of that directory has to be refused as a slug rather than survive into a
 * path. A URL segment arrives percent-decoded and can contain anything at all.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The slugs that exist in both collections. Empty in a healthy repository. */
export function collidingSlugs(
  guideSlugs: string[] = getPublishedGuides().map((guide) => guide.slug),
  postSlugs: string[] = []
): string[] {
  const guides = new Set(guideSlugs);
  return postSlugs.filter((slug) => guides.has(slug));
}

/**
 * Every published article the build knows about, newest first — guides and CMS
 * articles in one list.
 *
 * Public readers (the guides hub, the sitemap, the static params) go through here,
 * so a draft or an archived article cannot reach one of them and be missing from
 * another: both sources are filtered at the point they are read.
 */
export async function listPublishedArticles(): Promise<PublishedArticleRef[]> {
  const guides = getPublishedGuides().map(guideRef);
  const posts = (await listPublishedPosts()).map(postRef);
  const guideSlugs = new Set(guides.map((guide) => guide.slug));

  return [...guides, ...posts.filter((post) => !guideSlugs.has(post.slug))].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0
  );
}

/** One built article by its slug, or `null` when the build has no such article. */
export async function resolvePublishedArticle(slug: string): Promise<ResolvedArticle | null> {
  const guide = getGuideBySlug(slug);
  if (guide) return { source: 'guide', slug: guide.slug, guide };

  const post = await getPost(slug);
  if (!post || post.status !== 'published') return null;
  return { source: 'cms', slug: post.slug, post, origin: 'build' };
}

// ------------------------------------------------------- the repository read

/**
 * The live CMS read, memoised for a minute.
 *
 * A request-time read is one GitHub request for the directory listing plus one per
 * article, and the hub asks for it on every render — for a site whose articles
 * change a few times a day, paying that on every page view would be a self-inflicted
 * rate limit. A short window keeps a publish visible within a minute while making a
 * reader's page view cost nothing.
 *
 * The memo is used ONLY for the ambient read (the deployment's own token). A caller
 * that passes an explicit token or `request` — the tests — bypasses it entirely, so
 * a cached list can never answer for a reader that was asked a different question.
 */
const LIVE_READ_TTL_MS = 60_000;

interface LiveReadOptions {
  /** Overrides the deployment's token. An empty string means "do not read". */
  token?: string;
  /** The `fetch` to use, for tests. Passing this also bypasses the memo. */
  request?: typeof fetch;
}

let liveListCache: { at: number; refs: PublishedArticleRef[] } | null = null;
const liveArticleCache = new Map<string, { at: number; post: BlogPost | null }>();

/** True when this call should use (and fill) the memo. */
function memoised(options: LiveReadOptions): boolean {
  return options.token === undefined && options.request === undefined;
}

/** The token to read with, or `''` when the deployment has none. */
function readToken(options: LiveReadOptions): string {
  return (options.token ?? publishToken()).trim();
}

/**
 * Every published CMS article in the repository, as refs — or `[]` when there is
 * no token or the read fails.
 *
 * An empty list is the honest answer to "what can I not read?": the caller merges it
 * into the built list, so a GitHub outage degrades the hub to the articles the build
 * already has rather than taking the page down. The failure is logged, never
 * swallowed silently — a misconfigured token should be visible in the Worker's logs
 * rather than only in a page that quietly lost half its cards.
 */
export async function listLiveArticles(options: LiveReadOptions = {}): Promise<PublishedArticleRef[]> {
  const token = readToken(options);
  if (token.length === 0) return [];

  const useMemo = memoised(options);
  const now = Date.now();
  if (useMemo && liveListCache && now - liveListCache.at < LIVE_READ_TTL_MS) {
    return liveListCache.refs;
  }

  try {
    const records = await listArticleDetails({ token, request: options.request });
    const refs = records
      .filter((article) => article.status === 'published')
      .map(articleDetailRef);
    if (useMemo) liveListCache = { at: now, refs };
    return refs;
  } catch (error) {
    console.error(`[articles] the live CMS list could not be read: ${describe(error)}`);
    // A stale list is better than none, and better than a page that loses cards
    // because one request timed out.
    return liveListCache?.refs ?? [];
  }
}

/**
 * One published CMS article, read from the repository — or `null` when the
 * repository has no such file, when it is not published, or when the deployment
 * has no token to read with.
 *
 * `null` rather than a thrown error, deliberately: the caller is a page deciding
 * between rendering and `notFound()`, and a GitHub outage should mean "not found"
 * rather than a 500 on a URL that may well be valid.
 */
export async function resolveLiveArticle(
  slug: string,
  options: LiveReadOptions = {}
): Promise<ResolvedArticle | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const token = readToken(options);
  if (token.length === 0) return null;

  const useMemo = memoised(options);
  const now = Date.now();
  const cached = useMemo ? liveArticleCache.get(slug) : undefined;
  if (cached && now - cached.at < LIVE_READ_TTL_MS) {
    return cached.post ? { source: 'cms', slug, post: cached.post, origin: 'repository' } : null;
  }

  try {
    const article = await readArticleFromRepository(slug, { token, request: options.request });
    if (!article || article.status !== 'published') {
      if (useMemo) liveArticleCache.set(slug, { at: now, post: null });
      return null;
    }
    const post = postFromArticleDetail(article);
    if (useMemo) liveArticleCache.set(slug, { at: now, post });
    return { source: 'cms', slug, post, origin: 'repository' };
  } catch (error) {
    console.error(`[articles] the live article "${slug}" could not be read: ${describe(error)}`);
    return null;
  }
}

/**
 * The list the guides hub renders: everything the build has, plus the published
 * CMS articles it does not — which is what makes an article published since the
 * last deploy appear on the hub instead of only at its own URL.
 *
 * The build's entry wins a slug collision, so a card and the page it links to are
 * always the same version of the same article.
 */
export function mergeArticleRefs(
  built: PublishedArticleRef[],
  live: PublishedArticleRef[]
): PublishedArticleRef[] {
  const known = new Set(built.map((article) => article.slug));
  const merged = [...built, ...live.filter((article) => !known.has(article.slug))];
  return merged.sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0
  );
}

/**
 * The hub's articles: the built list, filled in from the repository.
 *
 * Exported as one call rather than left to each page so `/guides` and any future
 * index cannot disagree about whether the live read is part of the list.
 */
export async function listSiteArticles(): Promise<PublishedArticleRef[]> {
  const built = await listPublishedArticles();
  if (!hasPublishToken()) return built;
  return mergeArticleRefs(built, await listLiveArticles());
}

/** A short, safe description of a failure for a log line. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
