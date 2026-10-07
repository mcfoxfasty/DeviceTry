import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_ADMIN_PASSWORD,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminPassword,
  constantTimeEqual,
  isAuthenticated,
  serializeCookie,
  sessionCookieAttributes,
  sessionTokenFor,
  signInCookie,
  signOutCookie,
  usingDefaultPassword,
} from '../lib/admin/session';
import {
  composePostFile,
  contentDigest,
  imageRepoPath,
  postRepoPath,
  publicImagePath,
  referencedUploads,
  slugify,
  validateAltText,
  validateDraft,
  validateImage,
  yamlScalar,
  type PostDraft,
  type UploadedImage,
} from '../lib/admin/authoring';
import {
  PUBLISH_BRANCH,
  base64EncodeUtf8,
  contentsUrl,
  deleteFile,
  fileExists,
  githubErrorMessage,
  publishArticle,
  repository,
} from '../lib/admin/github';
import { escapeHtml, renderInline, renderPreview } from '../lib/admin/preview';
import {
  decodeBase64Content,
  listArticles,
  parseFrontMatter,
  readArticle,
} from '../lib/admin/articles';
import {
  ALLOWED_HEADING_LEVELS,
  codeBlockTemplate,
  imageMarkdown,
  imageReferences,
  insertBlock,
  insertImage,
  prefixLines,
  tableTemplate,
  toggleWrap,
} from '../lib/admin/markdown-editing';
import { getPost, listPosts, listPublishedPosts } from '../lib/blog/content';
import { POST_CATEGORIES } from '../keystatic.config';

/**
 * The admin dashboard, from the login form to the committed file.
 *
 * These assert behaviour rather than markup: that a password check cannot be
 * brute-forced by timing, that an image cannot be inserted or published without
 * alt text, that the payload the editor sends is the payload the endpoint
 * accepts, that publishing commits images before the article, and — the one that
 * matters most — that the file this dashboard composes is readable by the same
 * reader /blog and /blog/[slug] use.
 */

// ------------------------------------------------------------------ session

test('admin auth - the documented default is used only when nothing is configured', () => {
  const before = process.env.ADMIN_PASSWORD;
  try {
    delete process.env.ADMIN_PASSWORD;
    assert.equal(adminPassword(), DEFAULT_ADMIN_PASSWORD);
    assert.equal(usingDefaultPassword(), true, 'the login page warns while this is true');

    process.env.ADMIN_PASSWORD = '   ';
    assert.equal(adminPassword(), DEFAULT_ADMIN_PASSWORD, 'whitespace is not a password');

    process.env.ADMIN_PASSWORD = 'a-real-password';
    assert.equal(adminPassword(), 'a-real-password');
    assert.equal(usingDefaultPassword(), false);
  } finally {
    if (before === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = before;
  }
});

test('admin auth - comparison is constant time and does not early-return on length', () => {
  assert.equal(constantTimeEqual('hunter2', 'hunter2'), true);
  assert.equal(constantTimeEqual('hunter2', 'hunter3'), false);
  assert.equal(constantTimeEqual('', ''), true);
  assert.equal(constantTimeEqual('short', 'much longer value'), false);
  assert.equal(constantTimeEqual('much longer value', 'short'), false, 'symmetry: the check cannot leak which side is longer');
});

test('admin auth - the cookie is derived from the password, so rotating it ends every session', async () => {
  const first = await sessionTokenFor('password-one');
  assert.equal(await sessionTokenFor('password-one'), first, 'the same password always verifies');
  assert.notEqual(await sessionTokenFor('password-two'), first, 'a new password invalidates old cookies');
  assert.ok(!first.includes('password-one'), 'the password is never inside the cookie value');
  assert.match(first, /^[A-Za-z0-9_-]+$/, 'cookie-safe: base64url, no padding');
});

test('admin auth - a request is authenticated only by this deployment\u2019s cookie', async () => {
  const before = process.env.ADMIN_PASSWORD;
  try {
    process.env.ADMIN_PASSWORD = 'test-password-value';
    const valid = await sessionTokenFor('test-password-value');
    const cookie = (value: string) => ({ get: (name: string) => (name === ADMIN_SESSION_COOKIE ? { value } : undefined) });

    assert.equal(await isAuthenticated(cookie(valid)), true);
    assert.equal(await isAuthenticated(cookie('not-the-token')), false);
    assert.equal(await isAuthenticated(cookie('')), false);
    assert.equal(await isAuthenticated({ get: () => undefined }), false);

    // A cookie minted by a deployment with a different password is refused even
    // though it is a well-formed token of the right shape.
    assert.equal(await isAuthenticated(cookie(await sessionTokenFor('some-other-password'))), false);
  } finally {
    if (before === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = before;
  }
});

test('admin auth - the cookie is HttpOnly, Lax, path-wide and expires', async () => {
  const cookie = await signInCookie('whatever');
  assert.match(cookie, new RegExp(`^${ADMIN_SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/, 'no script may read it');
  assert.match(cookie, /SameSite=Lax/, 'a cross-site form post cannot use it');
  assert.match(cookie, /Path=\//);
  assert.match(cookie, new RegExp(`Max-Age=${ADMIN_SESSION_SECONDS}`));
  assert.equal(sessionCookieAttributes().httpOnly, true);

  const cleared = signOutCookie();
  assert.match(cleared, /Max-Age=0/, 'signing out clears the same cookie');
  assert.match(cleared, /Path=\//, 'and repeats its attributes, or the browser keeps the old one');

  assert.equal(serializeCookie('a', 'b', { path: '/', maxAge: 1, httpOnly: true, secure: true, sameSite: 'Lax' }), 'a=b; Path=/; Max-Age=1; HttpOnly; Secure; SameSite=Lax');
});

// ------------------------------------------------------------------ editor

test('admin editor - headings are H2/H3/H4 only, and prefixing is idempotent', () => {
  assert.deepEqual([...ALLOWED_HEADING_LEVELS], [2, 3, 4], 'the page title owns the H1');

  const state = { value: 'A paragraph', selectionStart: 0, selectionEnd: 0 };
  const heading = prefixLines(state, '## ');
  assert.equal(heading.value, '## A paragraph');
  assert.equal(prefixLines(heading, '## ').value, 'A paragraph', 'clicking the same button again removes it');
  assert.equal(prefixLines({ value: '### Old', selectionStart: 0, selectionEnd: 0 }, '## ').value, '## Old', 'a prefix replaces another heading level');
});

test('admin editor - wrapping selects the text it just wrote, and toggles off', () => {
  const bold = toggleWrap({ value: 'hello', selectionStart: 0, selectionEnd: 5 }, '**');
  assert.equal(bold.value, '**hello**');
  assert.deepEqual([bold.selectionStart, bold.selectionEnd], [2, 7], 'the selection stays on the words');
  assert.equal(toggleWrap(bold, '**').value, 'hello', 'toggling again unwraps');

  const empty = toggleWrap({ value: '', selectionStart: 0, selectionEnd: 0 }, '_');
  assert.equal(empty.value, '_text_', 'an empty selection still produces something editable');
});

test('admin editor - a table and a code block land as their own blocks', () => {
  const table = insertBlock({ value: 'intro', selectionStart: 5, selectionEnd: 5 }, tableTemplate());
  assert.equal(table.value, 'intro\n\n| Column | Column |\n| --- | --- |\n|  |  |\n');
  assert.match(codeBlockTemplate(), /^```powershell\n\n```$/, 'fenced, with the language the articles use');
});

test('admin editor - an inserted image is isolated, captioned and carries its alt text', () => {
  const inserted = insertImage(
    { value: 'Some prose.', selectionStart: 11, selectionEnd: 11 },
    '/uploads/switch-abc12345.png',
    'A worn keyboard switch',
    'Figure 1. The switch'
  );
  assert.equal(
    inserted.value,
    "Some prose.\n\n![A worn keyboard switch](/uploads/switch-abc12345.png 'Figure 1. The switch')\n"
  );

  const withoutCaption = imageMarkdown('/uploads/x.png', 'Alt text here');
  assert.equal(withoutCaption, '![Alt text here](/uploads/x.png)');
  assert.deepEqual(imageReferences(inserted.value), [
    { alt: 'A worn keyboard switch', url: '/uploads/switch-abc12345.png' },
  ]);
});

// ------------------------------------------------------- alt text is required

test('admin alt text - "required" means the alt text has to describe something', () => {
  assert.match(validateAltText('') ?? '', /required/);
  assert.match(validateAltText('   ') ?? '', /required/);
  assert.match(validateAltText('a.png') ?? '', /too short/);
  assert.match(validateAltText('...') ?? '', /words/);
  assert.equal(validateAltText('A worn keyboard switch with a bright contact'), null);
});

const draft = (overrides: Partial<PostDraft> = {}): PostDraft => ({
  title: 'Keyboard Keys Not Registering',
  slug: 'keyboard-keys-not-registering',
  seoTitle: '',
  seoDescription: '',
  coverImage: '/uploads/cover-abc12345.png',
  coverImageAlt: 'The DeviceTry cover card with the wordmark',
  publishedAt: '2026-10-06',
  author: 'DeviceTry team',
  category: POST_CATEGORIES[0].value,
  status: 'published',
  tags: ['keyboard'],
  canonicalUrl: '',
  content: 'A paragraph of the article.',
  ...overrides,
});

test('admin validation - the publish endpoint refuses a cover image without alt text', () => {
  const errors = validateDraft(draft({ coverImageAlt: '' }));
  assert.match(errors.coverImageAlt ?? '', /required/);

  const short = validateDraft(draft({ coverImageAlt: 'x' }));
  assert.match(short.coverImageAlt ?? '', /too short/);
});

test('admin validation - the publish endpoint refuses an inline image without alt text', () => {
  const errors = validateDraft(draft({ content: 'Text.\n\n![](/uploads/inline-abc.png)\n' }));
  assert.match(errors.content ?? '', /Alt text for \/uploads\/inline-abc\.png/);

  const ok = validateDraft(
    draft({ content: 'Text.\n\n![A worn switch, photographed closely](/uploads/inline-abc.png)\n' })
  );
  assert.equal(ok.content, undefined);
});

test('admin validation - the fields the schema requires are enforced before GitHub is called', () => {
  assert.deepEqual(validateDraft(draft()), {}, 'a complete draft passes');
  assert.ok(validateDraft(draft({ title: '' })).title);
  assert.ok(validateDraft(draft({ slug: 'Not A Slug' })).slug);
  assert.ok(validateDraft(draft({ publishedAt: 'today' })).publishedAt);
  assert.ok(validateDraft(draft({ author: '  ' })).author);
  assert.ok(validateDraft(draft({ category: 'not-a-category' })).category);
  assert.ok(validateDraft(draft({ content: '   ' })).content);
  assert.ok(validateDraft(draft({ canonicalUrl: 'somewhere-else' })).canonicalUrl);
  assert.ok(validateDraft(draft({ tags: Array.from({ length: 13 }, (_, i) => `tag${i}`) })).tags);
});

test('admin validation - an image has to be a real, allowed, sanely sized upload', () => {
  const good: UploadedImage = { filename: 'cover-abc12345.png', contentType: 'image/png', base64: 'AAAA' };
  assert.equal(validateImage(good), null);

  assert.match(validateImage({ ...good, filename: 'Cover Photo.png' }) ?? '', /usable image filename/);
  assert.match(validateImage({ ...good, filename: 'cover-abc12345.gif' }) ?? '', /does not match its extension/);
  assert.match(validateImage({ ...good, contentType: 'image/svg+xml' }) ?? '', /does not match/);
  assert.match(validateImage({ ...good, base64: 'not base64!' }) ?? '', /base64/);
  assert.match(
    validateImage({ ...good, base64: 'A'.repeat(Math.ceil((6 * 1024 * 1024 * 4) / 3) + 4) }) ?? '',
    /larger than/
  );
});

test('admin images - a path in the body that was not uploaded is reported, not silently published', () => {
  const uploads: UploadedImage[] = [{ filename: 'inline-abc12345.png', contentType: 'image/png', base64: 'AAAA' }];
  const content = '![A described image](/uploads/inline-abc12345.png)\n\n![Another](/uploads/missing-9.png)\n';

  const { provided, missing } = referencedUploads(content, uploads);
  assert.equal(provided.length, 1);
  assert.equal(provided[0].filename, 'inline-abc12345.png');
  assert.deepEqual(missing, ['/uploads/missing-9.png']);

  const external = referencedUploads('![Alt text here](https://example.com/x.png)', uploads);
  assert.deepEqual(external.missing, [], 'an external image is not an upload');
});

// -------------------------------------------------------------- composition

test('admin composition - YAML scalars are quoted only when YAML would misread them', () => {
  assert.equal(yamlScalar('Keyboard Keys Not Registering'), 'Keyboard Keys Not Registering');
  assert.equal(yamlScalar('DeviceTry team'), 'DeviceTry team');
  assert.equal(yamlScalar('Troubleshooting: a guide'), "'Troubleshooting: a guide'");
  assert.equal(yamlScalar("The author's own words"), "'The author''s own words'");
  assert.equal(yamlScalar('true'), "'true'", 'a bare true would become a boolean');
  assert.equal(yamlScalar('2026'), "'2026'", 'and a bare number a number');
  assert.equal(yamlScalar(''), "''");
});

test('admin composition - the file matches the shape of the articles already published', () => {
  const file = composePostFile(draft({ seoTitle: 'Keys Not Registering?', tags: ['keyboard', 'troubleshooting'] }));
  const [frontMatter] = file.split('\n---\n');
  const keys = frontMatter
    .split('\n')
    .filter((line) => /^[a-zA-Z]+:/.test(line))
    .map((line) => line.split(':')[0]);

  assert.deepEqual(keys, [
    'title',
    'seoTitle',
    'seoDescription',
    'coverImage',
    'coverImageAlt',
    'publishedAt',
    'author',
    'category',
    'status',
    'tags',
    'canonicalUrl',
  ]);
  assert.match(file, /\n---\n\nA paragraph of the article\.\n$/, 'the body sits below the front matter');
  assert.match(file, /\n  - keyboard\n  - troubleshooting\n/, 'tags are a block sequence');
  assert.match(file, /canonicalUrl: null/, 'an absent override is null, as in the published articles');

  const existing = readFileSync(
    join('public', 'guides', 'keyboard-keys-not-registering-hardware-or-software.md'),
    'utf8'
  );
  const existingKeys = existing
    .split('\n---\n')[0]
    .split('\n')
    .filter((line) => /^[a-zA-Z]+:/.test(line))
    .map((line) => line.split(':')[0]);
  // The one key the dashboard adds is `status`, in its schema position — and the
  // articles predating the field have no such key, which is why the reader treats
  // a missing status as `published` rather than an error.
  assert.deepEqual(
    keys.filter((key) => key !== 'status'),
    existingKeys,
    'the key order matches the published article exactly, plus status'
  );
  assert.doesNotMatch(existing, /^status:/m, 'the pre-existing article has no status key at all');
});

test('admin composition - what the dashboard writes, the blog reader reads back', async () => {
  // The round trip, on the real collection: write a draft the way the publish
  // endpoint does, read it with the same reader /blog uses, then remove it. A
  // composer that produced plausible YAML the schema could not parse would fail
  // here rather than on the live site.
  const slug = 'zz-admin-round-trip-check';
  const path = join('public', 'guides', `${slug}.md`);
  const body = 'Intro paragraph.\n\n## A subheading\n\n- one\n- two\n\nA closing line.';

  try {
    writeFileSync(
      path,
      composePostFile(
        draft({
          slug,
          title: 'Round Trip: A Title With Punctuation, and a Colon',
          seoTitle: 'Round Trip',
          seoDescription: 'A description with an em dash — and punctuation.',
          publishedAt: '2026-11-02',
          tags: ['a tag', 'another'],
          content: body,
        })
      ),
      'utf8'
    );

    const read = await getPost(slug);
    assert.ok(read, 'the reader found the file the dashboard composed');
    assert.equal(read.title, 'Round Trip: A Title With Punctuation, and a Colon', 'punctuation survives YAML');
    assert.equal(read.slug, slug);
    assert.equal(read.seoTitle, 'Round Trip');
    assert.equal(read.seoDescription, 'A description with an em dash — and punctuation.');
    assert.equal(read.coverImage, '/uploads/cover-abc12345.png');
    assert.equal(read.coverImageAlt, 'The DeviceTry cover card with the wordmark');
    assert.equal(read.publishedAt, '2026-11-02');
    assert.equal(read.author, 'DeviceTry team');
    assert.equal(read.category, POST_CATEGORIES[0].value);
    assert.deepEqual(read.tags, ['a tag', 'another']);
    assert.equal(read.canonicalUrl, null);
    assert.match(read.content, /## A subheading/);
    assert.match(read.content, /A closing line\./);

    assert.equal(read.status, 'published', 'the status the sidebar chose is what the reader hands back');

    const listed = (await listPosts()).find((post) => post.slug === slug);
    assert.ok(listed, 'the article also appears in the listing the management table uses');
    assert.equal(listed.publishedAt, '2026-11-02');
    const publishedList = (await listPublishedPosts()).find((post) => post.slug === slug);
    assert.ok(publishedList, 'a published article is in the public list');
  } finally {
    rmSync(path, { force: true });
  }
  assert.equal(existsSync(path), false, 'the round-trip file is not left behind');
});

test('admin status - a draft is written, read back, and hidden from the public list', async () => {
  const slug = 'zz-admin-status-check';
  const path = join('public', 'guides', `${slug}.md`);
  try {
    writeFileSync(path, composePostFile(draft({ slug, status: 'draft' })), 'utf8');

    const read = await getPost(slug);
    assert.ok(read);
    assert.equal(read.status, 'draft', 'the reader hands back exactly the status in the file');

    assert.ok((await listPosts()).some((post) => post.slug === slug), 'the management list shows every status');
    assert.equal(
      (await listPublishedPosts()).some((post) => post.slug === slug),
      false,
      'the public list — index, static params, sitemap — excludes it'
    );
  } finally {
    rmSync(path, { force: true });
  }
});

test('admin status - an article whose file has no status key reads as published', async () => {
  // The article predates the field; its live URL must not depend on anyone adding
  // a key to files the dashboard did not write.
  const existing = await getPost('keyboard-keys-not-registering-hardware-or-software');
  assert.ok(existing, 'the pre-existing article is present');
  assert.equal(existing.status, 'published');
});

test('admin validation - the status must be one of the schema states', () => {
  assert.deepEqual(validateDraft(draft({ status: 'draft' })), {}, 'draft is a valid state');
  assert.ok(validateDraft(draft({ status: 'someday' as PostDraft['status'] })).status);
});

// ------------------------------------------------------------ github publish

test('admin publish - paths and endpoints match the repository layout and the API', () => {
  assert.equal(repository(), 'mcfoxfasty/DeviceTry', 'the slug GitHub itself reports');
  assert.equal(postRepoPath('my-article'), 'public/guides/my-article.md');
  assert.equal(imageRepoPath('cover-abc12345.png'), 'public/uploads/cover-abc12345.png');
  assert.equal(publicImagePath('cover-abc12345.png'), '/uploads/cover-abc12345.png');
  assert.equal(PUBLISH_BRANCH, 'main');
  assert.equal(
    contentsUrl('public/guides/my article.md'),
    'https://api.github.com/repos/mcfoxfasty/DeviceTry/contents/public/guides/my%20article.md'
  );
});

test('admin publish - GitHub refusals are explained rather than passed through', () => {
  assert.match(githubErrorMessage(401, '{"message":"Bad credentials"}'), /Bad credentials/);
  assert.match(githubErrorMessage(401, '{}'), /Contents: read and write/, 'a bare 401 says what to check');
  assert.match(githubErrorMessage(403, '{"message":"Resource not accessible by integration"}'), /rate limit/);
  assert.match(githubErrorMessage(409, '{"message":"sha wasn\'t supplied"}'), /publish again/);
  assert.match(githubErrorMessage(500, 'not json at all'), /not json at all/);
});

test('admin publish - images are committed before the article, on the publishing branch', async () => {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ url: String(url), method, body });
    if (method === 'GET') return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response('{"content":{"sha":"abc123"}}', { status: 201 });
  }) as typeof fetch;

  const images: UploadedImage[] = [
    { filename: 'cover-abc12345.png', contentType: 'image/png', base64: 'AAAA' },
    { filename: 'inline-def67890.png', contentType: 'image/png', base64: 'BBBB' },
  ];
  const result = await publishArticle({
    draft: draft({ content: '![A described image](/uploads/inline-def67890.png)' }),
    images,
    token: 'ghp_test_token',
    request: fake,
  });

  const puts = calls.filter((call) => call.method === 'PUT');
  assert.equal(puts.length, 3, 'two images, then the article');
  assert.match(puts[0].url, /public\/uploads\/cover-abc12345\.png$/);
  assert.match(puts[1].url, /public\/uploads\/inline-def67890\.png$/);
  assert.match(puts[2].url, /public\/guides\/keyboard-keys-not-registering\.md$/, 'the article lands last');
  for (const put of puts) {
    assert.equal(put.body?.branch, 'main');
    assert.equal(put.body?.sha, undefined, 'a creation carries no sha');
    assert.equal(typeof put.body?.message, 'string');
  }
  assert.equal(result.commits.length, 3);
  assert.equal(result.commits[0].created, true);
});

test('admin publish - updating an existing article sends the sha the API requires', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') {
      return new Response('{"sha":"existing-sha"}', { status: 200 });
    }
    bodies.push(JSON.parse(String(init?.body)));
    return new Response('{"content":{"sha":"new-sha"}}', { status: 200 });
  }) as typeof fetch;

  const result = await publishArticle({ draft: draft(), images: [], token: 'ghp_test_token', request: fake });
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].sha, 'existing-sha', 'without it GitHub answers 409');
  assert.equal(result.commits[0].created, false);
});

test('admin publish - base64 encoding survives characters btoa alone would corrupt', async () => {
  const encoded = base64EncodeUtf8('An em dash — and a curly quote ’ in a title');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assert.equal(decoded, 'An em dash — and a curly quote ’ in a title');
});

test('admin publish - a refusal from GitHub surfaces as a readable error', async () => {
  const fake = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;
  await assert.rejects(
    publishArticle({ draft: draft(), images: [], token: 'bad', request: fake }),
    (error: Error) => {
      assert.match(error.message, /401/);
      assert.match(error.message, /Bad credentials/);
      assert.match(error.message, /Contents: read and write/);
      return true;
    }
  );
});

test('admin dashboard - the secrets it needs are named, and the old flow is gone', () => {
  const publish = readFileSync(join('app', 'api', 'admin', 'publish', 'route.ts'), 'utf8');
  assert.match(publish, /process\.env\.GITHUB_TOKEN/, 'GitHub authorization comes from GITHUB_TOKEN');
  assert.match(publish, /isAuthenticated\(request\.cookies\)/, 'and nothing is committed without a session');
  assert.match(publish, /validateDraft\(/, 'the draft rules run on the server too');

  const session = readFileSync(join('lib', 'admin', 'session.ts'), 'utf8');
  assert.match(session, /process\.env\.ADMIN_PASSWORD/);
  assert.match(session, /httpOnly: true/);
  assert.match(session, /sameSite: 'Lax'/);
  assert.match(session, /HMAC/, 'the cookie is derived, so there is no session store to lose');

  // The OAuth dashboard is removed, not merely unused: no route, no page, no
  // callback for a token exchange to fail in.
  for (const gone of [
    join('app', 'api', 'keystatic'),
    join('app', 'keystatic'),
    join('components', 'keystatic'),
    join('lib', 'keystatic'),
  ]) {
    assert.equal(existsSync(gone), false, `${gone} must not exist`);
  }

  const robots = readFileSync(join('app', 'robots.ts'), 'utf8');
  assert.match(robots, /'\/admin'/);
  assert.doesNotMatch(robots, /keystatic/);

  const layout = readFileSync(join('app', 'admin', 'layout.tsx'), 'utf8');
  assert.match(layout, /robots:\s*\{\s*index:\s*false/, 'the dashboard stays out of search results');

  const page = readFileSync(join('app', 'admin', 'page.tsx'), 'utf8');
  assert.match(page, /isAuthenticated\(await cookies\(\)\)/, 'the guard runs on the server');
  assert.match(page, /redirect\('\/admin\/login'\)/, 'and an anonymous visitor never receives the editor');

  const login = readFileSync(join('app', 'admin', 'login', 'page.tsx'), 'utf8');
  assert.match(login, /method="post"/, 'the form works without JavaScript, which is what a phone needs');
  assert.doesNotMatch(login, /window\.|onSubmit/, 'no client-side handoff to break');
});

test('admin editor - the dashboard offers every capability and every SEO field', () => {
  const editor = readFileSync(join('components', 'admin', 'ArticleEditor.tsx'), 'utf8');
  for (const capability of ['H2', 'H3', 'H4', 'Bold', 'Italic', 'Strike', 'Code', 'Bullets', 'Numbered', 'Quote', 'Link', 'Image', 'Table', 'Code block', 'Divider']) {
    assert.match(editor, new RegExp(capability), `the toolbar offers ${capability}`);
  }
  for (const field of [
    'Article title',
    'URL slug',
    'SEO meta title',
    'SEO meta description',
    'Cover image',
    'Cover alt text',
    'Publish date',
    'Author',
    'Category',
    'Status',
    'Tags',
    'Canonical URL override',
  ]) {
    assert.match(editor, new RegExp(field), `the sidebar offers ${field}`);
  }

  assert.match(editor, /validateAltText\(imagePanel\.alt/, 'an inline image cannot be inserted without alt text');
  assert.match(editor, /validateAltText\(draft\.coverImageAlt/, 'and neither can the cover');
  assert.match(editor, /slugify\(value\)/, 'the slug follows the title');
  assert.match(editor, /slugEdited/, 'until the author takes it over');
});

test('admin uploads - a filename is derived from the original name and the bytes', async () => {
  assert.equal(slugify('Cover Photo (final).PNG'), 'cover-photo-final-png');
  const first = await contentDigest('AAAA');
  assert.equal(await contentDigest('AAAA'), first, 'the same bytes give the same name');
  assert.notEqual(await contentDigest('BBBB'), first, 'different bytes do not collide');
  assert.equal(first.length, 8);
});

// ------------------------------------------------------------------ preview

test('admin preview - every construct the toolbar writes renders as the article will', () => {
  const html = renderPreview(
    [
      '## The five-minute test',
      '',
      'A paragraph with **bold**, _italic_, ~~a strike~~ and `inline code`.',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '> A quoted sentence.',
      '',
      '---',
      '',
      '| What it shows | Meaning |',
      '| :--- | ---: |',
      '| Nothing | Hardware |',
      '',
      '```powershell',
      'Get-PnpDevice',
      '```',
      '',
      "![A worn switch](/uploads/switch.png 'Figure 1. The switch')",
    ].join('\n')
  );

  assert.match(html, /<h2 class="/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<del>a strike<\/del>/);
  assert.match(html, /<code class="[^"]*">inline code<\/code>/);
  assert.match(html, /<ul class="[^"]*"><li class="pl-1">one<\/li><li class="pl-1">two<\/li><\/ul>/);
  assert.match(html, /<ol class="[^"]*">/);
  assert.match(html, /<blockquote class="[^"]*">A quoted sentence\.<\/blockquote>/);
  assert.match(html, /<hr class="[^"]*" \/>/);
  assert.match(html, /<th class="[^"]*" style="text-align: left">What it shows<\/th>/);
  assert.match(html, /<td class="[^"]*" style="text-align: right">Hardware<\/td>/);
  assert.match(html, /<pre class="[^"]*"><code class="language-powershell">Get-PnpDevice<\/code><\/pre>/);
  assert.match(html, /<figure class="[^"]*"><img src="\/uploads\/switch\.png" alt="A worn switch"[^>]*\/>/);
  assert.match(html, /<figcaption class="[^"]*">Figure 1\. The switch<\/figcaption>/);
});

test('admin preview - a link is an anchor, and internal ones stay internal', () => {
  const internal = renderInline('[the tester](/test/keyboard-test)');
  assert.match(internal, /^<a href="\/test\/keyboard-test" class="[^"]*">the tester<\/a>$/);

  const external = renderInline('[the docs](https://example.com/a)');
  assert.match(external, /target="_blank" rel="noopener noreferrer"/);
});

test('admin preview - article text is escaped, so a body cannot smuggle in markup', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  const html = renderPreview('A <script>alert(1)</script> and an <img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('admin preview - a paragraph that is only an image becomes the figure itself', () => {
  const html = renderPreview('![Described image](/uploads/x.png)');
  assert.match(html, /^<figure class="[^"]*">/);
  assert.doesNotMatch(html, /<p class=/);
});

// ------------------------------------------------------------- delete + edit

test('admin delete - a file that exists is removed with its sha, and a missing one is a fact', async () => {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ url: String(url), method, body });
    return new Response('{"sha":"the-sha"}', { status: method === 'DELETE' ? 200 : 200 });
  }) as typeof fetch;

  const result = await deleteFile({
    path: 'public/guides/old-name.md',
    message: 'Delete "old-name"',
    token: 'ghp_test_token',
    request: fake,
  });

  assert.equal(result.deleted, true);
  assert.equal(calls.length, 2, 'a sha lookup, then the delete');
  assert.equal(calls[1].method, 'DELETE');
  assert.match(calls[1].url, /public\/guides\/old-name\.md$/);
  assert.equal(calls[1].body?.sha, 'the-sha', 'the contents API refuses a delete without the current sha');
  assert.equal(calls[1].body?.branch, 'main');

  const absent = (async () => new Response('{"message":"Not Found"}', { status: 404 })) as typeof fetch;
  assert.deepEqual(
    await deleteFile({ path: 'public/guides/gone.md', message: 'x', token: 't', request: absent }),
    { path: 'public/guides/gone.md', deleted: false },
    'deleting twice is not an error — the requested state is already true'
  );
});

test('admin delete - a refusal from GitHub is explained, not swallowed', async () => {
  const refusing = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;
  await assert.rejects(
    deleteFile({ path: 'public/guides/x.md', message: 'x', token: 'bad', request: refusing }),
    (error: Error) => {
      assert.match(error.message, /401/);
      assert.match(error.message, /Bad credentials/);
      return true;
    }
  );
});

test('admin existence - a referenced image must be uploaded or already committed', async () => {
  const present = (async () => new Response('{"sha":"s"}', { status: 200 })) as typeof fetch;
  const absent = (async () => new Response('{"message":"Not Found"}', { status: 404 })) as typeof fetch;
  const broken = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;

  assert.equal(await fileExists('public/uploads/old.png', 't', present), true);
  assert.equal(await fileExists('public/uploads/old.png', 't', absent), false);
  await assert.rejects(fileExists('public/uploads/old.png', 'bad', broken), (error: Error) =>
    /401/.test(error.message)
  );
});

// ------------------------------------------------- the collection, via the API

test('admin collection - front matter is read the way the dashboard writes it', () => {
  const file = composePostFile(
    draft({
      title: "A title with a colon: and the author's apostrophe",
      seoTitle: 'A quoted meta title',
      seoDescription: '',
      status: 'draft',
      tags: ['keyboard', 'a tag'],
      canonicalUrl: 'https://example.com/original',
      content: 'Intro.\n\n## A subheading\n\nThe closing words.',
    })
  );
  const { data, body } = parseFrontMatter(file);

  assert.equal(data.title, "A title with a colon: and the author's apostrophe", 'quotes are unescaped');
  assert.equal(data.seoTitle, 'A quoted meta title');
  assert.equal(data.seoDescription, null, 'an empty field is null, as composed');
  assert.equal(data.status, 'draft');
  assert.deepEqual(data.tags, ['keyboard', 'a tag'], 'tags come back as a list');
  assert.equal(data.canonicalUrl, 'https://example.com/original');
  assert.match(body, /^Intro\./, 'the body starts at its first line, not at a blank one');
  assert.match(body, /The closing words\./);
});

test('admin collection - the article already in the repository parses entirely', () => {
  const file = readFileSync(
    join('public', 'guides', 'keyboard-keys-not-registering-hardware-or-software.md'),
    'utf8'
  );
  const { data, body } = parseFrontMatter(file);

  assert.match(String(data.title), /Keyboard Keys Not Registering/);
  assert.equal(data.publishedAt, '2026-10-06');
  assert.equal(data.category, 'input-gaming');
  assert.equal(data.canonicalUrl, null);
  assert.deepEqual(data.tags, ['keyboard', 'troubleshooting']);
  assert.match(body, /## The five-minute test/);
  assert.match(body, /\| What the tester shows \|/, 'a table in the body is body, not front matter');
});

test('admin collection - a file with no front matter is still readable', () => {
  const { data, body } = parseFrontMatter('Just prose, no delimiters.\n');
  assert.deepEqual(data, {});
  assert.equal(body, 'Just prose, no delimiters.\n');
});

test('admin collection - base64 content survives characters ASCII would corrupt', () => {
  const original = 'An em dash — a curly quote ’ and an accent é';
  const encoded = Buffer.from(original, 'utf8').toString('base64');
  assert.equal(decodeBase64Content(encoded), original);
  assert.equal(decodeBase64Content(encoded.replace(/(.{20})/, '$1\n')), original, 'whitespace in the payload is ignored');
});

test('admin collection - the listing asks the repository and sorts newest first', async () => {
  const files: Record<string, string> = {
    'public/guides/newer.md': composePostFile(
      draft({ slug: 'newer', publishedAt: '2026-10-07', status: 'draft', title: 'Newer draft' })
    ),
    'public/guides/older.md': composePostFile(
      draft({ slug: 'older', publishedAt: '2026-09-01', status: 'published', title: 'Older article' })
    ),
  };
  const calls: string[] = [];
  const fake = (async (url: RequestInfo | URL) => {
    const target = String(url);
    calls.push(target);
    if (target.includes('/contents/public/guides?')) {
      return new Response(
        JSON.stringify(
          Object.keys(files).map((path) => ({ path, type: 'file', name: path.split('/').pop() }))
        ),
        { status: 200 }
      );
    }
    const path = Object.keys(files).find((candidate) => target.includes(candidate));
    if (!path) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(
      JSON.stringify({ content: Buffer.from(files[path], 'utf8').toString('base64'), encoding: 'base64' }),
      { status: 200 }
    );
  }) as typeof fetch;

  const articles = await listArticles({ token: 'ghp_test_token', request: fake });
  assert.equal(calls.length, 3, 'one listing plus one request per article');
  assert.deepEqual(
    articles.map((article) => [article.slug, article.status]),
    [
      ['newer', 'draft'],
      ['older', 'published'],
    ],
    'newest first, and each article carries its own status'
  );
  assert.equal(articles[0].title, 'Newer draft');
});

test('admin collection - one article is read with its body, and a missing one is null', async () => {
  const file = composePostFile(draft({ slug: 'loaded', content: 'Body text here.' }));
  const fake = (async () =>
    new Response(
      JSON.stringify({ content: Buffer.from(file, 'utf8').toString('base64'), encoding: 'base64' }),
      { status: 200 }
    )) as typeof fetch;

  const article = await readArticle('loaded', { token: 'ghp_test_token', request: fake });
  assert.ok(article);
  assert.equal(article.slug, 'loaded');
  assert.equal(article.status, 'published');
  assert.equal(article.coverImageAlt, 'The DeviceTry cover card with the wordmark');
  assert.deepEqual(article.tags, ['keyboard']);
  assert.match(article.content, /Body text here\./);

  const missing = (async () => new Response('{"message":"Not Found"}', { status: 404 })) as typeof fetch;
  assert.equal(await readArticle('gone', { token: 'ghp_test_token', request: missing }), null);
});

test('admin collection - a refusal from GitHub is explained, not shown as an empty list', async () => {
  const refusing = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;
  await assert.rejects(listArticles({ token: 'bad', request: refusing }), (error: Error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /Bad credentials/);
    return true;
  });
});

test('admin collection - the admin reads the repository, not the build-time files', () => {
  const list = readFileSync(join('app', 'admin', 'page.tsx'), 'utf8');
  assert.match(list, /listArticles\(\{ token \}\)/, 'the management view asks GitHub');
  assert.doesNotMatch(list, /listPosts\(/, 'and not the reader the Worker cannot resolve');
  assert.match(list, /publishToken\(\)/);

  const edit = readFileSync(join('app', 'admin', 'edit', '[slug]', 'page.tsx'), 'utf8');
  assert.match(edit, /readArticle\(slug, \{ token \}\)/);
  assert.doesNotMatch(edit, /getPost\(/, 'the edit page does not read the collection from disk');

  const config = readFileSync('next.config.ts', 'utf8');
  assert.doesNotMatch(
    config,
    /outputFileTracingIncludes/,
    'nothing traces public/guides into the worker any more — that was the empty-list bug'
  );
});

test('admin lifecycle - the routes exist, are guarded, and wire the whole flow', () => {
  const list = readFileSync(join('app', 'admin', 'page.tsx'), 'utf8');
  assert.match(list, /isAuthenticated\(await cookies\(\)\)/, 'the management view is behind the session');
  assert.match(list, /redirect\('\/admin\/login'\)/);
  // The collection read itself is asserted in 'the admin reads the repository,
  // not the build-time files' above; here the concern is the guard and the link.
  assert.match(list, /\/admin\/new/, 'it links to the new-article editor');

  const fresh = readFileSync(join('app', 'admin', 'new', 'page.tsx'), 'utf8');
  assert.match(fresh, /isAuthenticated\(await cookies\(\)\)/);
  assert.match(fresh, /ArticleEditor/);

  const edit = readFileSync(join('app', 'admin', 'edit', '[slug]', 'page.tsx'), 'utf8');
  assert.match(edit, /isAuthenticated\(await cookies\(\)\)/);
  assert.match(edit, /readArticle\(slug, \{ token \}\)/, 'an edit loads the saved article, through the API');
  assert.match(edit, /existingSlug/, 'so saving updates the same file rather than duplicating it');
  assert.match(edit, /notFound\(\)/, 'an unknown slug is not an editor with empty fields');

  const table = readFileSync(join('components', 'admin', 'ArticlesTable.tsx'), 'utf8');
  assert.match(
    table,
    /Are you sure you want to delete this article\?/,
    'the confirmation says exactly what the flow promises'
  );
  assert.match(table, /method: 'DELETE'/);
  assert.match(table, /router\.refresh\(\)/, 'the list re-reads the collection after a delete');

  const route = readFileSync(join('app', 'api', 'admin', 'publish', 'route.ts'), 'utf8');
  assert.match(route, /export async function DELETE/, 'the endpoint answers DELETE');
  assert.match(route, /searchParams\.get\('slug'\)/);
  assert.match(route, /\/\^\[a-z0-9]\+\(\?:-\[a-z0-9]\+\)\*\$\//, 'the slug is a slug before it becomes a path');
  assert.match(route, /deleteFile\(\{/, 'and deletes through the sha-aware contents client');
  assert.match(route, /previousSlug/, 'a renamed article removes its old file');
  assert.match(route, /fileExists\(/, 'an edit may reference images an earlier publish committed');

  const editor = readFileSync(join('components', 'admin', 'ArticleEditor.tsx'), 'utf8');
  assert.match(editor, /renderPreview/, 'the Preview tab is wired');
  assert.match(editor, /role="tab"/, 'and is a tab, not a hidden second editor');
});
