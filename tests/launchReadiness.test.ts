import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { compactTitle, DEFAULT_OG_IMAGE, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '../lib/seo/metadata';
import { TOOLS_REGISTRY } from '../lib/tools/registry';
import { CATEGORY_META } from '../lib/tools/categories';
import { GUIDE_ARTICLES } from '../content/guides/index';

/**
 * Pre-launch readiness guards: metadata that a search result or a social card
 * actually shows, the assets those tags point at, and the two UX fixes from the
 * same pass. Each of these was a real defect found by fetching the built HTML
 * of every route and reading the tags back.
 */

test('og:image - one 1200x630 static card exists and every route can inherit it', () => {
  const file = join('public', DEFAULT_OG_IMAGE.url.replace(/^\//, ''));
  assert.ok(existsSync(file), `default social card must exist at ${file}`);
  assert.equal(DEFAULT_OG_IMAGE.width, 1200);
  assert.equal(DEFAULT_OG_IMAGE.height, 630);
  assert.ok(DEFAULT_OG_IMAGE.alt.length > 20, 'the card needs alt text for assistive tech');

  // PNG magic number: a renamed SVG would render as a broken card on every
  // platform that fetches it.
  const head = statSync(file);
  assert.ok(head.size > 5_000, `the card should carry real artwork (${head.size} bytes)`);

  // A page that declares its own `openGraph` REPLACES the root layout's block,
  // so every route builds that block through the shared helper, which always
  // carries the card. The eleven route blocks that named their own
  // siteName/url and no image were the routes still previewing bare.
  const layout = require('node:fs').readFileSync('app/layout.tsx', 'utf8') as string;
  assert.match(layout, /images: \[DEFAULT_OG_IMAGE\]/);
  assert.match(layout, /images: \[DEFAULT_OG_IMAGE\.url\]/);
  assert.match(layout, /card: 'summary_large_image'/);

  const helper = require('node:fs').readFileSync('lib/seo/metadata.ts', 'utf8') as string;
  assert.match(helper, /images: options\.images \?\? \[DEFAULT_OG_IMAGE\]/);

  // Every route that declares its own Open Graph block goes through it.
  const routeFiles = [
    'app/page.tsx', 'app/tests/page.tsx', 'app/about/page.tsx', 'app/privacy/page.tsx',
    'app/terms/page.tsx', 'app/guides/page.tsx', 'app/contact/layout.tsx',
    'app/inspection/layout.tsx', 'app/test-history/layout.tsx',
    'app/advanced-diagnostics/page.tsx', 'app/test/[slug]/page.tsx', 'app/not-found.tsx',
  ];
  for (const file of routeFiles) {
    const source = require('node:fs').readFileSync(file, 'utf8') as string;
    assert.doesNotMatch(source, /siteName: 'DeviceTry'/, `${file} must not hand-roll its Open Graph block`);
    assert.ok(
      /siteOpenGraph\(\{/.test(source) || /images: \[DEFAULT_OG_IMAGE\]/.test(source),
      `${file} must emit an og:image`
    );
  }
});

test('og:image - the guides keep their own artwork and fall back to the site card', () => {
  const page = require('node:fs').readFileSync('app/guides/[slug]/page.tsx', 'utf8') as string;
  assert.match(page, /const cardImages = \[socialImage \?\? DEFAULT_OG_IMAGE\]/);
  assert.match(page, /images: cardImages/);
  assert.match(page, /card: 'summary_large_image'/);
  assert.match(page, /images: \[socialImage\?\.url \?\? DEFAULT_OG_IMAGE\.url\]/);
});

test('titles - every route title fits the ~60 characters a result shows', () => {
  const offenders: string[] = [];

  const check = (where: string, title: string) => {
    if (title.length > MAX_TITLE_LENGTH) offenders.push(`${where}: ${title.length} — ${title}`);
  };

  // Static route metadata, read the way the build reads it.
  const staticRoutes: Array<[string, string]> = [
    ['app/layout.tsx', (require('node:fs').readFileSync('app/layout.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/page.tsx', (require('node:fs').readFileSync('app/page.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/tests/page.tsx', (require('node:fs').readFileSync('app/tests/page.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/about/page.tsx', (require('node:fs').readFileSync('app/about/page.tsx', 'utf8') as string).match(/const title = '([^']+)'/)![1]],
    ['app/privacy/page.tsx', (require('node:fs').readFileSync('app/privacy/page.tsx', 'utf8') as string).match(/const title = '([^']+)'/)![1]],
    ['app/terms/page.tsx', (require('node:fs').readFileSync('app/terms/page.tsx', 'utf8') as string).match(/const title = '([^']+)'/)![1]],
    ['app/guides/page.tsx', (require('node:fs').readFileSync('app/guides/page.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/contact/layout.tsx', (require('node:fs').readFileSync('app/contact/layout.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/inspection/layout.tsx', (require('node:fs').readFileSync('app/inspection/layout.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/test-history/layout.tsx', (require('node:fs').readFileSync('app/test-history/layout.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
    ['app/advanced-diagnostics/page.tsx', (require('node:fs').readFileSync('app/advanced-diagnostics/page.tsx', 'utf8') as string).match(/title: '([^']+)'/)![1]],
  ];
  for (const [where, title] of staticRoutes) check(where, title);

  // Tool pages compose `${tool.title} — Free Online Tool | DeviceTry`.
  for (const tool of TOOLS_REGISTRY) {
    check(`tool ${tool.slug}`, `${tool.title} — Free Online Tool | DeviceTry`);
  }

  // Guide pages run their headline through compactTitle().
  for (const guide of GUIDE_ARTICLES.filter((g) => g.published !== false)) {
    check(`guide ${guide.slug}`, compactTitle(guide.title));
  }

  assert.deepEqual(offenders, [], `titles over ${MAX_TITLE_LENGTH} characters:\n${offenders.join('\n')}`);
});

test('descriptions - every route description fits 160 characters', () => {
  const offenders: string[] = [];
  const check = (where: string, text: string) => {
    if (text.length > MAX_DESCRIPTION_LENGTH) offenders.push(`${where}: ${text.length} — ${text}`);
  };

  const read = (file: string) => require('node:fs').readFileSync(file, 'utf8') as string;

  // The description literals each route file declares.
  const described = [
    'app/layout.tsx',
    'app/page.tsx',
    'app/tests/page.tsx',
    'app/about/page.tsx',
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/guides/page.tsx',
    'app/contact/layout.tsx',
    'app/inspection/layout.tsx',
    'app/test-history/layout.tsx',
    'app/advanced-diagnostics/page.tsx',
    'app/not-found.tsx',
  ];
  for (const file of described) {
    const source = read(file);
    // Both spellings exist in the codebase: `description:` in an object literal
    // and `const description =` inside generateMetadata().
    const matches = [
      ...[...source.matchAll(/description:\s*\n?\s*'([^']+)'/g)].map((m) => m[1]),
      ...[...source.matchAll(/const description\s*=\s*\n?\s*'([^']+)'/g)].map((m) => m[1]),
    ];
    assert.ok(matches.length > 0, `${file} must declare a description`);
    for (const text of matches) check(file, text);
  }

  for (const tool of TOOLS_REGISTRY) check(`tool ${tool.slug}`, tool.shortDesc);
  for (const guide of GUIDE_ARTICLES.filter((g) => g.published !== false)) check(`guide ${guide.slug}`, guide.description);

  assert.deepEqual(offenders, [], `descriptions over ${MAX_DESCRIPTION_LENGTH} characters:\n${offenders.join('\n')}`);
});

test('metadata - the homepage describes itself identically in meta and og tags', () => {
  const page = require('node:fs').readFileSync('app/page.tsx', 'utf8') as string;
  const descriptions = [...page.matchAll(/description:\s*\n?\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(descriptions.length, 2, 'the homepage declares a meta and an og description');
  assert.equal(
    descriptions[0],
    descriptions[1],
    'a search result and a social preview must not describe the same page differently'
  );

  const layout = require('node:fs').readFileSync('app/layout.tsx', 'utf8') as string;
  const layoutDescriptions = [...layout.matchAll(/description:\s*\n?\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(layoutDescriptions.length, 3, 'root layout declares meta, og and twitter descriptions');
  assert.equal(new Set(layoutDescriptions).size, 1, 'the three root descriptions must agree');
});

test('metadata - the 404 no longer claims to be the homepage', () => {
  const notFound = require('node:fs').readFileSync('app/not-found.tsx', 'utf8') as string;
  // Without its own Open Graph block it inherited the root's og:url and
  // og:description, so a shared dead link described itself as the homepage.
  assert.match(notFound, /openGraph: siteOpenGraph\(\{/);
  assert.match(notFound, /url: `\$\{SITE_URL\}\/404`/);
  assert.match(notFound, /robots: \{ index: false, follow: true \}/);
});

test('compactTitle - keeps every word when it can, prefers the brand suffix', () => {
  assert.equal(compactTitle('Guides'), 'Guides | DeviceTry');
  // No room for the suffix: the author's own words win over the brand.
  assert.equal(compactTitle('A Headline That Is Already Sixty Characters Long Or So'), 'A Headline That Is Already Sixty Characters Long Or So');
  // Room for neither: fall back to the clause before the colon/dash.
  assert.equal(compactTitle('Keyboard Keys Not Registering: Diagnose Dead Keys and Random Dropouts'), 'Keyboard Keys Not Registering | DeviceTry');
  // Never truncated mid-word, and never longer than the limit.
  for (const headline of GUIDE_ARTICLES.map((g) => g.title)) {
    const compact = compactTitle(headline);
    assert.ok(compact.length <= MAX_TITLE_LENGTH, `${compact.length} — ${compact}`);
    assert.ok(!/\s…/.test(compact), 'no trailing space before the ellipsis');
  }
});

test('homepage - every category filter pill shows a registry-derived count', () => {
  const landing = require('node:fs').readFileSync('components/LandingClient.tsx', 'utf8') as string;
  assert.match(
    landing,
    /const CATEGORY_COUNTS = new Map<string, number>\([\s\S]*CATEGORY_META\.map\(\(c\) => \[c\.key, TOOLS_REGISTRY\.filter/,
    'counts are derived from the registry, not typed in'
  );
  assert.match(landing, /<span className="ml-1\.5 opacity-70">\{CATEGORY_COUNTS\.get\(c\.key\)\}<\/span>/);

  // The numbers are the real ones, and the pills are unchanged otherwise: the
  // filtering, the search and the URL behaviour must not have moved.
  const counts = new Map(CATEGORY_META.map((c) => [c.key, TOOLS_REGISTRY.filter((t) => t.category === c.key).length]));
  assert.equal(counts.get('audio-video'), 5);
  assert.equal(counts.get('display'), 2);
  assert.equal(counts.get('network'), 2);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), TOOLS_REGISTRY.length, 'every tool is in exactly one pill');
  assert.match(landing, /applyFilter\(term, 'all'\)/, 'a quick-search chip still clears the category');
  assert.match(landing, /const applyFilter = useCallback\(/);
});

test('contact - copy always reports its outcome, including a clipboard failure', () => {
  const contact = require('node:fs').readFileSync('app/contact/page.tsx', 'utf8') as string;
  // The old handler set "Copied!" on success and said nothing on failure.
  assert.match(contact, /const \[copyState, setCopyState\] = useState<'idle' \| 'copied' \| 'failed'>/);
  assert.match(contact, /if \(!navigator\.clipboard\?\.writeText\) throw new Error\('Clipboard API unavailable'\)/);
  assert.match(contact, /\}\s*catch\s*\{\s*\n\s*finish\('failed'\);/, 'a rejected write reports the failure');

  // Visible text, not only an icon: both outcomes have a live-region line.
  assert.match(contact, /id="contact-copy-status"/);
  assert.match(contact, /role="status"/);
  assert.match(contact, /aria-live="polite"/);
  assert.match(contact, /Message copied to your clipboard/);
  assert.match(contact, /Your browser blocked the copy\. Select the text above, or use Download Message/);
  assert.match(contact, /aria-describedby="contact-copy-status"/);
  // The button itself names the outcome too.
  assert.match(contact, /'Copied!' : copyState === 'failed' \? 'Copy failed' : 'Copy Message'/);
  // Still no backend: nothing is submitted anywhere.
  assert.doesNotMatch(contact, /fetch\(|XMLHttpRequest|action=/);
});

test('brand mark - the rendered asset is a small derivative, not the 1536px source', () => {
  const source = statSync(join('public', 'brand', 'devicetry-logo.png')).size;
  for (const file of ['devicetry-mark.png', 'devicetry-mark-light.png']) {
    const size = statSync(join('public', 'brand', file)).size;
    assert.ok(size * 4 < source, `${file} (${size} B) must be far smaller than the ${source} B source`);
  }
  const logo = require('node:fs').readFileSync('components/ui/DeviceTryLogo.tsx', 'utf8') as string;
  // The largest call site renders the mark at size=30 x 0.82 ≈ 25 CSS px.
  assert.match(logo, /MARK_HEIGHT_RATIO = 0\.82/);
  assert.doesNotMatch(logo, /devicetry-logo\.png'/, 'the full-size source is no longer rendered');
});