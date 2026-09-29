/**
 * /advanced-diagnostics — the standalone home for the six supporting tools.
 *
 * These pins protect three decisions that are easy to undo by accident:
 *  1. the page renders SUPPORTING_REGISTRY itself (so a tool can never appear
 *     there with drifted copy, or be dropped), and pulls its count from the
 *     registry rather than a hardcoded number,
 *  2. the supporting tools stay OUT of the primary catalog listing and its
 *     count, while remaining routable,
 *  3. the WebRTC copy never implies a leak test — the registry already says so,
 *     and the page's own scope paragraph has to keep saying it too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ALL_TOOL_PAGES, SUPPORTING_REGISTRY, TOOLS_REGISTRY } from '../lib/tools/registry';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const page = read('app/advanced-diagnostics/page.tsx');
const nav = read('components/layout/Navbar.tsx');
const footer = read('components/layout/Footer.tsx');

test('advanced diagnostics - every supporting tool gets a card linking to its own route', () => {
  assert.match(page, /SUPPORTING_REGISTRY\.map\(/, 'the cards must come from the registry');
  assert.match(
    page,
    /href=\{`\/test\/\$\{tool\.slug\}`\}/,
    'each card must link to that tool’s existing route'
  );
  assert.match(page, /\{tool\.title\}/, 'the card title is the registry title');
  assert.match(page, /\{tool\.shortDesc\}/, 'the description is the registry description');
  assert.match(
    page,
    /\{tool\.limitations\[0\]\}/,
    'the scope note is the tool’s own first registered limitation'
  );
  assert.match(
    page,
    /SUPPORTING_REGISTRY\.length/,
    'the count shown on the page comes from the registry, not a hardcoded number'
  );
  assert.equal(SUPPORTING_REGISTRY.length, 6, 'the page documents six supporting diagnostics');
});

test('advanced diagnostics - supporting tools stay outside the catalog listing and its count', () => {
  const listing = read('app/tests/page.tsx');
  assert.match(listing, /TOOLS_REGISTRY/, 'the catalog lists the primary registry');
  assert.doesNotMatch(
    listing,
    /SUPPORTING_REGISTRY/,
    'supporting diagnostics must never become catalog cards'
  );
  // The page uses the primary registry only for its size, never as a listing.
  assert.doesNotMatch(page, /TOOLS_REGISTRY\.map/, 'the page must not re-list the catalog');
  assert.match(page, /TOOLS_REGISTRY\.length/, 'it may quote the catalog count');
  // Every route the page links to is genuinely routable.
  assert.equal(ALL_TOOL_PAGES.length, TOOLS_REGISTRY.length + SUPPORTING_REGISTRY.length);
  for (const tool of SUPPORTING_REGISTRY) {
    assert.ok(
      ALL_TOOL_PAGES.some((entry) => entry.slug === tool.slug),
      `/test/${tool.slug} must stay routable`
    );
  }
});

test('advanced diagnostics - the WebRTC copy never reads as a leak test', () => {
  const webrtc = SUPPORTING_REGISTRY.find((tool) => tool.slug === 'webrtc-test');
  assert.ok(webrtc, 'the WebRTC capability check is one of the six');
  // What the card shows: the local-capability wording and the explicit denial.
  assert.match(webrtc.shortDesc, /no leak testing/i);
  assert.match(webrtc.limitations.join(' '), /not a leak test/i);
  assert.match(webrtc.limitations.join(' '), /does not evaluate VPN or DNS behavior/i);
  // …and the page's own scope paragraph says what the check actually does.
  assert.match(page, /not a leak test/i);
  assert.match(page, /no external STUN or\s*TURN server/i);
  assert.match(page, /does not test for IP leaks/i);
  assert.doesNotMatch(page, /detects? (an )?IP leak|leak detection|leak check/i);
});

test('advanced diagnostics - linked from the side menu beneath Tests and from the footer', () => {
  const toolsRow = nav.indexOf("{ href: '/tests', labelKey: 'tools', icon: LayoutGrid }");
  const diagnosticsRow = nav.indexOf("{ href: '/advanced-diagnostics'");
  const guidesRow = nav.indexOf("{ href: '/guides', labelKey: 'guides'");
  assert.ok(toolsRow !== -1 && guidesRow !== -1, 'the drawer rows exist');
  assert.ok(diagnosticsRow > toolsRow, 'the side-menu link sits beneath Tests');
  assert.ok(diagnosticsRow < guidesRow, 'and before Guides');
  assert.match(nav, /labelKey: 'advancedDiagnostics'/, 'the drawer row is translated, not hardcoded');
  assert.match(footer, /href="\/advanced-diagnostics"/, 'the footer tools section links to it');
  assert.match(footer, /t\.nav\.advancedDiagnostics/, 'both links use the same label');
});

test('advanced diagnostics - the standalone page is in the sitemap', () => {
  assert.match(read('lib/site.ts'), /path: '\/advanced-diagnostics'/, 'STATIC_PAGES drives the sitemap');
});
