import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import keystaticConfig from '../keystatic.config';
import {
  POST_CATEGORIES,
  POST_EDITOR_OPTIONS,
  POST_IMAGE_DIRECTORY,
  POST_IMAGE_PUBLIC_PATH,
  postCategoryLabel,
} from '../keystatic.config';
import {
  BLOG_PATH,
  buildPostJsonLd,
  buildPostMetadata,
  derivedDescription,
  postCanonicalUrl,
  postCoverUrl,
  postSeoTitle,
} from '../lib/blog/seo';
import { MAX_DESCRIPTION_LENGTH } from '../lib/seo/metadata';
import { SITE_URL } from '../lib/site';
import type { BlogPost } from '../lib/blog/content';

/**
 * Guards for the article pipeline: the schema the dashboard writes against, the
 * SEO a search result and a social card actually read, and the one content rule
 * that has to hold for every published article.
 *
 * The dashboard that produces these files is covered separately, end to end, in
 * tests/adminDashboard.test.ts — including the round trip that proves this schema
 * can read back what that dashboard writes.
 *
 * These assert against the same modules the site imports, not against copies —
 * a test that re-declares the schema is a test that passes while the CMS ships
 * something else.
 */

const POSTS_DIR = join('content', 'posts');

function postFiles(): string[] {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR).filter((name) => name.endsWith('.md') || name.endsWith('.mdx'));
}

function readPostFile(name: string): string {
  return readFileSync(join(POSTS_DIR, name), 'utf8');
}

/** A post that satisfies the schema, so each test can vary one field. */
function fixture(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: 'sample-article',
    title: 'Sample Article About a Device That Does Not Work',
    content: '\nThe first paragraph of the body explains the fault in one sentence.\n\n## A subheading\n',
    seoTitle: null,
    seoDescription: null,
    coverImage: '/images/posts/sample.png',
    coverImageAlt: 'A laptop with its lid open, keyboard in view',
    publishedAt: '2026-10-06',
    author: 'DeviceTry team',
    category: 'input-gaming',
    status: 'published',
    tags: ['keyboard', 'troubleshooting'],
    canonicalUrl: null,
    ...overrides,
  };
}

// --------------------------------------------------------------------- schema

test('CMS schema - headings are limited to H2/H3/H4 so an article cannot add a second H1', () => {
  // The page's H1 is the article title. A second H1 inside the body is an
  // accessibility defect and it competes with the real headline in search.
  assert.deepEqual([...POST_EDITOR_OPTIONS.heading], [2, 3, 4]);
});

test('CMS schema - the editor enables bold, italic, lists, blockquotes, code and tables', () => {
  assert.equal(POST_EDITOR_OPTIONS.bold, true);
  assert.equal(POST_EDITOR_OPTIONS.italic, true);
  assert.equal(POST_EDITOR_OPTIONS.strikethrough, true);
  assert.equal(POST_EDITOR_OPTIONS.code, true);
  assert.equal(POST_EDITOR_OPTIONS.blockquote, true);
  assert.equal(POST_EDITOR_OPTIONS.orderedList, true);
  assert.equal(POST_EDITOR_OPTIONS.unorderedList, true);
  assert.equal(POST_EDITOR_OPTIONS.table, true);
  assert.equal(POST_EDITOR_OPTIONS.codeBlock, true);
  assert.equal(POST_EDITOR_OPTIONS.link, true);
});

test('CMS schema - every inline image prompts for alt text and a caption', () => {
  // Both fields are real `fields.text` builders: a custom schema is what makes
  // the alt slot required rather than an empty string Keystatic accepts.
  const schema = POST_EDITOR_OPTIONS.image.schema;
  assert.equal(typeof schema.alt, 'object', 'alt must be a field, not a bare string slot');
  assert.equal(typeof schema.title, 'object', 'caption must be a field');
  assert.equal(
    (schema.alt as { label?: string }).label,
    'Alt text',
    'the alt prompt is what the author actually sees',
  );
});

test('CMS schema - uploaded images are committed into the repository, under the path they are served from', () => {
  assert.equal(POST_IMAGE_DIRECTORY, 'public/images/posts');
  assert.equal(POST_IMAGE_PUBLIC_PATH, '/images/posts/');
  // The public path must be the served form of the same directory: uploads that
  // commit to one place and are requested from another render as broken images.
  assert.equal(
    POST_IMAGE_DIRECTORY.replace(/^public/, '') + '/',
    POST_IMAGE_PUBLIC_PATH,
    'the committed directory and the served URL must describe the same place',
  );
  assert.ok(existsSync(POST_IMAGE_DIRECTORY), 'the upload directory must exist in the repository');
});

test('CMS schema - the required cover alt field is declared next to the cover image', () => {
  // `fields.image` stores the file; the alt text is a sibling field, and it is
  // the only way a CMS can require a description of a picture.
  const source = readFileSync('keystatic.config.ts', 'utf8');
  assert.match(source, /coverImage:\s*fields\.image\(/, 'the cover image is an image field');
  assert.match(source, /coverImageAlt:\s*fields\.text\(/, 'alt text is its own field');
  assert.match(
    source,
    /coverImageAlt:\s*fields\.text\(\{[\s\S]*?validation:\s*\{\s*isRequired:\s*true\s*\}/,
    'cover alt text must be required',
  );
});

test('CMS schema - categories match the site taxonomy and every value has a label', () => {
  const values = POST_CATEGORIES.map((c) => c.value);
  assert.ok(values.includes('input-gaming') && values.includes('audio') && values.includes('video'));
  assert.equal(new Set(values).size, values.length, 'category values must be unique');
  for (const category of POST_CATEGORIES) {
    assert.equal(postCategoryLabel(category.value), category.label);
  }
  assert.equal(postCategoryLabel('not-a-category'), 'not-a-category', 'unknown values fall back to themselves');
});

// ------------------------------------------------------------------- content

test('content guard - no published article ships an image without alt text', () => {
  const files = postFiles();
  assert.ok(files.length > 0, 'the CMS must have at least one article to render');

  for (const file of files) {
    const body = readPostFile(file);
    // Markdown images: ![alt](src "title"). The alt group may not be empty —
    // `![](x.png)` is the exact shape that reaches a screen reader as nothing.
    const images = [...body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)];
    for (const [, alt, src] of images) {
      assert.ok(
        alt.trim().length > 0,
        `${file}: the image at ${src} has no alt text`,
      );
    }
  }
});

test('content guard - every article declares a cover image, its alt text, a date and an author', () => {
  for (const file of postFiles()) {
    const frontMatter = readPostFile(file).split(/^---\s*$/m)[1] ?? '';
    assert.ok(frontMatter.length > 0, `${file}: front matter is missing`);
    assert.match(frontMatter, /^coverImage:\s*\S/m, `${file}: cover image is required`);
    assert.match(frontMatter, /^coverImageAlt:\s*\S/m, `${file}: cover alt text is required`);
    assert.match(frontMatter, /^publishedAt:\s*\d{4}-\d{2}-\d{2}/m, `${file}: publish date is required`);
    assert.match(frontMatter, /^author:\s*\S/m, `${file}: author is required`);
  }
});

// ----------------------------------------------------------------------- SEO

test('article SEO - the canonical is the site route, unless the author overrode it', () => {
  assert.equal(postCanonicalUrl(fixture()), `${SITE_URL}${BLOG_PATH}/sample-article`);
  assert.equal(
    postCanonicalUrl(fixture({ canonicalUrl: 'https://elsewhere.example/republished' })),
    'https://elsewhere.example/republished',
    'a republished article must point its canonical at the original',
  );
  // An empty string is what a cleared optional field serialises to; it must not
  // win over the real route.
  assert.equal(postCanonicalUrl(fixture({ canonicalUrl: '   ' })), `${SITE_URL}${BLOG_PATH}/sample-article`);
});

test('article SEO - the cover image resolves to an absolute URL either way', () => {
  assert.equal(postCoverUrl(fixture()), `${SITE_URL}/images/posts/sample.png`);
  assert.equal(
    postCoverUrl(fixture({ coverImage: 'https://cdn.example/cover.png' })),
    'https://cdn.example/cover.png',
    'an already-absolute cover must not be prefixed twice',
  );
});

test('article SEO - metadata carries canonical, Open Graph and Twitter from the post', () => {
  const post = fixture({
    seoTitle: 'Keyboard Faults: Hardware or Software?',
    seoDescription: 'A key that never registers and a key that fails in one app are different faults.',
  });
  const metadata = buildPostMetadata(post);

  assert.equal(metadata.alternates?.canonical, `${SITE_URL}${BLOG_PATH}/sample-article`);
  assert.equal(metadata.title, 'Keyboard Faults: Hardware or Software?');

  const og = metadata.openGraph as Record<string, unknown>;
  assert.equal(og.type, 'article');
  assert.equal(og.title, 'Keyboard Faults: Hardware or Software?');
  assert.equal(og.url, `${SITE_URL}${BLOG_PATH}/sample-article`);
  assert.deepEqual(og.images, [
    { url: `${SITE_URL}${post.coverImage}`, alt: post.coverImageAlt },
  ]);
  assert.equal(og.publishedTime, '2026-10-06T00:00:00.000Z');

  const twitter = metadata.twitter as Record<string, unknown>;
  assert.equal(twitter.card, 'summary_large_image');
  assert.deepEqual(twitter.images, [`${SITE_URL}${post.coverImage}`]);
});

test('article SEO - an absent SEO title compacts the headline instead of truncating it mid-word', () => {
  const longHeadline = 'Keyboard Keys Not Registering? Tell a Hardware Fault from a Software One';
  const title = postSeoTitle(fixture({ title: longHeadline }));
  assert.ok(title.length <= 60, `title must fit a search result, got ${title.length} characters`);
  assert.ok(longHeadline.startsWith(title.replace(/ \| DeviceTry$/, '').replace(/…$/, '').slice(0, 20)));
});

test('article SEO - the description is the author’s, else derived from the body prose', () => {
  assert.equal(
    postSeoTitle(fixture({ seoTitle: 'Explicit title' })),
    'Explicit title',
    'an author-set title is used verbatim',
  );

  const explicit = fixture({ seoDescription: 'Exactly these words.' });
  assert.equal(buildPostMetadata(explicit).description, 'Exactly these words.');

  const derived = buildPostMetadata(fixture());
  assert.ok((derived.description ?? '').startsWith('The first paragraph of the body'));
  assert.ok(!(derived.description ?? '').includes('##'), 'markdown syntax must not leak into a snippet');
});

test('article SEO - a derived description is clamped at a word boundary', () => {
  const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
  const description = derivedDescription(words);
  assert.ok(description.length <= MAX_DESCRIPTION_LENGTH, 'must fit the snippet window');
  assert.ok(description.endsWith('…'), 'a clamp says so');
  assert.ok(!description.includes('word119'), 'the tail is cut, not spilled');
});

test('article SEO - the JSON-LD graph is an Article with breadcrumbs and a real publisher', () => {
  const post = fixture({
    seoTitle: 'Keyboard Faults: Hardware or Software?',
    tags: ['keyboard', 'troubleshooting'],
  });
  const graph = buildPostJsonLd(post)['@graph'] as Array<Record<string, unknown>>;

  const article = graph.find((node) => node['@type'] === 'Article');
  assert.ok(article, 'an Article node is required');
  assert.equal(article.headline, post.title, 'the headline is the on-page H1');
  assert.deepEqual(article.image, [`${SITE_URL}${post.coverImage}`]);
  assert.equal(article.datePublished, '2026-10-06T00:00:00.000Z');
  assert.equal(article.articleSection, post.category);
  assert.equal(article.keywords, 'keyboard, troubleshooting');
  assert.equal((article.author as Record<string, unknown>).name, post.author);
  assert.equal(
    (article.mainEntityOfPage as string) ?? article.mainEntityOfPage,
    postCanonicalUrl(post),
    'the graph follows the canonical, including an override',
  );
  const publisher = article.publisher as Record<string, unknown>;
  assert.equal(publisher.name, 'DeviceTry');
  assert.ok((publisher.logo as Record<string, unknown>).url, 'a publisher logo is expected');

  const breadcrumbs = graph.find((node) => node['@type'] === 'BreadcrumbList') as Record<string, unknown>;
  const items = breadcrumbs.itemListElement as Array<Record<string, unknown>>;
  assert.deepEqual(
    items.map((item) => item.position),
    [1, 2, 3],
  );
  assert.equal(items[1].item, `${SITE_URL}${BLOG_PATH}`);
});

// -------------------------------------------------------------------- routes

test('article routes - an unknown slug 404s instead of compiling MDX on demand', () => {
  // Publishing is a commit; without this the Worker would try to render a slug
  // that no build has seen, which is where dynamic code evaluation is banned.
  const source = readFileSync(join('app', 'blog', '[slug]', 'page.tsx'), 'utf8');
  assert.match(source, /export const dynamicParams = false/);
});

test('article routes - the CMS is excluded from crawlers and the blog is in the sitemap', () => {
  assert.match(readFileSync('app/robots.ts', 'utf8'), /'\/admin'/);
  const sitemap = readFileSync('app/sitemap.ts', 'utf8');
  assert.match(sitemap, /listPublishedPosts\(\)/, 'articles come from the collection, published ones only');
  assert.doesNotMatch(
    sitemap,
    /listPosts\(\)/,
    'the sitemap never reads the unfiltered list, or a draft would be indexed'
  );
  assert.match(readFileSync('lib/site.ts', 'utf8'), /path: '\/blog'/, 'the blog index is in STATIC_PAGES');
});

test('article routes - drafts and archived articles have no public route or index entry', () => {
  // The index and the article routes must read the published list — that is what
  // makes a draft's URL a 404 rather than a page that has to remember a robots
  // directive. `listPosts` stays for the management view, which shows every state.
  const index = readFileSync('app/blog/page.tsx', 'utf8');
  assert.match(index, /listPublishedPosts\(\)/);
  assert.doesNotMatch(index, /listPosts\(\)/);

  const article = readFileSync(join('app', 'blog', '[slug]', 'page.tsx'), 'utf8');
  assert.match(article, /listPublishedPosts\(\)/, 'static params are published articles only');
  assert.match(article, /post\.status !== 'published'/, 'a non-published state is a 404, not a hidden page');
});
