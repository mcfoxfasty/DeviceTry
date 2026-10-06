import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '@/keystatic.config';

/**
 * The read side of the CMS.
 *
 * Keystatic stores articles as files in this repository, so "fetching content" is
 * reading the repository at build time. That is why the whole blog is
 * prerendered, and why this module is the only place that talks to the CMS
 * reader: pages get typed posts, tests get the same posts, and nothing else has
 * to know how the CMS lays its files out.
 *
 * `process.cwd()` is the repository root during a build, which is where the
 * reader resolves `content/posts/*` from.
 *
 * TWO THINGS ABOUT THIS READER THAT ARE EASY TO GET WRONG (both verified against
 * a real article, 2026-10-06):
 *
 * 1. `all()` returns front matter only — the body is NOT in it. That is a
 *    feature, not an omission: the index page and the sitemap want titles and
 *    dates, and pulling every article's full text to render a list would read
 *    the whole collection for nothing.
 * 2. In `read()`, the body is a lazy reader — an async function you call to get
 *    the Markdown — not a string. Treating it as a string is how a page ends up
 *    rendering "[object Function]" or nothing at all. `readPostContent` handles
 *    both shapes so a future Keystatic release that returns the string directly
 *    cannot silently empty the article.
 */
export const blogReader = createReader(process.cwd(), keystaticConfig);

/**
 * An article's metadata: everything except its body. This is what a listing,
 * a sitemap entry, or a social card needs.
 */
export interface BlogPostMeta {
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImage: string;
  coverImageAlt: string;
  publishedAt: string;
  author: string;
  category: string;
  tags: string[];
  canonicalUrl: string | null;
}

/** An article with its body, ready to render. */
export interface BlogPost extends BlogPostMeta {
  content: string;
}

/**
 * Every article, newest first.
 *
 * Sorting here rather than at each call site means the index page, the sitemap,
 * and any future feed agree on the order; content that lists itself differently
 * in three places is content whose dates nobody trusts.
 */
export async function listPosts(): Promise<BlogPostMeta[]> {
  const entries = await blogReader.collections.posts.all();
  return entries
    .map(({ slug, entry }) => ({
      slug,
      title: entry.title,
      seoTitle: entry.seoTitle ?? null,
      seoDescription: entry.seoDescription ?? null,
      coverImage: entry.coverImage ?? '',
      coverImageAlt: entry.coverImageAlt,
      publishedAt: entry.publishedAt ?? '',
      author: entry.author,
      category: entry.category,
      tags: [...entry.tags],
      canonicalUrl: entry.canonicalUrl ?? null,
    }))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
}

/** Resolve the body whether the reader hands back a string or a lazy reader. */
async function readPostContent(value: unknown): Promise<string> {
  if (typeof value === 'function') {
    const resolved = await (value as () => Promise<unknown>)();
    return typeof resolved === 'string' ? resolved : '';
  }
  return typeof value === 'string' ? value : '';
}

/** One article by its slug, with its body, or `null` when no such file exists. */
export async function getPost(slug: string): Promise<BlogPost | null> {
  const entry = await blogReader.collections.posts.read(slug);
  if (!entry) return null;

  return {
    slug,
    title: entry.title,
    content: await readPostContent((entry as unknown as Record<string, unknown>).content),
    seoTitle: entry.seoTitle ?? null,
    seoDescription: entry.seoDescription ?? null,
    coverImage: entry.coverImage ?? '',
    coverImageAlt: entry.coverImageAlt,
    publishedAt: entry.publishedAt ?? '',
    author: entry.author,
    category: entry.category,
    tags: [...entry.tags],
    canonicalUrl: entry.canonicalUrl ?? null,
  };
}
