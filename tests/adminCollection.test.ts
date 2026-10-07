/**
 * The articles dashboard, both collections.
 *
 * The management view used to list only `public/guides/*.md`, which meant the
 * sixteen typed guides the site actually publishes could not be seen, published,
 * retired or deleted from it. These tests pin what replaced that:
 *
 *  - the legacy reader understands a real module and REFUSES one it cannot address,
 *    rather than listing a row whose Delete would remove the wrong file;
 *  - the collection is a union of both readers, newest first, and a module it could
 *    not read is reported rather than dropped;
 *  - publishing or retiring a guide changes exactly one line, because the flag is
 *    the whole of its visibility;
 *  - an imported guide is never deleted unless it can be detached from the index
 *    that imports it — an import of a missing file is a build failure;
 *  - a status change on a CMS article rewrites the one key and leaves the rest of
 *    the file byte-identical.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LEGACY_GUIDE_ROOT,
  deleteLegacyGuide,
  isLegacyGuidePath,
  isoDayFromDateExpression,
  listLegacyGuidePaths,
  parseLegacyGuide,
  readLegacyCollection,
  readLegacyGuide,
  setLegacyGuideStatus,
  withLegacyPublished,
  withoutGuide,
} from '../lib/admin/legacy-guides';
import { sourceProblems } from '../lib/admin/source-guard';
import { withFrontMatterStatus } from '../lib/admin/authoring';
import { readManagedCollection } from '../lib/admin/collection';

const b64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64');
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status });

/** One real module in the repository, read from disk rather than re-declared. */
const realPath = 'content/guides/audio/microphone-too-quiet.ts';
const realSource = readFileSync(join(...realPath.split('/')), 'utf8');

const indexSource = readFileSync(join('content', 'guides', 'index.ts'), 'utf8');

// ------------------------------------------------------------------ the reader

test('legacy reader - the path filter takes article modules and nothing else', () => {
  assert.equal(isLegacyGuidePath('content/guides/audio/microphone-too-quiet.ts'), true);
  assert.equal(isLegacyGuidePath(`${LEGACY_GUIDE_ROOT}/index.ts`), false, 'the index is not an article');
  assert.equal(isLegacyGuidePath(`${LEGACY_GUIDE_ROOT}/schema.ts`), false, 'and neither is the schema');
  assert.equal(isLegacyGuidePath('content/guides/audio/nested/deeper.ts'), false, 'helpers are not articles');
  assert.equal(isLegacyGuidePath('public/guides/x.md'), false, 'the CMS collection is read elsewhere');
});

test('legacy reader - a real guide module parses, and only its own top-level fields', () => {
  const guide = parseLegacyGuide(realSource, realPath);
  assert.ok(guide);
  assert.equal(guide.slug, 'microphone-too-quiet');
  assert.equal(guide.title, 'Microphone Too Quiet? How to Raise Your Input Level');
  assert.equal(guide.category, 'audio');
  assert.equal(guide.publishedAt, '2026-08-14');
  assert.equal(guide.published, true);
  assert.equal(guide.status, 'published');
  assert.equal(guide.exportName, 'microphoneTooQuiet');
  assert.equal(guide.repoPath, realPath);

  // The prose lives in nested `sections`, and none of it may be mistaken for the
  // article's own metadata — a section's `h2` is the trap.
  assert.doesNotMatch(guide.title, /Measure the problem first/);
});

test('legacy reader - every guide in the repository parses with a unique slug', () => {
  const paths = [
    'audio/microphone-not-working', 'audio/microphone-too-quiet', 'audio/one-headphone-side-not-working',
    'audio/bluetooth-headphones-no-sound-windows-11', 'video/webcam-not-working',
    'input-gaming/keyboard-keys-not-registering', 'input-gaming/mouse-double-clicking',
    'input-gaming/controller-stick-drift', 'display/checking-screen-dead-pixels',
    'network/low-internet-speed-result', 'buying/microphones-for-meetings',
    'buying/webcams-for-low-light-calls', 'buying/mechanical-keyboards', 'buying/budget-headphones',
    'buying/home-office-monitors', 'buying/pc-controllers',
  ].map((slug) => `${LEGACY_GUIDE_ROOT}/${slug}.ts`);

  const slugs = paths.map((path) => {
    const guide = parseLegacyGuide(readFileSync(join(...path.split('/')), 'utf8'), path);
    assert.ok(guide, `${path} must parse — a module the dashboard cannot address is a hidden article`);
    return guide.slug;
  });
  assert.equal(new Set(slugs).size, slugs.length, 'guide slugs are unique');
});

test('legacy reader - a module it cannot address is refused, not guessed at', () => {
  assert.equal(parseLegacyGuide('export const x = 1;', 'content/guides/audio/x.ts'), null);
  assert.equal(
    parseLegacyGuide('export const x: GuideArticle = { slug: \'x\', title: \'X\' };', 'content/guides/audio/x.ts'),
    null,
    'no published flag means the dashboard could not publish or retire it'
  );
  assert.equal(
    parseLegacyGuide('export const x: GuideArticle = { slug: \'x\', published: true };', 'content/guides/audio/x.ts'),
    null,
    'no title means there is no row to show'
  );
});

test('legacy reader - the tree listing asks for modules, and a refusal is explained', async () => {
  const calls: string[] = [];
  const fake = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return json({
      tree: [
        { path: 'content/guides/index.ts', type: 'blob' },
        { path: 'content/guides/audio/one.ts', type: 'blob' },
        { path: 'content/guides/buying/two.ts', type: 'blob' },
        { path: 'public/guides/three.md', type: 'blob' },
        { path: 'content/guides/audio', type: 'tree' },
      ],
    });
  }) as typeof fetch;

  const paths = await listLegacyGuidePaths('token', fake);
  assert.equal(calls.length, 1, 'one recursive read lists the whole collection');
  assert.match(calls[0], /\/git\/trees\/main\?recursive=1$/);
  assert.deepEqual(paths, ['content/guides/audio/one.ts', 'content/guides/buying/two.ts']);

  const refusing = (async () => json({ message: 'Bad credentials' }, 401)) as typeof fetch;
  await assert.rejects(listLegacyGuidePaths('bad', refusing), (error: Error) => /401/.test(error.message));
});

test('legacy reader - a module is found by the slug it declares, not its filename', async () => {
  const named = 'content/guides/audio/renamed-file.ts';
  const source = `export const oddName: GuideArticle = {
  slug: 'its-real-slug',
  title: 'A Guide',
  category: 'audio',
  published: true,
  publishedAt: new Date('2026-08-14'),
};`;
  const fake = (async (url: RequestInfo | URL) => {
    const target = String(url);
    if (target.includes('/git/trees/')) return json({ tree: [{ path: named, type: 'blob' }] });
    if (target.includes('/contents/content/guides/audio/renamed-file.ts')) return json({ content: b64(source) });
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;

  const guide = await readLegacyGuide('its-real-slug', { token: 't', request: fake });
  assert.ok(guide, 'the declared slug finds the module even when the filename disagrees');
  assert.equal(guide.repoPath, named);
  assert.match(guide.source, /its-real-slug/);

  const missing = (async (url: RequestInfo | URL) =>
    String(url).includes('/git/trees/')
      ? json({ tree: [{ path: named, type: 'blob' }] })
      : json({ content: b64(source) })) as typeof fetch;
  assert.equal(await readLegacyGuide('not-a-slug-here', { token: 't', request: missing }), null);
});

test('legacy reader - a date expression becomes the ISO day the table sorts on', () => {
  assert.equal(isoDayFromDateExpression("new Date('2026-08-14')"), '2026-08-14');
  assert.equal(isoDayFromDateExpression('new Date(2026, 7, 14)'), '', 'anything else is honestly empty');
});

// ------------------------------------------------------------- the visibility

test('legacy status - the flag flips in place and nothing else in the file moves', () => {
  const retired = withLegacyPublished(realSource, false);
  assert.match(retired, /^  published: false,$/m);
  assert.doesNotMatch(retired, /^  published: true,$/m);
  assert.equal(
    retired,
    realSource.replace(/^ {2}published: true,$/m, '  published: false,'),
    'the whole file is the original with the one flag line changed'
  );
  assert.equal(withLegacyPublished(retired, true), realSource, 'and back again');

  // A `published` key nested inside the article's own data must not be the one that
  // changes: only the top-level flag decides a guide's visibility.
  const nested = `export const x: GuideArticle = {\n  published: true,\n  sections: [\n    {\n      published: false,\n    },\n  ],\n};`;
  const flipped = withLegacyPublished(nested, false);
  assert.match(flipped, /^  published: false,$/m);
  assert.match(flipped, /^      published: false,$/m);
});

test('legacy status - a commit writes the same path with the flag flipped', async () => {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({
      url: String(url),
      method,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
    });
    if (method === 'GET') return json({ content: b64(realSource), sha: 'the-sha', encoding: 'base64' });
    return json({ content: { sha: 'new-sha' } });
  }) as typeof fetch;

  const guide = parseLegacyGuide(realSource, realPath);
  assert.ok(guide);
  const result = await setLegacyGuideStatus({ guide, published: false, token: 't', request: fake });

  assert.equal(result.path, realPath, 'the module is updated, never copied');
  const put = calls.find((call) => call.method === 'PUT');
  assert.ok(put);
  assert.equal(put.body?.sha, 'the-sha', 'the contents API requires the current sha');
  assert.equal(put.body?.branch, 'main');
  assert.equal(
    Buffer.from(String(put.body?.content), 'base64').toString('utf8'),
    withLegacyPublished(realSource, false),
    'and what lands is the module with one line changed'
  );
  assert.match(String(put.body?.message), /Retire guide/);
});

// ------------------------------------------------------------------- deleting

test('legacy delete - the index is updated before the module is removed', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const target = String(url);
    calls.push({ url: target, method });
    if (target.includes('/contents/content/guides/index.ts')) {
      return method === 'GET'
        ? json({ content: b64(indexSource), sha: 'index-sha', encoding: 'base64' })
        : json({ content: { sha: 'new-index-sha' } });
    }
    if (target.includes('/contents/content/guides/audio/microphone-too-quiet.ts')) {
      return method === 'GET' ? json({ sha: 'module-sha' }) : json({});
    }
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;

  const guide = parseLegacyGuide(realSource, realPath);
  assert.ok(guide);
  const result = await deleteLegacyGuide({ guide, token: 't', request: fake });

  assert.equal(result.deleted, true);
  assert.equal(result.indexUpdated, true);
  const putIndex = calls.findIndex((call) => call.method === 'PUT');
  const deleteModule = calls.findIndex((call) => call.method === 'DELETE');
  assert.ok(putIndex !== -1 && deleteModule !== -1);
  assert.ok(
    putIndex < deleteModule,
    'the index stops importing the module before the module stops existing — the other order does not build'
  );
});

test('legacy delete - a module the index cannot be edited to drop is refused', async () => {
  const guide = { ...parseLegacyGuide(realSource, realPath)!, slug: 'never-imported-anywhere' };
  let wrote = false;
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') !== 'GET') wrote = true;
    return json({ content: b64(indexSource), sha: 's', encoding: 'base64' });
  }) as typeof fetch;

  await assert.rejects(
    deleteLegacyGuide({ guide, token: 't', request: fake }),
    (error: Error) => /would break the build/.test(error.message)
  );
  assert.equal(wrote, false, 'nothing is written when the delete cannot be completed safely');
});

test('legacy delete - the index loses the import and the entry, and keeps everything else', () => {
  const without = withoutGuide(indexSource, 'microphone-too-quiet');
  assert.notEqual(without, indexSource);
  assert.doesNotMatch(without, /microphone-too-quiet/, 'neither the import path nor the entry survives');
  assert.doesNotMatch(without, /microphoneTooQuiet/, 'and not the identifier either');
  assert.match(without, /microphoneNotWorking/, 'the other guides are untouched');
  assert.equal(
    (without.match(/^import /gm) ?? []).length,
    (indexSource.match(/^import /gm) ?? []).length - 1,
    'exactly one import was removed'
  );
  // The trailing comma before the closing bracket must not be left dangling.
  assert.doesNotMatch(without, /,\s*\n\s*,/, 'no doubled separator');

  assert.equal(withoutGuide(indexSource, 'no-such-guide'), indexSource, 'an unknown slug changes nothing');
});

// ------------------------------------------------------------ the source guard

test('source guard - a save has to keep the slug, the export and the flag', () => {
  const fields = { slug: 'microphone-too-quiet', exportName: 'microphoneTooQuiet' };
  assert.deepEqual(sourceProblems({ ...fields, source: realSource }), {}, 'the module as it stands is saveable');

  assert.ok(sourceProblems({ ...fields, source: '' }).content, 'an empty module is refused');
  assert.ok(
    sourceProblems({ ...fields, source: "  slug: 'something-else'," }).slug,
    'a changed slug is refused — it is the published URL'
  );
  assert.ok(
    sourceProblems({ ...fields, source: "export const renamed: GuideArticle = {};" }).exportName,
    'a renamed export is refused — content/guides/index.ts imports it'
  );
  assert.ok(
    sourceProblems({ ...fields, source: 'export const microphoneTooQuiet: GuideArticle = { slug: \'microphone-too-quiet\' };' })
      .published,
    'a module with no visibility flag is refused'
  );
});

// --------------------------------------------------------- the merged collection

test('collection - both sources are listed newest first, and a broken module is named', async () => {
  const cmsFile = [
    '---',
    "title: 'A CMS Article'",
    'publishedAt: 2026-10-05',
    'category: input-gaming',
    'status: draft',
    '---',
    '',
    'The body.',
  ].join('\n');

  const calls: string[] = [];
  const fake = (async (url: RequestInfo | URL) => {
    const target = String(url);
    calls.push(target);
    if (target.includes('/git/trees/')) {
      return json({
        tree: [
          { path: realPath, type: 'blob' },
          { path: 'content/guides/audio/broken.ts', type: 'blob' },
          { path: `${LEGACY_GUIDE_ROOT}/index.ts`, type: 'blob' },
        ],
      });
    }
    if (target.includes('/contents/public/guides?')) {
      return json([{ path: 'public/guides/cms-article.md', type: 'file' }]);
    }
    if (target.includes('/contents/content/guides/audio/broken.ts')) {
      return json({ content: b64('export const broken = 1;'), encoding: 'base64' });
    }
    if (target.includes(realPath)) {
      return json({ content: b64(realSource), encoding: 'base64' });
    }
    if (target.includes('public/guides/cms-article.md')) {
      return json({ content: b64(cmsFile), encoding: 'base64' });
    }
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;

  const { articles, unreadable } = await readManagedCollection({ token: 't', request: fake });

  assert.deepEqual(
    articles.map((article) => [article.slug, article.source, article.status]),
    [
      ['cms-article', 'cms', 'draft'],
      ['microphone-too-quiet', 'legacy', 'published'],
    ],
    'both collections, newest first, each with its own status and source'
  );
  assert.equal(articles[0].repoPath, 'public/guides/cms-article.md');
  assert.equal(articles[1].repoPath, realPath, 'each row carries the file its actions apply to');
  assert.deepEqual(unreadable, ['content/guides/audio/broken.ts'], 'the module that did not parse is named');

  const onlyLegacy = await readLegacyCollection({ token: 't', request: fake });
  assert.equal(onlyLegacy.guides.length, 1);
});

// ------------------------------------------------------- what the page offers

test('admin ui - the dashboard lists both collections and wires every action', () => {
  const page = readFileSync(join('app', 'admin', 'page.tsx'), 'utf8');
  assert.match(page, /readManagedCollection/, 'the desktop reads one merged collection');
  assert.match(page, /unreadable/, 'and names the modules it could not read');

  const table = readFileSync(join('components', 'admin', 'ArticlesTable.tsx'), 'utf8');
  for (const action of ['Edit', 'Publish', 'Archive', 'Delete', "'draft'"]) {
    assert.ok(table.includes(action), `the table offers ${action}`);
  }
  assert.match(table, /source=/, 'actions carry the source they apply to');
  assert.match(table, /\/admin\/source\//, 'a guide opens the source editor');
  assert.match(table, /\/admin\/edit\//, 'and a CMS article opens the Markdown editor');
  assert.match(table, /Are you sure you want to delete this article\?/, 'Delete still asks');
  assert.match(table, /method: 'DELETE'/, 'and goes through the publish endpoint');

  const endpoint = readFileSync(join('app', 'api', 'admin', 'status', 'route.ts'), 'utf8');
  assert.match(endpoint, /isAuthenticated\(request\.cookies\)/, 'the status endpoint is behind the session');
  assert.match(endpoint, /withFrontMatterStatus/, 'a CMS article gets one key rewritten');
  assert.match(endpoint, /setLegacyGuideStatus/, 'a guide gets its flag flipped');
  assert.match(endpoint, /status: published \? 'published' : 'archived'/, 'and the answer reports what the file holds');

  const source = readFileSync(join('app', 'api', 'admin', 'source', 'route.ts'), 'utf8');
  assert.match(source, /isAuthenticated\(request\.cookies\)/);
  assert.match(source, /readLegacyGuide\(slug/, 'the module is looked up, never named by the request');
  assert.match(source, /sourceProblems/, 'and the same guard the browser ran is enforced here');

  const publish = readFileSync(join('app', 'api', 'admin', 'publish', 'route.ts'), 'utf8');
  assert.match(publish, /deleteLegacyGuide/, 'DELETE removes a guide module through the index');
  assert.match(publish, /source === 'legacy'/);
});

// ----------------------------------------------------- a CMS article's status

test('cms status - the key is replaced in place, or inserted where the editor puts it', () => {
  const file = [
    '---',
    "title: 'An Article'",
    'coverImage: /uploads/x.png',
    'publishedAt: 2026-10-06',
    'category: audio',
    'status: published',
    'tags: []',
    '---',
    '',
    'The body.',
  ].join('\n');

  const archived = withFrontMatterStatus(file, 'archived');
  assert.match(archived, /^status: archived$/m);
  assert.doesNotMatch(archived, /^status: published$/m);
  assert.equal(
    archived,
    file.replace('status: published', 'status: archived'),
    'the whole file is the original with the one key changed'
  );

  // The field predates some articles: it goes in after `category`, which is where
  // composePostFile writes it — so a file that gains one looks like an edited one.
  const withoutStatus = file.replace('status: published\n', '');
  const inserted = withFrontMatterStatus(withoutStatus, 'draft');
  assert.equal(
    inserted.split('\n').slice(0, 8).join('\n'),
    [
      '---',
      "title: 'An Article'",
      'coverImage: /uploads/x.png',
      'publishedAt: 2026-10-06',
      'category: audio',
      'status: draft',
      'tags: []',
      '---',
    ].join('\n'),
    'the new key sits in its schema position'
  );

  // A body with no front matter has nowhere to put a status; the endpoint says so
  // rather than writing one into the prose.
  assert.equal(withFrontMatterStatus('Just prose.\n', 'draft'), 'Just prose.\n');
});
