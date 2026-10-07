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
 * COLLISIONS RESOLVE TO THE GUIDE, deterministically. A Typed guide is
 * hand-authored: its figures are registered assets, its FAQ set is written, and
 * its prose is link-checked by tests. A CMS article is a Markdown file that can be
 * renamed in a dashboard. If a slug somehow names both, the richer, test-covered
 * article wins rather than whatever the filesystem listed first. `collidingSlugs`
 * reports the overlap so the dashboard can surface it instead of the site
 * silently serving one of them.
 */

import { getGuideBySlug, getPublishedGuides } from '@/lib/guides/registry';
import { getPost, listPublishedPosts } from '@/lib/blog/content';
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

/** A resolved article, carrying the source object so the page can render it. */
export type ResolvedArticle =
  | { source: 'guide'; slug: string; guide: GuideArticle }
  | { source: 'cms'; slug: string; post: BlogPost };

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

/** The slugs that exist in both collections. Empty in a healthy repository. */
export function collidingSlugs(
  guideSlugs: string[] = getPublishedGuides().map((guide) => guide.slug),
  postSlugs: string[] = []
): string[] {
  const guides = new Set(guideSlugs);
  return postSlugs.filter((slug) => guides.has(slug));
}

/**
 * Every published article, newest first — guides and CMS articles in one list.
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

/** One published article by its slug, or `null` when no URL should exist for it. */
export async function resolvePublishedArticle(slug: string): Promise<ResolvedArticle | null> {
  const guide = getGuideBySlug(slug);
  if (guide) return { source: 'guide', slug: guide.slug, guide };

  const post = await getPost(slug);
  if (!post || post.status !== 'published') return null;
  return { source: 'cms', slug: post.slug, post };
}
