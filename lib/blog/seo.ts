import type { Metadata } from 'next';
import { compactTitle, MAX_DESCRIPTION_LENGTH } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site';
import type { BlogPost } from './content';

/**
 * Everything a CMS article needs to be findable, in one testable place.
 *
 * These are pure functions of a post rather than code inside the page, for the
 * same reason the guides keep their metadata derivation separate: a page can only
 * be checked by rendering it, while a function can be asserted directly. The
 * tests in tests/blogCms.test.ts check the canonical rule, the fallback chains,
 * and the JSON-LD graph without a browser.
 */

/** Where articles live. One constant, so a route rename is one edit. */
export const BLOG_PATH = '/blog';

/**
 * The canonical URL for an article.
 *
 * The author's override wins when present, because the whole point of the field
 * is an article first published on another domain — pointing the canonical back
 * at DeviceTry in that case would ask search engines to index a duplicate.
 */
export function postCanonicalUrl(post: BlogPost): string {
  const override = post.canonicalUrl?.trim();
  return override ? override : `${SITE_URL}${BLOG_PATH}/${post.slug}`;
}

/**
 * The absolute URL of an article's cover image.
 *
 * The CMS stores the site-relative public path (`/uploads/x.png`); Open
 * Graph and Twitter both require an absolute URL, so it is resolved against the
 * site root here. A value that is already absolute is left alone, so a cover
 * hosted elsewhere cannot be mangled into `https://sitehttps://…`.
 */
export function postCoverUrl(post: BlogPost): string {
  if (/^https?:\/\//i.test(post.coverImage)) return post.coverImage;
  return `${SITE_URL}${post.coverImage}`;
}

/**
 * The title a search result shows.
 *
 * An author-set SEO title is used verbatim — they chose those words for that
 * window. Otherwise the headline is compacted to fit, keeping the full headline
 * as the page's H1 (see lib/seo/metadata.ts for the compaction rules).
 */
export function postSeoTitle(post: BlogPost): string {
  const explicit = post.seoTitle?.trim();
  return explicit ? explicit : compactTitle(post.title);
}

/**
 * Strip Markdown down to readable prose.
 *
 * Only used to derive a fallback description from the body, so it deliberately
 * does the few things that would otherwise leak syntax into a SERP snippet:
 * fenced code, image syntax, link URLs, heading marks, and list bullets. It is
 * not a renderer and does not try to be one.
 */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The first real paragraph of the body, clamped to what a result shows.
 *
 * A clamp, not a truncation: cutting mid-word makes a snippet look broken, so the
 * cut happens at the last word boundary that fits and says so with an ellipsis.
 */
export function derivedDescription(markdown: string): string {
  const paragraphs = markdown.split(/\n\s*\n/);
  let first = '';
  for (const block of paragraphs) {
    const text = toPlainText(block);
    // Skip front matter echoes, horizontal rules and stray tags: a description
    // built from punctuation is worse than none.
    if (text.length >= 40) {
      first = text;
      break;
    }
  }
  if (!first) return '';
  if (first.length <= MAX_DESCRIPTION_LENGTH) return first;
  const cut = first.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The meta description: the author's own, else derived from the body.
 *
 * There is intentionally no site-wide default. A generic sentence on every
 * article describes none of them.
 */
export function postDescription(post: BlogPost): string {
  const explicit = post.seoDescription?.trim();
  return explicit ? explicit : derivedDescription(post.content);
}

/** The article's publication instant, as ISO 8601 for structured data. */
export function postPublishedIso(post: BlogPost): string {
  return post.publishedAt ? `${post.publishedAt}T00:00:00.000Z` : '';
}

/**
 * Next's metadata for an article: canonical, Open Graph, and Twitter.
 *
 * The cover image carries no width/height claim. The CMS accepts any upload, and
 * asserting 1200x630 for an image whose real size we have not measured would be
 * a fabricated fact in the page's own markup; leaving the dimensions out lets
 * each platform measure the file itself.
 */
export function buildPostMetadata(post: BlogPost): Metadata {
  const title = postSeoTitle(post);
  const description = postDescription(post);
  const url = `${SITE_URL}${BLOG_PATH}/${post.slug}`;
  const cover = postCoverUrl(post);

  return {
    title,
    description,
    alternates: { canonical: postCanonicalUrl(post) },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      siteName: 'DeviceTry',
      publishedTime: postPublishedIso(post) || undefined,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: cover, alt: post.coverImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [cover],
    },
  };
}

/**
 * The article's structured data: a single graph, built from the same fields the
 * page renders, so nothing in it can describe a headline or an image the reader
 * cannot see on the page.
 *
 * `Article` (not `BlogPosting`) because that is the type the site's article
 * template is specified around; `mainEntityOfPage`, `articleSection` and
 * `keywords` are the fields that make it useful to a search engine rather than
 * merely valid.
 */
export function buildPostJsonLd(post: BlogPost): Record<string, unknown> {
  const url = `${SITE_URL}${BLOG_PATH}/${post.slug}`;
  const canonical = postCanonicalUrl(post);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: post.title,
        description: postDescription(post),
        image: [postCoverUrl(post)],
        datePublished: postPublishedIso(post),
        inLanguage: 'en',
        articleSection: post.category,
        keywords: post.tags.join(', '),
        author: { '@type': 'Person', name: post.author },
        publisher: {
          '@type': 'Organization',
          name: 'DeviceTry',
          url: `${SITE_URL}/`,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/devicetry-mark.png` },
        },
        mainEntityOfPage: canonical,
        isAccessibleForFree: true,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}${BLOG_PATH}` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
}
