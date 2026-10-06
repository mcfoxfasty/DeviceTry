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
  githubErrorMessage,
  publishArticle,
  repository,
} from '../lib/admin/github';
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
import { getPost, listPosts } from '../lib/blog/content';
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
    '/images/posts/switch-abc12345.png',
    'A worn keyboard switch',
    'Figure 1. The switch'
  );
  assert.equal(
    inserted.value,
    "Some prose.\n\n![A worn keyboard switch](/images/posts/switch-abc12345.png 'Figure 1. The switch')\n"
  );

  const withoutCaption = imageMarkdown('/images/posts/x.png', 'Alt text here');
  assert.equal(withoutCaption, '![Alt text here](/images/posts/x.png)');
  assert.deepEqual(imageReferences(inserted.value), [
    { alt: 'A worn keyboard switch', url: '/images/posts/switch-abc12345.png' },
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
  coverImage: '/images/posts/cover-abc12345.png',
  coverImageAlt: 'The DeviceTry cover card with the wordmark',
  publishedAt: '2026-10-06',
  author: 'DeviceTry team',
  category: POST_CATEGORIES[0].value,
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
  const errors = validateDraft(draft({ content: 'Text.\n\n![](/images/posts/inline-abc.png)\n' }));
  assert.match(errors.content ?? '', /Alt text for \/images\/posts\/inline-abc\.png/);

  const ok = validateDraft(
    draft({ content: 'Text.\n\n![A worn switch, photographed closely](/images/posts/inline-abc.png)\n' })
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
  const content = '![A described image](/images/posts/inline-abc12345.png)\n\n![Another](/images/posts/missing-9.png)\n';

  const { provided, missing } = referencedUploads(content, uploads);
  assert.equal(provided.length, 1);
  assert.equal(provided[0].filename, 'inline-abc12345.png');
  assert.deepEqual(missing, ['/images/posts/missing-9.png']);

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
    'tags',
    'canonicalUrl',
  ]);
  assert.match(file, /\n---\n\nA paragraph of the article\.\n$/, 'the body sits below the front matter');
  assert.match(file, /\n  - keyboard\n  - troubleshooting\n/, 'tags are a block sequence');
  assert.match(file, /canonicalUrl: null/, 'an absent override is null, as in the published articles');

  const existing = readFileSync(
    join('content', 'posts', 'keyboard-keys-not-registering-hardware-or-software.md'),
    'utf8'
  );
  const existingKeys = existing
    .split('\n---\n')[0]
    .split('\n')
    .filter((line) => /^[a-zA-Z]+:/.test(line))
    .map((line) => line.split(':')[0]);
  assert.deepEqual(keys, existingKeys, 'the key order matches the published article exactly');
});

test('admin composition - what the dashboard writes, the blog reader reads back', async () => {
  // The round trip, on the real collection: write a draft the way the publish
  // endpoint does, read it with the same reader /blog uses, then remove it. A
  // composer that produced plausible YAML the schema could not parse would fail
  // here rather than on the live site.
  const slug = 'zz-admin-round-trip-check';
  const path = join('content', 'posts', `${slug}.md`);
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
    assert.equal(read.coverImage, '/images/posts/cover-abc12345.png');
    assert.equal(read.coverImageAlt, 'The DeviceTry cover card with the wordmark');
    assert.equal(read.publishedAt, '2026-11-02');
    assert.equal(read.author, 'DeviceTry team');
    assert.equal(read.category, POST_CATEGORIES[0].value);
    assert.deepEqual(read.tags, ['a tag', 'another']);
    assert.equal(read.canonicalUrl, null);
    assert.match(read.content, /## A subheading/);
    assert.match(read.content, /A closing line\./);

    const listed = (await listPosts()).find((post) => post.slug === slug);
    assert.ok(listed, 'the article also appears in the listing the index and sitemap use');
    assert.equal(listed.publishedAt, '2026-11-02');
  } finally {
    rmSync(path, { force: true });
  }
  assert.equal(existsSync(path), false, 'the round-trip file is not left behind');
});

// ------------------------------------------------------------ github publish

test('admin publish - paths and endpoints match the repository layout and the API', () => {
  assert.equal(repository(), 'mcfoxfasty/DeviceTry', 'the slug GitHub itself reports');
  assert.equal(postRepoPath('my-article'), 'content/posts/my-article.md');
  assert.equal(imageRepoPath('cover-abc12345.png'), 'public/images/posts/cover-abc12345.png');
  assert.equal(publicImagePath('cover-abc12345.png'), '/images/posts/cover-abc12345.png');
  assert.equal(PUBLISH_BRANCH, 'main');
  assert.equal(
    contentsUrl('content/posts/my article.md'),
    'https://api.github.com/repos/mcfoxfasty/DeviceTry/contents/content/posts/my%20article.md'
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
    draft: draft({ content: '![A described image](/images/posts/inline-def67890.png)' }),
    images,
    token: 'ghp_test_token',
    request: fake,
  });

  const puts = calls.filter((call) => call.method === 'PUT');
  assert.equal(puts.length, 3, 'two images, then the article');
  assert.match(puts[0].url, /public\/images\/posts\/cover-abc12345\.png$/);
  assert.match(puts[1].url, /public\/images\/posts\/inline-def67890\.png$/);
  assert.match(puts[2].url, /content\/posts\/keyboard-keys-not-registering\.md$/, 'the article lands last');
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
  for (const capability of ['H2', 'H3', 'H4', 'Bold', 'Italic', 'Strike', 'Code', 'Bullets', 'Numbered', 'Quote', 'Link', 'Table', 'Code block', 'Divider']) {
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
