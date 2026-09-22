import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const navbarSource = readFileSync(join(repoRoot, 'components/layout/Navbar.tsx'), 'utf8');

/**
 * Phase 10 UI-correction regressions:
 *  - theme module contract (Light default, storage key, init snippet),
 *  - i18n keys required by the two mobile drawers and theme control,
 *  - distinct icon mapping across the 15 primary tools (drawer/launcher art),
 *  - search still ranks "mic" correctly for the drawer quick-search and the
 *    landing suggestions (the overlap-fix scenario).
 */

test('theme - Light is the default choice', async () => {
  const mod = await import('../lib/theme.js');
  // The provider's initial context value must be Light, not device-derived.
  assert.equal(mod.THEME_STORAGE_KEY, 'devicetry-theme');
});

test('theme - init snippet toggles the html class from stored choice only', async () => {
  const mod = await import('../lib/theme.js');
  const snippet = mod.THEME_INIT_SNIPPET;
  assert.ok(snippet.includes("localStorage.getItem('devicetry-theme')"), 'snippet must read the persisted key');
  assert.ok(snippet.includes("classList.toggle('dark'"), 'snippet must toggle the .dark class on <html>');
  // A stored 'light' must result in dark=false — i.e. the toggle compares to 'dark'.
  assert.ok(snippet.includes("s==='dark'"), 'snippet must apply dark only for the literal dark choice');
  // Must not read prefers-color-scheme: device preference never forces dark.
  assert.ok(!snippet.includes('prefers-color-scheme'), 'device dark preference must not force the theme');
});

test('i18n - nav keys for dual drawers and theme control exist', async () => {
  const { getDictionary } = await import('../lib/i18n/index.js');
  const en = getDictionary();
  const required: Array<keyof typeof en.nav> = [
    'openMenu',
    'openTools',
    'closeMenu',
    'toolsDrawerTitle',
    'toolsDrawerSearch',
    'toolsDrawerNoResults',
    'popularTools',
    'browseByCategory',
    'themeToggle',
    'themeLight',
    'themeDark',
  ];
  for (const key of required) {
    const value = en.nav[key];
    assert.ok(typeof value === 'string' && value.length > 0, `Missing nav.${key}`);
  }
  assert.notEqual(en.nav.openMenu, en.nav.openTools, 'The two drawer triggers must be described differently');
});

test('icons - all 15 primary tools map to distinct artwork', async () => {
  const { TOOLS_REGISTRY } = await import('../lib/tools/registry.js');
  const { toolSlugToIconName } = await import('../components/ui/ToolIcon.js');
  const icons = TOOLS_REGISTRY.map((tool) => toolSlugToIconName(tool.slug));
  assert.equal(new Set(icons).size, icons.length, `Icons must be distinct across 15 tools, got: ${icons.join(', ')}`);
});

test('search - "mic" ranks Microphone Test first (drawer + landing scenario)', async () => {
  const { searchTools } = await import('../lib/tools/search.js');
  const { TOOLS_REGISTRY } = await import('../lib/tools/registry.js');
  const hits = searchTools('mic', TOOLS_REGISTRY);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].tool.slug, 'microphone-test');
});

// ---------- Search relevance: short-query progressive refinement ----------

/** Same modules the app uses; module caching makes repeat imports cheap. */
async function slugsFor(query: string): Promise<string[]> {
  const { searchTools } = await import('../lib/tools/search.js');
  const { TOOLS_REGISTRY } = await import('../lib/tools/registry.js');
  return searchTools(query, TOOLS_REGISTRY).map((h) => h.tool.slug);
}

test('search - "mi" must not return Webcam Test (2-letter alias prefix leak)', async () => {
  const slugs = await slugsFor('mi');
  assert.equal(slugs.includes('webcam-test'), false, '"mi" leaked Webcam Test via the alias "mirror"');
  assert.equal(slugs[0], 'microphone-test', '"mi" must still lead with Microphone Test');
});

test('search - "mic" returns Microphone Test AND Online Voice Recorder', async () => {
  const slugs = await slugsFor('mic');
  assert.ok(slugs.includes('microphone-test'));
  assert.ok(slugs.includes('voice-recorder'), '"mic" must reach the recorder via its keyword "mic"');
});

test('search - 2-letter title prefixes still work ("we" -> Webcam Test)', async () => {
  // Progressive refinement must not break type-ahead on titles.
  const slugs = await slugsFor('we');
  assert.equal(slugs[0], 'webcam-test');
});

test('search - 3+ letter keyword/alias prefixes unchanged ("cam", "mir", "mirror")', async () => {
  const cam = await slugsFor('cam');
  assert.equal(cam[0], 'webcam-test');
  const camera = await slugsFor('camera');
  assert.equal(camera[0], 'webcam-test');
  const mir = await slugsFor('mir');
  assert.equal(mir[0], 'webcam-test');
  const mirror = await slugsFor('mirror');
  assert.equal(mirror[0], 'webcam-test');
});

test('search - single-letter queries return no results', async () => {
  const m = await slugsFor('m');
  assert.deepEqual(m, [], '1-letter query must not fan out across the registry');
});

// ---------- Drawer search input focus retention (source contract) ----------

test('navbar - closeDrawers is a stable useCallback so typing never re-runs focus logic', () => {
  assert.match(
    navbarSource,
    /const closeDrawers = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/,
    'closeDrawers must have an empty dependency array (stable identity across keystrokes)'
  );
});

test('navbar - drawer focus effect depends only on open, reads onClose via ref', () => {
  // The focus-management effect must run only on the closed -> open
  // transition; onClose must be read through a ref, never be a dependency.
  assert.match(navbarSource, /const onCloseRef = useRef\(onClose\);/);
  const effectMatch = navbarSource.match(/wasOpenRef\.current = true;([\s\S]*?)\n  \}, \[open\]\);/);
  assert.ok(effectMatch, 'focus-management effect must depend on [open] only');
  const effectBody = effectMatch![1];
  assert.ok(!/\bonClose\b/.test(effectBody.replace(/onCloseRef/g, '')), 'effect body must not reference onClose directly');
  assert.match(effectBody, /onCloseRef\.current\(\)/, 'Escape close must go through onCloseRef');
});

test('navbar - focus trap query cannot resurface after remounts (panel ref is stable)', () => {
  assert.match(navbarSource, /const panelRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(navbarSource, /ref=\{panelRef\}/);
});

// ---------- Drawer aria-hidden / inert correctness ----------

test('navbar - closed drawer is aria-hidden AND inert; open drawer is neither', () => {
  assert.match(
    navbarSource,
    /aria-hidden=\{!open \|\| undefined\}/,
    'wrapper must set aria-hidden only when closed (undefined when open)'
  );
  assert.match(navbarSource, /inert=\{!open\}/, 'panel must be inert while closed');
  // Guard against the regression where the OPEN dialog was hidden from AT.
  assert.equal(/aria-hidden=\{true\}/.test(navbarSource.replace(/aria-hidden="true"/g, '')), false,
    'no element may be unconditionally aria-hidden=true (backdrop only)');
});

// ---------- Desktop theme control ----------

test('navbar - compact desktop Light/Dark control shares the theme system', () => {
  assert.match(navbarSource, /variant="desktop"/, 'desktop header must render the compact ThemeControl variant');
  assert.match(
    navbarSource,
    /hidden md:flex[\s\S]{0,200}<ThemeControl t=\{t\} variant="desktop" \/>/,
    'desktop control must be hidden on mobile (drawer control covers mobile)'
  );
  // Accessible: icon-only buttons expose their label to AT via sr-only text.
  assert.match(navbarSource, /role="radiogroup"/);
  assert.match(navbarSource, /aria-checked=\{active\}/);
  assert.match(navbarSource, /\{compact && <span className="sr-only">\{label\}<\/span>\}/);
});
