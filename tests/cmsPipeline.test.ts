import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listLiveArticles, mergeArticleRefs, resolveLiveArticle } from '../lib/articles/registry';
import type { PublishedArticleRef } from '../lib/articles/registry';
import { renderPreview } from '../lib/admin/preview';

/**
 * The publishing pipeline after a publish, end to end.
 *
 * `tests/blogCms.test.ts` guards the CMS as content (schema, SEO, the published
 * rules) and `tests/adminDashboard.test.ts` guards the dashboard that writes it.
 * This file guards the join between them: a file the dashboard committed into
 * `public/guides/` must become a page at `/guides/<slug>` and a card on `/guides`
 * WITHOUT a build, and the body of that page must render the same way as one that
 * was compiled at build time.
 *
 * The live reads are exercised against a fake contents API rather than the real
 * GitHub, which also makes the failure cases testable: a draft in the repository,
 * and a slug that would climb out of the collection directory.
 *
 * The token is always passed explicitly here. A live read with no explicit token
 * uses the deployment's own (`hasPublishToken()`), and a test must never depend on
 * — or accidentally use — the token of the machine it runs on.
 */

const GUIDE_DIRECTORY = 'public/guides';

/** A published article's file, in the exact shape the publish endpoint commits. */
const PUBLISHED_FILE = `---
title: Cleaning a laptop fan without taking it apart
seoTitle: Cleaning a laptop fan
seoDescription: What the vents can and cannot reach.
coverImage: /uploads/laptop-fan.png
coverImageAlt: 'A laptop held open with its exhaust vent in view'
publishedAt: 2026-10-08
author: DeviceTry team
category: audio
status: published
tags:
  - cooling
canonicalUrl: null
---

The fan sits behind the vent, and the vent is the part you can reach.

## Start with the exhaust
`;

/** The same article saved but not published. */
const DRAFT_FILE = PUBLISHED_FILE.replace('status: published', 'status: draft');

/**
 * The contents API the live read uses, over an in-memory file map.
 *
 * Two shapes are served: the directory listing for `public/guides`, and one file
 * per article, base64-encoded the way GitHub returns it. Anything else is a 404,
 * which is what the reader treats as "no such article".
 */
function fakeGithub(files: Record<string, string>) {
  const calls: string[] = [];
  const request = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const path = decodeURIComponent(url.split('/contents/')[1]?.split('?')[0] ?? '');

    if (path === GUIDE_DIRECTORY) {
      const entries = Object.keys(files).map((name) => ({ path: name, type: 'file' }));
      return new Response(JSON.stringify(entries), { status: 200 });
    }

    const file = files[path];
    if (file === undefined) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(
      JSON.stringify({ content: Buffer.from(file, 'utf8').toString('base64') }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;

  return { request, calls };
}

/** A published article as the hub merges it. Only the fields the merge reads matter. */
function ref(slug: string, source: 'cms' | 'guide', publishedAt: string): PublishedArticleRef {
  return {
    slug,
    source,
    title: slug,
    category: 'audio',
    publishedAt,
    description: '',
    coverImage: '',
    coverImageAlt: '',
    type: 'how-to',
    tags: [],
  };
}

// ------------------------------------------------------------------- routing

test('pipeline - the route serves, and the hub lists, an article the build has never seen', () => {
  const route = readFileSync(join('app', 'guides', '[slug]', 'page.tsx'), 'utf8');
  assert.match(
    route,
    /generateStaticParams[\s\S]*?listPublishedArticles\(\)/,
    'every article the build knows is prerendered from the one published list',
  );
  assert.match(route, /export const dynamicParams = true/, 'a newer slug is rendered on demand, not 404ed');
  assert.match(route, /await resolveLiveArticle\(slug\)/, 'the on-demand path reads the repository');
  assert.match(
    route,
    /origin === 'repository'[\s\S]*?<PostBodyHtml/,
    'a body read at request time cannot be compiled, so it is rendered by the eval-free renderer',
  );

  const hub = readFileSync(join('app', 'guides', 'page.tsx'), 'utf8');
  assert.match(hub, /listSiteArticles\(\)/, 'the hub merges the repository list into the built one');
  assert.match(
    hub,
    /export const dynamic = 'force-dynamic'/,
    'the merge is per request; a prerendered hub could not see a publish',
  );
});

// ---------------------------------------------------------------- live reads

test('pipeline - a published file resolves with its front matter, tags and body', async () => {
  const { request } = fakeGithub({ [`${GUIDE_DIRECTORY}/laptop-fan-cleaning.md`]: PUBLISHED_FILE });
  const article = await resolveLiveArticle('laptop-fan-cleaning', { token: 'test-token', request });

  assert.equal(article?.source, 'cms');
  if (article?.source !== 'cms') return assert.fail('a published file must resolve as a CMS article');

  assert.equal(article.origin, 'repository', 'it was read at request time, not compiled');
  assert.equal(article.post.slug, 'laptop-fan-cleaning');
  assert.equal(article.post.title, 'Cleaning a laptop fan without taking it apart');
  assert.equal(article.post.publishedAt, '2026-10-08');
  assert.deepEqual(article.post.tags, ['cooling']);
  assert.match(article.post.content, /## Start with the exhaust/);
  assert.doesNotMatch(article.post.content, /^---/, 'the front matter is not part of the body');
});

test('pipeline - a draft resolves to no page and stays out of the hub list', async () => {
  const { request } = fakeGithub({
    [`${GUIDE_DIRECTORY}/published-one.md`]: PUBLISHED_FILE,
    [`${GUIDE_DIRECTORY}/draft-one.md`]: DRAFT_FILE,
  });

  assert.equal(
    await resolveLiveArticle('draft-one', { token: 'test-token', request }),
    null,
    'an unpublished article has no URL, exactly as it has no prerendered route',
  );

  const refs = await listLiveArticles({ token: 'test-token', request });
  assert.deepEqual(
    refs.map((article) => article.slug),
    ['published-one'],
    'the hub lists published articles only',
  );
  assert.equal(refs[0].source, 'cms', 'every repository article is a CMS article');
});

test('pipeline - a slug that could climb out of the collection is refused without a request', async () => {
  const { request, calls } = fakeGithub({});
  assert.equal(await resolveLiveArticle('../../etc/passwd', { token: 'test-token', request }), null);
  assert.equal(calls.length, 0, 'a malformed slug must never reach GitHub');
});

test('pipeline - the deployment without a token falls back to the build, never to a failure', async () => {
  // An empty token is the answer to "this deployment has no credential": both reads
  // say so by returning nothing, which is what keeps the hub at the built list.
  assert.deepEqual(await listLiveArticles({ token: '' }), []);
  assert.equal(await resolveLiveArticle('laptop-fan-cleaning', { token: '' }), null);
});

// -------------------------------------------------------------------- merge

test('pipeline - the build wins a slug collision and the merged list stays newest-first', () => {
  const merged = mergeArticleRefs(
    [ref('built-guide', 'guide', '2026-10-01'), ref('shared-slug', 'guide', '2026-09-01')],
    [ref('shared-slug', 'cms', '2026-10-08'), ref('fresh-article', 'cms', '2026-10-05')]
  );

  assert.deepEqual(
    merged.map((article) => [article.slug, article.source, article.publishedAt]),
    [
      ['fresh-article', 'cms', '2026-10-05'],
      ['built-guide', 'guide', '2026-10-01'],
      // The build's version of the collided slug, so a card and its page agree.
      ['shared-slug', 'guide', '2026-09-01'],
    ]
  );
});

// ------------------------------------------------------- the two body renderers

/**
 * A body that exercises every construct the editor can produce — the same set
 * `lib/admin/preview.ts` renders and `components/blog/PostBody.tsx` styles.
 */
const SAMPLE_BODY = `
A paragraph with **bold**, _italic_, \`code\` and a [link](/guides).

![A described image](/uploads/sample.png 'The caption under it')

## A heading

### A smaller heading

- first item
- second item

1. first step
2. second step

> A quoted line

| Column | Value |
| --- | --- |
| One | Two |

\`\`\`
plain code
\`\`\`

---

Last paragraph.
`;

test('pipeline - every class the request-time renderer emits is one the compiled renderer styles', () => {
  // The same article renders through PostBody when it was compiled at build time and
  // through renderPreview (via PostBodyHtml) when it was read at request time. If the
  // runtime renderer emitted a class the build-time one does not carry, the article
  // would change appearance at the next deploy — which is the exact drift this guards.
  const html = renderPreview(SAMPLE_BODY);
  const classNames = [...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/));

  assert.ok(html.includes('<h2'), 'headings render');
  assert.ok(html.includes('<figure'), 'a lone image renders as a figure with a caption');
  assert.ok(html.includes('<blockquote'), 'a quote renders');
  assert.ok(html.includes('<table'), 'a table renders');
  assert.ok(html.includes('<pre'), 'a fenced block renders');
  assert.ok(classNames.length >= 20, `the sample must exercise the renderer, got ${classNames.length} classes`);

  const compiled = readFileSync(join('components', 'blog', 'PostBody.tsx'), 'utf8');
  for (const className of new Set(classNames)) {
    assert.ok(
      compiled.includes(className),
      `PostBody has no "${className}", so a runtime-rendered article would not look like a built one`
    );
  }
});

test('pipeline - the request-time renderer escapes instead of emitting article text as markup', () => {
  // Bodies are authored by the site owner, but this renderer runs in the Worker on
  // every request for a newer article, and the compiler is not there to sanitize:
  // it must not be possible for a body to introduce a tag this file did not write.
  const html = renderPreview('A <script>alert(1)</script> line and an <img src=x onerror=alert(1)> tag.');
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.match(html, /&lt;script&gt;/);
});
