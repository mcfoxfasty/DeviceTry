import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
import { isUnreachableHost, resolvePublicOrigin } from '../lib/keystatic/origin';
import {
  captureTokenExchange,
  describeCallbackError,
  explainFailure,
  isCallbackPath,
  isTokenEndpoint,
  redactSecrets,
  resumeAfterClose,
  summarizeTokenExchange,
  withCloseFallback,
  withFailureDetail,
} from '../lib/keystatic/oauthDiagnostics';
import {
  KEYSTATIC_CREDENTIALS,
  pickCredentials,
  resolveKeystaticCredentials,
  workerBindings,
} from '../lib/keystatic/serverEnv';
import type { BlogPost } from '../lib/blog/content';

/**
 * Guards for the CMS: the schema promises the admin dashboard makes, the SEO a
 * search result and a social card actually read, and the one content rule that
 * has to hold for every published article.
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
  assert.match(readFileSync('app/robots.ts', 'utf8'), /'\/keystatic'/);
  assert.match(readFileSync('app/sitemap.ts', 'utf8'), /listPosts\(\)/, 'articles come from the collection');
  assert.match(readFileSync('lib/site.ts', 'utf8'), /path: '\/blog'/, 'the blog index is in STATIC_PAGES');
});

// ----------------------------------------------------------- CMS sign-in origin
// The OAuth redirect GitHub is asked for. Binding to 0.0.0.0 (how the preview and
// the container host run Next) made that redirect advertise the bind address, and
// GitHub answers with redirect_uri_mismatch — so the sign-in never completes.

/** The headers of a request, as `get` alone. */
function headers(values: Record<string, string>) {
  const lower = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

const BIND_REQUEST = 'http://0.0.0.0:3000/api/keystatic/github/login?from=/keystatic';

function origin(values: Record<string, string>, requestUrl = BIND_REQUEST, siteUrl = 'https://devicetry.example') {
  return resolvePublicOrigin(headers(values), requestUrl, siteUrl);
}

test('CMS sign-in - the origin comes from the proxy, not from the address Next bound to', () => {
  assert.equal(
    origin({ 'x-forwarded-host': 'devicetry.example', 'x-forwarded-proto': 'https' }),
    'https://devicetry.example',
    'the edge knows where the visitor actually is'
  );
});

test('CMS sign-in - a forwarded host list is read as its first value, not as a hostname with commas', () => {
  assert.equal(
    origin({ 'x-forwarded-host': 'devicetry.example, inner:8080', 'x-forwarded-proto': 'https' }),
    'https://devicetry.example'
  );
});

test('CMS sign-in - the plain Host header is used when the proxy forwards no host', () => {
  // With no x-forwarded-proto the protocol follows the request itself, which is
  // what a developer hitting the server directly over http sees.
  assert.equal(origin({ host: 'devicetry.example:3000' }), 'http://devicetry.example:3000');
});

test('CMS sign-in - localhost stays reachable, because that is where a developer works', () => {
  assert.equal(origin({ host: 'localhost:3000' }, 'http://0.0.0.0:3000/x'), 'http://localhost:3000');
  assert.equal(isUnreachableHost('localhost:3000'), false);
});

test('CMS sign-in - a bind address is never advertised, even when it is all the request offers', () => {
  for (const host of ['0.0.0.0:3000', '0.0.0.0', ':3000', '[::]:3000', '[::]']) {
    assert.equal(isUnreachableHost(host), true, `${host} is a bind address`);
    assert.equal(origin({ host }), 'https://devicetry.example', `${host} falls back to the site URL`);
  }
  assert.equal(origin({}), 'https://devicetry.example');
});

test('CMS sign-in - with no reachable origin anywhere the request is left untouched', () => {
  assert.equal(origin({}, BIND_REQUEST, 'http://0.0.0.0:3000'), null);
  assert.equal(origin({}, BIND_REQUEST, ''), null);
});

// ------------------------------------------------------------ admin mounting
// The failure this guards is silent by design: `@keystatic/core/ui` ships a
// server build whose component body is `return null`, because the dashboard is a
// browser application. Reachable only from a server component, the whole route
// server-renders nothing, the client chunk builds to an empty 163-byte shell,
// and /keystatic serves a healthy 200 containing nothing but a skip link. No
// console error, no failed request, no CSP violation — so nothing would ever
// report it.

test('CMS admin - the dashboard sits behind a client boundary, or it renders nothing at all', () => {
  const admin = readFileSync(join('components', 'keystatic', 'KeystaticAdmin.tsx'), 'utf8');
  assert.match(
    admin,
    /^['"]use client['"]/,
    "Keystatic's server build returns null; without 'use client' the admin can never mount",
  );
  assert.match(admin, /makePage\(keystaticConfig\)/, 'the admin still comes from makePage');
});

test('CMS admin - the page stays a server component so the dashboard keeps its noindex', () => {
  const page = readFileSync(join('app', 'keystatic', '[[...params]]', 'page.tsx'), 'utf8');
  assert.doesNotMatch(
    page,
    /^['"]use client['"]/m,
    "a 'use client' module cannot export metadata, so the page must stay server",
  );
  assert.match(page, /export const metadata/);
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  assert.match(page, /<KeystaticAdmin/, 'the page renders the client admin');
});

// --------------------------------------------------- CMS credentials (Workers)
// Keystatic defaults to reading its three secrets out of the ambient process
// environment, which is true locally and false on the Cloudflare Worker, where
// the bindings live on the request context. That mismatch was a 503 naming all
// three keys as missing while they were set in the Cloudflare dashboard.

test('CMS credentials - the ambient environment wins and Worker bindings fill the gaps', () => {
  const picked = pickCredentials(
    { KEYSTATIC_GITHUB_CLIENT_ID: 'from-process', KEYSTATIC_SECRET: 'process-secret' },
    { KEYSTATIC_GITHUB_CLIENT_ID: 'from-worker', KEYSTATIC_GITHUB_CLIENT_SECRET: 'worker-secret' },
  );
  assert.deepEqual(picked, {
    clientId: 'from-process',
    clientSecret: 'worker-secret',
    secret: 'process-secret',
  });
});

test('CMS credentials - a binding that is not a usable string counts as missing', () => {
  // A Worker binding may also be a KV namespace or a Durable Object, and a
  // blank secret is a misconfiguration. Either must read as absent so the route
  // answers its readable 503 instead of starting an OAuth flow half-configured.
  assert.deepEqual(pickCredentials({}, { KEYSTATIC_GITHUB_CLIENT_ID: { kv: true } as never }), {});
  assert.deepEqual(pickCredentials({}, { KEYSTATIC_SECRET: '   ' }), {});
  assert.deepEqual(pickCredentials(undefined, undefined), {});
});

test('CMS credentials - Worker bindings come from the Cloudflare context, or report absent', () => {
  const scope = globalThis as Record<symbol, unknown>;
  const contextKey = Symbol.for('__cloudflare-context__');
  const before = scope[contextKey];
  try {
    scope[contextKey] = {
      env: { KEYSTATIC_GITHUB_CLIENT_ID: 'worker-client', KEYSTATIC_SECRET: 'worker-secret' },
    };
    assert.equal(workerBindings()?.KEYSTATIC_GITHUB_CLIENT_ID, 'worker-client');
    assert.equal(workerBindings()?.KEYSTATIC_SECRET, 'worker-secret');

    // No context at all is the normal state under `next start`, not a failure:
    // the resolver falls back to the ambient environment and nothing escapes.
    delete scope[contextKey];
    assert.equal(workerBindings(), undefined);
  } finally {
    if (before === undefined) delete scope[contextKey];
    else scope[contextKey] = before;
  }
});

test('CMS credentials - the local preview resolves all three without a Worker', () => {
  const resolved = resolveKeystaticCredentials();
  assert.ok(resolved.clientId, `${KEYSTATIC_CREDENTIALS.clientId} is available to the preview`);
  assert.ok(resolved.clientSecret, `${KEYSTATIC_CREDENTIALS.clientSecret} is available to the preview`);
  assert.ok(resolved.secret, `${KEYSTATIC_CREDENTIALS.secret} is available to the preview`);
});

test('CMS credentials - the API route supplies them explicitly, not from ambient env', () => {
  const route = readFileSync(join('app', 'api', 'keystatic', '[...params]', 'route.ts'), 'utf8');
  const built =
    route.match(/makeRouteHandler\(\{\s*config:\s*keystaticConfig,\s*\.\.\.resolveKeystaticCredentials\(\),?\s*\}\)/g) ?? [];
  assert.equal(
    built.length,
    2,
    'every handler is built from the resolved credentials, not from whatever the process happens to hold',
  );

  const resolver = readFileSync(join('lib', 'keystatic', 'serverEnv.ts'), 'utf8');
  assert.match(resolver, /getCloudflareContext/, 'Worker bindings come from the OpenNext adapter');
  assert.match(resolver, /process\.env/, 'the local preview path is still the ambient environment');
});

test('CMS credentials - the handler is built per request, never held at module scope', () => {
  const route = readFileSync(join('app', 'api', 'keystatic', '[...params]', 'route.ts'), 'utf8');

  // The Cloudflare context is an AsyncLocalStorage store that exists only while
  // a request is in flight, so anything resolved at import time sees nothing —
  // and a module-scope cache would then pin an unconfigured handler for the
  // life of the isolate instead of recovering on the next request.
  assert.doesNotMatch(route, /\bcached\b/, 'no handler or credential state survives the request');

  // Once inside each request handler: GET and POST both resolve, then construct.
  assert.equal(
    (route.match(/resolveKeystaticCredentials\(\)/g) ?? []).length,
    2,
    'both GET and POST resolve credentials inside the request',
  );
  assert.equal((route.match(/makeRouteHandler\(/g) ?? []).length, 2, 'each handler builds its own');

  // Guard the regression that per-request construction invites: without the
  // catch, a missing configuration becomes an unhandled throw instead of the
  // readable 503 that names which variables are absent.
  assert.equal(
    (route.match(/notConfigured\(error\)/g) ?? []).length,
    2,
    'both handlers still answer the readable 503 when credentials are missing',
  );
});

// ------------------------------------------------------- CMS sign-in failures
// A refused sign-in used to be two words — "Authorization failed" — whatever the
// cause, because GitHub answers a rejected token exchange with HTTP 200 and an
// error BODY that Keystatic folds into that one sentence. On a phone the reader
// has no console, so the reason has to reach both the server log and the page.

const REDACT = '[redacted]';

test('CMS sign-in diagnostics - credentials cannot reach a log', () => {
  const json = redactSecrets('{"access_token":"ghu_secretvalue","error":"bad_verification_code"}');
  assert.ok(!json.includes('ghu_secretvalue'), 'the token is gone');
  assert.ok(json.includes(`"access_token":"${REDACT}"`), 'and said to be gone');
  assert.match(json, /bad_verification_code/, 'the reason itself survives redaction');

  const form = redactSecrets('access_token=ghu_leak&refresh_token=ghr_leak&error=incorrect_client_credentials');
  assert.ok(!form.includes('ghu_leak') && !form.includes('ghr_leak'));

  const code = redactSecrets('{"code":"abc123"}');
  assert.ok(!code.includes('abc123'), 'an authorization code is a credential too');
});

test('CMS sign-in diagnostics - GitHub declining before any exchange is reported in full', () => {
  const described = describeCallbackError(
    new URLSearchParams({
      error: 'redirect_uri_mismatch',
      error_description: 'The redirect_uri is not associated with this application.',
      error_uri: 'https://docs.github.com/apps',
    }),
  );
  assert.match(described ?? '', /redirect_uri_mismatch/);
  assert.match(described ?? '', /not associated with this application/);
  assert.match(described ?? '', /authorization code: absent/, 'which separates a refusal from a failed exchange');

  assert.equal(describeCallbackError(new URLSearchParams()), null, 'a healthy callback adds nothing');
  assert.match(
    describeCallbackError(new URLSearchParams({ error: 'access_denied' })) ?? '',
    /authorization code: absent/,
  );
});

test('CMS sign-in diagnostics - the token exchange reply is summarised, redacted and bounded', () => {
  const summary = summarizeTokenExchange(
    200,
    'OK',
    JSON.stringify({ error: 'bad_verification_code', access_token: 'ghu_leak' }),
  );
  assert.match(summary, /^200 OK — /, 'the status is part of the answer');
  assert.match(summary, /bad_verification_code/, 'the reason GitHub gave is the point');
  assert.ok(!summary.includes('ghu_leak'), 'and never the token that came with it');

  assert.ok(
    summarizeTokenExchange(200, '', 'x'.repeat(5000)).length < 800,
    'an unexpected body cannot flood the log',
  );
  assert.match(summarizeTokenExchange(502, 'Bad Gateway', ''), /502 Bad Gateway — \(empty body\)/);

  assert.equal(isTokenEndpoint('https://github.com/login/oauth/access_token?client_id=x'), true);
  assert.equal(isTokenEndpoint('https://api.github.com/user'), false);
  assert.equal(isCallbackPath('/api/keystatic/github/oauth/callback'), true);
  assert.equal(isCallbackPath('/api/keystatic/github/login'), false, 'only the callback is instrumented');
});

test('CMS sign-in diagnostics - the capture records GitHub\u2019s reply and always restores fetch', async () => {
  const realFetch = globalThis.fetch;
  const fake = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (isTokenEndpoint(url)) {
      return new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 200 });
    }
    return new Response('elsewhere', { status: 200 });
  }) as typeof fetch;

  try {
    globalThis.fetch = fake;
    const { result, exchanges } = await captureTokenExchange(async () => {
      await fetch('https://github.com/login/oauth/access_token?client_id=x');
      await fetch('https://api.github.com/user');
      return 'served';
    });
    assert.equal(result, 'served', 'the handler still runs normally');
    assert.equal(exchanges.length, 1, 'only the endpoint that decides the sign-in is recorded');
    assert.match(exchanges[0], /bad_verification_code/);
    assert.equal(globalThis.fetch, fake, 'fetch is restored on the way out');

    globalThis.fetch = fake;
    await assert.rejects(
      captureTokenExchange(async () => {
        throw new Error('handler blew up');
      }),
    );
    assert.equal(globalThis.fetch, fake, 'and restored even when the handler throws');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('CMS sign-in diagnostics - a failure explains itself in the response the device shows', async () => {
  const exchanges = [summarizeTokenExchange(200, 'OK', '{"error":"bad_verification_code"}')];
  const detail = explainFailure(401, exchanges, null);
  assert.match(detail ?? '', /HTTP 401/);
  assert.match(detail ?? '', /bad_verification_code/);
  assert.match(detail ?? '', /already used/, 'the likely cause is named, not just quoted');

  assert.equal(explainFailure(307, [], null), null, 'a redirect has nothing to explain');
  assert.equal(explainFailure(200, [], null), null, 'a successful callback stays silent');
  assert.match(
    explainFailure(400, [], 'redirect_uri_mismatch') ?? '',
    /before any token exchange: redirect_uri_mismatch/,
    'a refusal with no exchange still explains itself',
  );

  const failed = new Response('Authorization failed', {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
  const explained = await withFailureDetail(failed, detail);
  assert.equal(explained.status, 401, 'the status Keystatic chose is preserved');
  assert.equal(explained.headers.get('content-type'), 'text/plain; charset=utf-8');
  const body = await explained.text();
  assert.match(body, /Authorization failed/, 'the original message is still there');
  assert.match(body, /bad_verification_code/, 'with the reason attached');

  const ok = new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
  assert.equal(await (await withFailureDetail(ok, detail)).text(), 'ok', 'a success is never annotated');
});

// ---------------------------------------------------------- CMS mobile sign-in
// Keystatic's GitHub flow is already a full-page redirect: the auth gate renders
// an anchor to /api/keystatic/github/login with target="_top", the server answers
// 307 to GitHub, and the return trip sets cookies and redirects to the dashboard.
// `window.open` appears ZERO times in the whole admin bundle, and the install
// handshake is a `storage` event rather than window.opener messaging — so there is
// no popup flow to replace and no config option that could choose one. What can
// still fail on a phone is the one window scripts are not allowed to close, and a
// frame that is not allowed to take over the top-level navigation.

test('CMS mobile sign-in - a window scripts cannot close still finishes', async () => {
  const closePage =
    "<script>localStorage.setItem('ks-refetch-installations', 'true');window.close();</script>";
  const rewritten = resumeAfterClose(closePage);
  assert.match(rewritten, /location\.replace\('\/keystatic'\)/, 'the reader is not left on a blank page');
  assert.ok(
    rewritten.includes("localStorage.setItem('ks-refetch-installations', 'true')"),
    'the handshake the other tab listens for survives',
  );
  assert.match(rewritten, /try\{window\.close\(\)\}/, 'closing is still attempted first');

  assert.equal(resumeAfterClose('<html>admin</html>'), '<html>admin</html>', 'other HTML is untouched');

  const html = new Response(closePage, { status: 200, headers: { 'content-type': 'text/html' } });
  assert.match(await (await withCloseFallback(html)).text(), /location\.replace/);
  const plain = new Response('plain', { status: 200, headers: { 'content-type': 'text/plain' } });
  assert.equal(await (await withCloseFallback(plain)).text(), 'plain');
});

/** Source with its comments removed, so a guard tests code rather than prose. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('CMS mobile sign-in - the admin never waits on a popup handshake, and covers the framed case', () => {
  // Comments are stripped first: this file deliberately explains why GitHub mode
  // needs no opener messaging, and that explanation must not read as a violation.
  const admin = code(readFileSync(join('components', 'keystatic', 'KeystaticAdmin.tsx'), 'utf8'));
  assert.doesNotMatch(
    admin,
    /window\.opener|postMessage/,
    'GitHub mode is a full-page redirect; nothing may depend on opener messaging',
  );
  assert.match(admin, /window\.self === window\.top/, 'the fallback applies only inside a frame');
  assert.match(
    admin,
    /SIGN_IN_HREF = '\/api\/keystatic\/github\/login'/,
    'it continues Keystatic\u2019s own sign-in endpoint rather than inventing one',
  );
  assert.match(admin, /window\.location\.assign\(href\)/, 'and keeps a last resort in the current frame');
});

test('CMS sign-in diagnostics - the callback route reports what GitHub sent', () => {
  const route = readFileSync(join('app', 'api', 'keystatic', '[...params]', 'route.ts'), 'utf8');
  assert.match(route, /captureTokenExchange/, 'the token exchange reply is recorded');
  assert.match(route, /console\.error\(/, 'a refusal reaches the server log');
  assert.match(route, /withFailureDetail/, 'and the failure response the browser shows');
  assert.match(route, /withCloseFallback/, 'the close page keeps a way forward on a phone');
  assert.match(route, /isCallbackPath\(url\.pathname\)/, 'only the callback is instrumented');
});
