import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUIDE_ARTICLES } from '../content/guides/index';
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '../lib/seo/metadata';

/**
 * Guards for `GuideArticle.rawBody` / `rawStyle` — the one place a guide is
 * rendered through `dangerouslySetInnerHTML`.
 *
 * Every other article field is a string the template turns into a React
 * element, so React escapes it. These two are not: the browser parses them as
 * markup. That is the whole reason they exist (an imported article keeps its
 * own `<details>` list, `<h3>`s, inline `<code>`, and citations to vendors
 * other than Microsoft), and it is also the reason they need a gate — an
 * article file is the one place where a stray paste could otherwise introduce
 * active content that no typed article could ever carry.
 */

const rawGuides = GUIDE_ARTICLES.filter((g) => g.rawBody || g.rawStyle);

/** Tags that either execute or embed a foreign document. */
const ACTIVE_CONTENT = [
  { name: 'a <script> element', re: /<\s*script/i },
  { name: 'an <iframe>', re: /<\s*iframe/i },
  { name: 'an <object>', re: /<\s*object/i },
  { name: 'an <embed>', re: /<\s*embed/i },
  { name: 'a <link> stylesheet', re: /<\s*link\b/i },
  { name: 'a <base> tag', re: /<\s*base\b/i },
  { name: 'a <meta> tag', re: /<\s*meta\b/i },
  { name: 'an inline event handler', re: /\bon[a-z]+\s*=/i },
  { name: 'a javascript: URL', re: /href\s*=\s*["']?\s*javascript:/i },
  { name: 'a data: URL', re: /href\s*=\s*["']\s*data:/i },
  { name: 'a <style> expression()', re: /expression\s*\(/i },
];

test('the raw-body escape hatch exists and is actually used', () => {
  // A guard nobody exercises proves nothing, so pin the field to the article
  // that opted into it rather than letting it rot unused.
  assert.ok(rawGuides.length > 0, 'no article uses rawBody/rawStyle');
  const webcam = GUIDE_ARTICLES.find((g) => g.slug === 'webcam-not-working')!;
  assert.ok(webcam.rawBody, 'the webcam guide ships its body as authored markup');
  assert.ok(webcam.rawStyle, 'and its own stylesheet');
  assert.deepEqual(webcam.sections, [], 'it declares no typed sections to duplicate them');
});

test('no rawBody or rawStyle carries active content', () => {
  for (const guide of rawGuides) {
    for (const [field, markup] of [
      ['rawBody', guide.rawBody ?? ''],
      ['rawStyle', guide.rawStyle ?? ''],
    ] as const) {
      for (const { name, re } of ACTIVE_CONTENT) {
        assert.doesNotMatch(markup, re, `${guide.slug} ${field} must not contain ${name}`);
      }
    }
  }
});

test('an article carrying rawBody declares it without typed sections', () => {
  // Otherwise the page prints the same material twice — the template renders
  // both, and nothing in the build would notice.
  for (const guide of rawGuides) {
    if (!guide.rawBody) continue;
    assert.equal(
      guide.sections.length,
      0,
      `${guide.slug} supplies rawBody, so typed sections would render the article twice`
    );
    assert.equal(guide.showToc, undefined, `${guide.slug} ships its own contents list`);
  }
});

test('a rawBody article keeps its own FAQ section, and mirrors it for the JSON-LD', () => {
  // The template stands its FAQ block down for a rawBody article, so the Q&As
  // the FAQPage graph describes have to exist inside the markup — and in
  // `faqs`, which is where the graph is generated from.
  for (const guide of rawGuides) {
    if (!guide.rawBody) continue;
    assert.match(guide.rawBody, /id="faq"/, `${guide.slug} must carry its own #faq section`);
    assert.ok(guide.faqs.length > 0, `${guide.slug} still needs faqs[] for the FAQPage graph`);
    for (const faq of guide.faqs) {
      assert.ok(
        guide.rawBody.includes(`<h3>${faq.q}</h3>`),
        `${guide.slug}: "${faq.q}" is in faqs[] but not on the page — the JSON-LD would describe a question a reader cannot find`
      );
    }
  }
});

test('every anchor an article links to resolves inside the same article or the site', () => {
  // An in-page `#anchor` that lands nowhere is invisible until a reader clicks
  // it, so it is checked here rather than left to the sitemap.
  for (const guide of rawGuides) {
    if (!guide.rawBody) continue;
    const ids = new Set([...guide.rawBody.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, hash] of guide.rawBody.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.has(hash), `${guide.slug}: #${hash} has no element to land on`);
    }
  }
});

test('links in a rawBody article are visibly links in both themes', () => {
  // An article that arrives as markup has no Prose hook, so its anchors are
  // plain <a> elements. Without this they inherit the browser default and read
  // as body text, and a reader cannot tell which words are links.
  const css = readFileSync('app/globals.css', 'utf8');
  // Comments are stripped first: this stylesheet documents its own decisions,
  // and a comment that mentions `prefers-color-scheme` or writes out
  // `a { color: inherit }` would otherwise be read as a rule. The brace
  // counting below needs the same treatment for the same reason.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /\.dt-guide a \{[^}]*color: #1fa95b/, 'the resting link colour is applied');
  assert.match(code, /\.dt-guide a \{[^}]*text-decoration: underline/, 'and it is underlined, not colour-only');
  assert.match(code, /\.dt-guide a:hover \{[^}]*text-decoration-thickness: 2px/, 'hover thickens it');
  assert.match(code, /\.dt-guide a:visited \{[^}]*color: #178a49/, 'a visited link is distinguishable');
  assert.match(code, /\.dark \.dt-guide a \{[^}]*color: #3ddc84/, 'the dark theme has its own colour');

  // lib/theme.tsx writes the reader's explicit choice onto <html> as a class,
  // so a prefers-color-scheme query would contradict a light-theme reader on a
  // dark-mode machine. The class is the site's own record of what is on screen.
  assert.doesNotMatch(
    code,
    /prefers-color-scheme[^}]*\.dt-guide a/,
    'the guide link colours must follow the .dark class, not the OS setting'
  );

  // Tailwind's preflight declares `a { color: inherit; text-decoration: inherit }`
  // inside @layer base. A cascade layer loses to any unlayered rule regardless
  // of specificity, so the rule only wins if it sits at the top level — inside
  // a layer it would lose to `.dt-guide a` being equal-or-lower specificity
  // versus nothing, and silently paint nothing at all.
  const ruleAt = code.indexOf('.dt-guide a {');
  assert.ok(ruleAt > 0, 'globals.css declares .dt-guide a');
  let depth = 0;
  for (const ch of code.slice(0, ruleAt)) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
  }
  assert.equal(depth, 0, '.dt-guide a must be a top-level (unlayered) rule');
});

test('an imported SEO pack is emitted verbatim and still fits the search windows', () => {
  // `seoTitle`/`seoDescription` exist so an article can keep the exact strings
  // its own head tags carried. They bypass the length-checking helpers, so the
  // limits have to be enforced here instead.
  for (const guide of GUIDE_ARTICLES) {
    if (guide.seoTitle) {
      assert.ok(
        guide.seoTitle.length <= MAX_TITLE_LENGTH,
        `${guide.slug}: seoTitle is ${guide.seoTitle.length} characters — over ${MAX_TITLE_LENGTH}`
      );
    }
    for (const [field, text] of [
      ['description', guide.description],
      ['seoDescription', guide.seoDescription],
    ] as const) {
      if (text === undefined) continue;
      assert.ok(
        text.length <= MAX_DESCRIPTION_LENGTH,
        `${guide.slug}: ${field} is ${text.length} characters — over ${MAX_DESCRIPTION_LENGTH}`
      );
    }
  }
});

test('the template renders a rawBody exactly once, and stands its FAQ block down', () => {
  const view = readFileSync('components/guides/GuideArticleView.tsx', 'utf8');
  assert.match(
    view,
    /\{guide\.rawBody && \(/,
    'the raw body renders from one guarded call site'
  );
  assert.match(
    view,
    /\{guide\.faqs\.length > 0 && !guide\.rawBody && \(/,
    'the template FAQ block stands down for an article that ships its own'
  );

  // The <style> is emitted once per page, next to the body it styles — not
  // inside the body, which would repeat it per section.
  assert.match(view, /<style dangerouslySetInnerHTML=\{\{ __html: guide\.rawStyle \}\} \/>/);
});