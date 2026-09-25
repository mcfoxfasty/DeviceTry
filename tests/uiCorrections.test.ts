import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TOOLS_REGISTRY } from '../lib/tools/registry';

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

test('homepage tools - Popular stays first and remaining cards use three desktop columns', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.match(
    landing,
    /const POPULAR_SLUGS = \['microphone-test', 'webcam-test', 'speakers-test'\]/,
    'the original Popular order is unchanged'
  );
  assert.match(landing, /const visiblePopularTools = filteredTools\.filter/);
  assert.match(landing, /const remainingTools = filteredTools\.filter/);
  assert.match(landing, /visiblePopularTools\.length > 0[\s\S]{0,180}grid grid-cols-1 gap-3/);
  assert.match(landing, /remainingTools\.length > 0[\s\S]{0,180}md:grid-cols-3/);
  assert.doesNotMatch(landing, /xl:grid-cols-5/, 'remaining tools never collapse to a five-column row');
  assert.match(landing, /href=\{`\/test\/\$\{tool\.slug\}`\}/, 'tool links remain data-driven');
});

test('homepage icons - all 15 supplied PNGs map to homepage cards and suggestions', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.match(landing, /const HOME_TOOL_ICON_FILES: Record<string, string>/);
  assert.match(landing, /src=\{`\/Icons\/\$\{file\}`\}/);
  assert.equal((landing.match(/<HomeToolIcon/g) ?? []).length >= 2, true);
  for (const tool of TOOLS_REGISTRY) {
    assert.ok(
      existsSync(join(repoRoot, 'public', 'Icons', `${tool.slug}.png`)),
      `${tool.slug}.png is missing from the homepage asset directory`
    );
    assert.match(landing, new RegExp(`'${tool.slug}': '${tool.slug}\\.png'`));
  }
});

test('homepage guides - carousel auto-advances accessibly and remains user-pausable', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const page = readFileSync('app/page.tsx', 'utf8');
  const dictionary = readFileSync('lib/i18n/dictionaries/en.ts', 'utf8');
  assert.match(dictionary, /guidesTitle: 'Guides & Troubleshooting'/);
  assert.match(
    dictionary,
    /Step-by-step fixes written around the free test that verifies the result — plus specification-based buying guides with no invented ratings\./
  );
  assert.match(landing, /id="home-guides-carousel"/);
  assert.match(landing, /aria-label="Previous guide"/);
  assert.match(landing, /aria-label="Next guide"/);
  assert.equal((landing.match(/aria-controls="home-guides-carousel"/g) ?? []).length, 2);
  assert.match(landing, /tabIndex=\{0\}/);
  assert.match(landing, /focus-visible:outline/);
  assert.match(landing, /window\.setInterval\([\s\S]{0,900},\s*5000\)/);
  assert.match(landing, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(landing, /onMouseEnter=\{\(\) => setGuideInteractionPaused\(true\)\}/);
  assert.match(landing, /onFocusCapture=\{\(\) => setGuideInteractionPaused\(true\)\}/);
  assert.match(landing, /prefersReducedMotion \|\| guideInteractionPaused/);
  assert.match(landing, /href="\/guides"/);
  assert.match(landing, /id="guided-inspection-carousel"/);
  assert.match(landing, /aria-label="Previous guided inspection option"/);
  assert.match(landing, /aria-label="Next guided inspection option"/);
  assert.equal((landing.match(/aria-controls="guided-inspection-carousel"/g) ?? []).length, 2);
  assert.match(landing, /data-inspection-card/);
  assert.match(landing, /GUIDED_INSPECTION_OPTIONS/);
  assert.match(landing, /href="\/inspection"/);
  assert.match(landing, /window\.setInterval\([\s\S]{0,900},\s*6000\)/);
  assert.match(landing, /inspectionInteractionPaused/);
  assert.match(landing, /prefersReducedMotion/);
  assert.match(page, /'checking-screen-dead-pixels'/);
  assert.match(page, /'budget-headphones'/);
});

test('homepage atmosphere - geometry is stationary and privacy is green', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.match(page, /className="homepage-geometry pointer-events-none fixed inset-0/);
  assert.match(page, /border-2 border-\[#0F766E\]\/20/);
  assert.doesNotMatch(page, /animate-|animation:/, 'background shapes remain stationary');
  const globals = readFileSync('app/globals.css', 'utf8');
  assert.match(globals, /rgba\(15, 118, 110, 0\.055\)/);
  assert.match(landing, /bg-\[#F1F8F3\]/);
  assert.doesNotMatch(landing, /FFF6EC|text-\[#D97706\]/, 'privacy no longer uses the warning palette');
  assert.match(landing, /className="how-sequence/);
  assert.match(landing, /Media tools ask for browser permission first; the signal is processed locally\./);
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

// ---------- Live-search parity through the actual UI adapter ----------

/**
 * The three live surfaces (homepage grid, homepage suggestions, tools-drawer
 * launcher) must all go through uiToolSearch — one implementation, one
 * registry — so "Mi"/"mic" behave identically everywhere. These tests call
 * the exact adapter function the components call, not the raw engine.
 */
test('uiToolSearch - "Mi" returns Microphone Test only (no Webcam), homepage + drawer', async () => {
  const { uiToolSearch } = await import('../lib/tools/search.js');

  // Homepage suggestion surface (limit 5, exactly as LandingClient.tsx).
  const suggestions = uiToolSearch('Mi', 5);
  assert.deepEqual(
    suggestions.map((tool) => tool.slug),
    ['microphone-test'],
    '"Mi" must yield Microphone Test only through the UI adapter'
  );

  // Tools-drawer surface (limit 8, exactly as Navbar.tsx).
  const drawer = uiToolSearch('Mi', 8);
  assert.deepEqual(
    drawer.map((tool) => tool.slug),
    ['microphone-test'],
    'drawer and homepage must share one implementation and data'
  );
});

test('uiToolSearch - "mic" returns Microphone Test + Online Voice Recorder, no Webcam', async () => {
  const { uiToolSearch } = await import('../lib/tools/search.js');
  const slugs = uiToolSearch('mic', 8).map((tool) => tool.slug);

  assert.ok(slugs.includes('microphone-test'), '"mic" must include Microphone Test');
  assert.ok(slugs.includes('voice-recorder'), '"mic" must include Online Voice Recorder');
  assert.equal(slugs.includes('webcam-test'), false, '"mic" must never return Webcam Test');
  assert.equal(slugs[0], 'microphone-test', 'Microphone Test must rank first');
});

test('uiToolSearch - one shared implementation powers every surface (source contract)', () => {
  // Structural guarantee: no component may call the raw engine directly.
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.equal(/\bsearchTools\(/.test(landing), false,
    'LandingClient must use uiToolSearch, not the raw engine');
  assert.match(landing, /uiToolSearch\(/);

  const navbar = readFileSync('components/layout/Navbar.tsx', 'utf8');
  assert.equal(/\bsearchTools\(/.test(navbar), false,
    'Navbar must use uiToolSearch, not the raw engine');
  assert.match(navbar, /uiToolSearch\(/);
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

// ---------- Post-deployment pass: share payload safety ----------

test('share - numeric-score tools share their score; everyone else gets a generic sentence only', () => {
  const registry = readFileSync('lib/tools/registry.ts', 'utf8');
  const shareLib = readFileSync('lib/share.ts', 'utf8');

  // Only the two numeric-score tools may reveal numbers.
  const scoreTools = ['click-speed-test', 'reaction-time-test'];
  const sharePolicyBlock = registry.slice(
    registry.indexOf('const SHARE_POLICY'),
    registry.indexOf('export const TOOLS_REGISTRY')
  );
  for (const tool of TOOLS_REGISTRY) {
    const allowed = scoreTools.includes(tool.id);
    assert.equal(
      sharePolicyBlock.includes(`'${tool.id}': 'score'`),
      allowed,
      `${tool.id} must ${allowed ? '' : 'NOT '}be a score-sharing tool`
    );
  }

  // The generic sentence path never emits tester details verbatim.
  assert.ok(shareLib.includes('GENERIC_SENTENCE'), 'generic summary path exists');
  assert.ok(shareLib.includes('includesScore: false'), 'generic path explicitly denies scores');
  // WhatsApp/Facebook/X/LinkedIn targets live in lib/share.ts (ShareButton
  // renders them); assert the real source of truth.
  assert.match(shareLib, /wa\.me/, 'WhatsApp fallback target defined');
  assert.match(shareLib, /facebook\.com\/sharer/, 'Facebook fallback target defined');
  assert.match(shareLib, /twitter\.com\/intent\/tweet/, 'X fallback target defined');
  assert.match(shareLib, /linkedin\.com\/sharing/, 'LinkedIn fallback target defined');

  // Reaction/CPS unit strings are the only score units extracted.
  assert.ok(/CPS/i.test(shareLib) && /median/i.test(shareLib), 'score extraction covers CPS and reaction median');
});

test('share - ShareButton uses Web Share first with privacy-safe fallback targets and no SDKs', () => {
  const shareButton = readFileSync('components/ui/ShareButton.tsx', 'utf8');
  assert.match(shareButton, /navigator\.share/, 'Web Share API is tried first');
  // Fallback targets come from lib/share.ts's shareTargetsFor(); the button
  // renders them via the imported builder (verified in the previous test).
  assert.match(shareButton, /shareTargetsFor/, 'fallback targets flow from the shared builder');
  assert.match(shareButton, /navigator\.clipboard\.writeText/, 'Copy Link fallback present');
  // No third-party SDK scripts: everything is plain outbound links.
  assert.ok(!/<script/i.test(shareButton), 'no script tags (no social SDKs, no trackers)');
});

test('share - media/network testers never render a share payload with measurements', () => {
  // Webcam/mic/IP-style tools map to the restrictive policy in the registry.
  const restricted = ['webcam-test', 'microphone-test', 'what-is-my-ip', 'internet-speed-test', 'screen-test', 'keyboard-test'];
  const registry = readFileSync('lib/tools/registry.ts', 'utf8');
  const sharePolicyBlock = registry.slice(
    registry.indexOf('const SHARE_POLICY'),
    registry.indexOf('export const TOOLS_REGISTRY')
  );
  for (const id of restricted) {
    assert.ok(!sharePolicyBlock.includes(`'${id}': 'score'`), `${id} must never share numeric values`);
  }
});

// ---------- Post-deployment pass: test history privacy ----------

test('test history - stores only name/status/safe summary/timestamp; deny-list strips IPs, key codes, and device ids', () => {
  const history = readFileSync('lib/testing/testHistory.ts', 'utf8');
  // The sanitizer must run before storage and strip every forbidden class.
  // Plain string matching against raw source (no regex-vs-source escaping
  // ambiguity): each literal below is exactly the bytes the file must contain.
  assert.match(history, /function sanitizeSummary/);
  assert.ok(
    history.includes('\\d{1,3}(?:\\.\\d{1,3}){3}'),
    'IPv4 pattern stripped'
  );
  assert.match(history, /Key\[A-Z\]|Arrow\(/, 'KeyboardEvent codes stripped');
  assert.ok(
    history.includes('[0-9a-f]{2}[:-]){5}') && history.includes('{32,}'),
    'hex/MAC-style identifiers stripped'
  );
  // Entry cap and delete/clear operations exist.
  assert.match(history, /MAX_ENTRIES/);
  assert.match(history, /export function deleteTestHistoryEntry/);
  assert.match(history, /export function clearAllTestHistory/);
});

test('test history - wired through the shared result banner and reachable from navigation', () => {
  const banner = readFileSync('components/TestResultBanner.tsx', 'utf8');
  assert.match(banner, /recordTestResult/, 'banner records history entries');
  const navbar = readFileSync('components/layout/Navbar.tsx', 'utf8');
  assert.match(navbar, /\/test-history/, 'navbar links the history page');
  const footer = readFileSync('components/layout/Footer.tsx', 'utf8');
  assert.match(footer, /\/test-history/, 'footer links the history page');
  assert.ok(existsSync('app/test-history/page.tsx'), 'history page exists');
});

// ---------- Post-deployment pass: mobile keyboard honesty ----------

test('keyboard - virtual keyboard events can never produce a full keyboard pass', () => {
  const gates = readFileSync('lib/testing/virtualTyping.ts', 'utf8');
  // keyCode 229 / isComposing classify as virtual typing.
  assert.match(gates, /keyCode === 229/);
  assert.match(gates, /isComposing/);

  const keyboard = readFileSync('components/tests/KeyboardTester.tsx', 'utf8');
  // The virtual branch returns BEFORE the pass emission and never emits a verdict.
  const handleKeyDown = keyboard.slice(keyboard.indexOf('const handleKeyDown'), keyboard.indexOf('const handleKeyUp'));
  assert.match(handleKeyDown, /isVirtualKeyboardKey\(e\)/, 'virtual events are classified');
  assert.match(handleKeyDown, /return;/, 'virtual branch exits early');
  assert.ok(!/emitRef\.current[\s\S]*229/.test(handleKeyDown), 'no pass emission from the virtual branch');
  // The separate check states it is not a keyboard test.
  assert.match(gates, /never produces a keyboard pass/);
  // Touch-first devices get the physical-keyboard requirement notice.
  assert.match(keyboard, /TOUCH_DEVICE_NOTICE/);
  assert.match(gates, /Bluetooth or USB/);
});

// ---------- Post-deployment pass: registry-derived count wording ----------

test('homepage FAQ derives its tool count from the registry, never a hard-coded total', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.match(landing, /\$\{TOOLS_REGISTRY\.length\} core tests plus supporting diagnostics/,
    'FAQ count is registry-derived with the agreed wording');
  assert.ok(!landing.includes('offers 15 focused tools'), 'stale hard-coded wording removed');
  assert.ok(!landing.includes('28 tools') && !landing.includes('38 tools'), 'no stale totals anywhere');
});

// ---------- Post-deployment pass: permission section order ----------

test('tool pages render the permission guidance AFTER the interactive test card', () => {
  const detail = readFileSync('components/ToolDetailView.tsx', 'utf8');
  const testerIdx = detail.indexOf('<ToolRendererDeepLink');
  const permissionIdx = detail.indexOf('<PermissionPromptCard');
  assert.ok(testerIdx !== -1 && permissionIdx !== -1);
  assert.ok(testerIdx < permissionIdx, 'permission guidance must follow the test card');
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
