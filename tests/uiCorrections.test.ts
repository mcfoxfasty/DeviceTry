import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TOOLS_REGISTRY } from '../lib/tools/registry';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const navbarSource = readFileSync(join(repoRoot, 'components/layout/Navbar.tsx'), 'utf8');

/** Reads the pixel dimensions straight out of a WebP header (no image deps). */
function readJpegLikeSize(file: string): [number, number] {
  const buf = readFileSync(file);
  assert.equal(buf.slice(8, 12).toString('ascii'), 'WEBP', 'card artwork must be WebP');
  // Simple lossy VP8 / extended VP8X / lossless VP8L layouts all put the canvas
  // size in the first 10 bytes after the 'VP8 ' chunk header.
  const chunk = buf.slice(12, 16).toString('ascii');
  if (chunk === 'VP8 ') {
    return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  if (chunk === 'VP8X') {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return [w, h];
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  throw new Error(`unsupported WebP chunk: ${chunk}`);
}

/**
 * Phase 10 UI-correction regressions:
 *  - theme module contract (Dark default, storage key, init snippet),
 *  - i18n keys required by the two mobile drawers and theme control,
 *  - distinct icon mapping across the 15 primary tools (drawer/launcher art),
 *  - search still ranks "mic" correctly for the drawer quick-search and the
 *    landing suggestions (the overlap-fix scenario).
 */

test('theme - Dark is the default choice', async () => {
  const mod = await import('../lib/theme.js');
  // The provider's initial context value must be Dark, not device-derived.
  assert.equal(mod.THEME_STORAGE_KEY, 'devicetry-theme');
  assert.equal(mod.DEFAULT_THEME, 'dark', 'DEFAULT_THEME must be dark');
});

test('theme - init snippet defaults to dark and only a stored light opts out', async () => {
  const mod = await import('../lib/theme.js');
  const snippet = mod.THEME_INIT_SNIPPET;
  assert.ok(snippet.includes("localStorage.getItem('devicetry-theme')"), 'snippet must read the persisted key');
  assert.ok(snippet.includes("classList.toggle('dark'"), 'snippet must toggle the .dark class on <html>');
  // Dark is the fallthrough: anything that is not the literal 'light' is dark,
  // so a first visit with no stored value renders dark rather than light.
  assert.ok(
    snippet.includes("s!=='light'"),
    'snippet must treat anything other than a stored light as dark',
  );
  // With storage blocked the default still has to apply, not silently go light.
  assert.ok(
    /catch\(e\)\{[^}]*classList\.add\('dark'\)/.test(snippet),
    'snippet must apply dark in the catch branch when storage is unavailable',
  );
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
    'themeSwitch',
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

test('brand - the logo renders the supplied Logo.png file and Try shares its green', () => {
  const logo = readFileSync('components/ui/DeviceTryLogo.tsx', 'utf8');

  // The wordmark accent is the exact green sampled from the supplied artwork.
  assert.match(logo, /export const DEVICE_TRY_GREEN = '#7ED957'/);
  assert.match(logo, /<span style=\{\{ color: DEVICE_TRY_GREEN \}\}>Try<\/span>/);
  assert.doesNotMatch(logo, /text-\[#0F766E\] dark:text-\[#14B8A6\]">Try/);

  // The mark is the supplied artwork, not a redrawn SVG. It is served from a
  // downscaled derivative of that artwork (the component renders it at ~25 CSS
  // px, so shipping the 1536x1010 source cost 56 KB per ink variant to fill a
  // 38 px slot), never from an SVG.
  assert.match(logo, /import Image from 'next\/image'/);
  assert.match(logo, /const DEVICE_TRY_LOGO_SRC = '\/brand\/devicetry-mark\.png'/);
  assert.match(logo, /const DEVICE_TRY_LOGO_SRC_LIGHT = '\/brand\/devicetry-mark-light\.png'/);
  assert.match(logo, /src=\{DEVICE_TRY_LOGO_SRC\}/);
  assert.match(logo, /alt=""/);
  assert.match(logo, /aria-hidden="true"/);
  assert.doesNotMatch(logo, /<svg/);

  // Untouched source file plus the generated brand/app/favicon assets.
  assert.ok(existsSync(join(repoRoot, 'public', 'Logo.png')), 'the supplied source logo must stay in the repo');
  assert.ok(existsSync(join(repoRoot, 'public', 'brand', 'devicetry-logo.png')), 'the full-size generated brand logo must exist');
  // The rendered mark must be a real, small derivative of the same artwork:
  // it exists, it is a PNG (not an SVG renamed), and it is dramatically
  // smaller than the source it was scaled from.
  for (const file of ['devicetry-mark.png', 'devicetry-mark-light.png']) {
    const rendered = join(repoRoot, 'public', 'brand', file);
    assert.ok(existsSync(rendered), `${file} must exist`);
    assert.ok(
      statSync(rendered).size < statSync(join(repoRoot, 'public', 'brand', 'devicetry-logo.png')).size / 4,
      `${file} must be a downscaled derivative, not a copy of the full-size mark`
    );
  }
  assert.ok(existsSync(join(repoRoot, 'app', 'icon.png')), 'app icon must exist');
  assert.equal(existsSync(join(repoRoot, 'app', 'icon.svg')), false, 'the old vector icon is replaced by the supplied artwork');
  assert.ok(existsSync(join(repoRoot, 'public', 'favicon.ico')), 'favicon must exist');
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

test('homepage icons - all 15 supplied PNGs share one mapping across cards and suggestions', async () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const { TOOL_ICON_FILES, toolIconSrc } = await import('../lib/tools/iconAssets.js');
  assert.match(landing, /toolIconSrc/);
  assert.equal((landing.match(/<HomeToolIcon/g) ?? []).length >= 2, true);
  for (const tool of TOOLS_REGISTRY) {
    assert.equal(TOOL_ICON_FILES[tool.slug], `${tool.slug}.png`);
    assert.equal(toolIconSrc(tool.slug), `/Icons/${tool.slug}.png`);
    assert.ok(
      existsSync(join(repoRoot, 'public', 'Icons', `${tool.slug}.png`)),
      `${tool.slug}.png is missing from the shared icon asset directory`
    );
  }
});

test('tool pages, Tests hub, and sidebar use the shared supplied PNG mapping for every primary tool', () => {
  const detail = readFileSync('components/ToolDetailView.tsx', 'utf8');
  const testsHub = readFileSync('app/tests/page.tsx', 'utf8');
  const navbar = navbarSource;
  const sharedIcon = readFileSync('components/ui/ToolAssetIcon.tsx', 'utf8');
  assert.match(detail, /<ToolAssetIcon slug=\{tool\.slug\}/);
  assert.match(testsHub, /<ToolAssetIcon slug=\{tool\.slug\} size=\{40\} className="h-10 w-10"/);
  assert.match(testsHub, /flex h-10 w-10 shrink-0 items-center justify-center/);
  assert.doesNotMatch(testsHub, /<ToolIcon|toolSlugToIconName/);
  assert.match(navbar, /<ToolAssetIcon slug=\{tool\.slug\}/);
  assert.match(sharedIcon, /toolIconSrc\(slug\)/);
  assert.match(sharedIcon, /if \(!src\)/);
  assert.match(sharedIcon, /<Image/);
});

test('scroll behavior - new routes reset to top, anchors and history remain browser-owned', () => {
  const scroll = readFileSync('components/layout/BackToTop.tsx', 'utf8');
  const layout = readFileSync('app/layout.tsx', 'utf8');
  assert.match(layout, /<BackToTop \/>/);
  assert.match(scroll, /window\.addEventListener\('popstate'/);
  assert.match(scroll, /!window\.location\.hash/);
  assert.match(scroll, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.match(scroll, /prefers-reduced-motion: reduce/);
});

test('back to top - visible, labelled, keyboard-visible, and motion-aware', () => {
  const scroll = readFileSync('components/layout/BackToTop.tsx', 'utf8');
  assert.match(scroll, /aria-label="Back to top"/);
  assert.match(scroll, /focus-visible:ring-4/);
  assert.match(scroll, /visible \? 'translate-y-0 opacity-100'/);
  assert.match(scroll, /behavior: reducedMotion \? 'auto' : 'smooth'/);
  assert.match(scroll, /tabIndex=\{visible \? 0 : -1\}/);
});

test('footer - refreshed green palette keeps light and dark readable', () => {
  const footer = readFileSync('components/layout/Footer.tsx', 'utf8');
  assert.match(footer, /bg-\[#0B2B2A\] dark:bg-\[#071C1B\]/);
  assert.match(footer, /text-\[#C9EEE4\] hover:text-\[#5EEAD4\]/);
  assert.match(footer, /text-\[#F0FFFA\]/);
  assert.match(footer, /\/test\/microphone-test/);
  assert.match(footer, /\/guides\/microphone-not-working/);
});

test('tool cards - the 10px requirement note keeps a 4.5:1 contrast in both themes', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const note = landing.match(/<p className="mt-2\.5 text-\[10px\][^"]*">/);
  assert.ok(note, 'the tool-card note is still a 10px line');
  const light = note[0].match(/text-\[#([0-9A-Fa-f]{6})\]/);
  const dark = note[0].match(/dark:text-\[#([0-9A-Fa-f]{6})\]/);
  assert.ok(light && dark, 'the note declares a colour for each theme');

  // WCAG relative luminance, so a future palette tweak cannot silently regress.
  const luminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(clean.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // The card surface is translucent, so each colour is checked against both the
  // card and the lighter/darker page it sits on.
  const lightRatios = [contrast(light[1], '#FFFFFF'), contrast(light[1], '#F7F6FB')];
  const darkRatios = [contrast(dark[1], '#131B27'), contrast(dark[1], '#0B111A')];
  for (const [theme, ratios] of [['light', lightRatios], ['dark', darkRatios]] as const) {
    for (const ratio of ratios) {
      assert.ok(ratio >= 4.5, `${theme} note contrast ${ratio.toFixed(2)}:1 must be at least 4.5:1`);
    }
  }
  // Still visibly lighter than the card description it sits under.
  assert.ok(luminance(light[1]) > luminance('5F6B7A'), 'light note stays lighter than the card description');
  assert.ok(luminance(dark[1]) < luminance('9AA6B8'), 'dark note stays dimmer than the card description');
});

test('footer - section headings use the next sequential level, not h4', () => {
  const footer = readFileSync('components/layout/Footer.tsx', 'utf8');
  // The last heading inside <main> is an h2, and the footer sits beside the main
  // sections, so h4 skipped a level.
  assert.doesNotMatch(footer, /<h4[\s>]/, 'footer no longer uses h4');
  const h3 = [...footer.matchAll(/<h3 className="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(h3.length, 3, 'all three footer section headings are present');
  for (const cls of h3) {
    // Tailwind preflight zeroes heading margins, so the classes fully define
    // the look: the swap must not change the rendered styles.
    assert.match(cls, /text-xs font-bold uppercase tracking-\[0\.12em\] text-\[#F0FFFA\]/);
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

test('homepage inspection cards - the supplied artwork IS the card', async () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');

  // One image per preset, in the existing order, all served from public/.
  const images = [...landing.matchAll(/image: '(\/inspection\/[^']+)'/g)].map((m) => m[1]);
  assert.equal(images.length, 4, 'every guided-inspection option has one supplied image');
  for (const src of images) {
    assert.ok(src.endsWith('.webp'), 'card artwork is served as WebP');
    const file = join(repoRoot, 'public', decodeURIComponent(src));
    assert.ok(existsSync(file), `supplied card artwork must exist: ${src}`);
    assert.ok(statSync(file).size < 400 * 1024, `card artwork must stay small: ${src}`);
  }

  // Every image carries descriptive alt text, not an empty one.
  const alts = [...landing.matchAll(/alt: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(alts.length, 4);
  for (const alt of alts) {
    assert.ok(alt.includes('card') && alt.length > 60, `alt text must describe the card: "${alt}"`);
  }

  // The artwork is the card as supplied, and the declared dimensions match the
  // real file exactly — no size mismatch, so the four cards render at the same
  // size in the shared box.
  const declared = [...landing.matchAll(/imageWidth: (\d+),\s+imageHeight: (\d+)/g)].map(
    (m) => [Number(m[1]), Number(m[2])]
  );
  assert.equal(declared.length, 4);
  const actualSizes: Array<[number, number]> = [];
  for (const [i, [w, h]] of declared.entries()) {
    const src = images[i];
    const file = join(repoRoot, 'public', decodeURIComponent(src));
    const actual = readJpegLikeSize(file);
    assert.deepEqual([w, h], actual, `declared size must match the file: ${src}`);
    // Supplied cards are all exactly 2560x1440, so every card fills the shared
    // 16:9 box identically and none reads as smaller than its neighbours.
    assert.equal(Math.abs(w / h - 16 / 9) < 1e-9, true, `card artwork must be 16:9: ${src}`);
    actualSizes.push(actual);
  }
  for (const [w, h] of actualSizes) {
    assert.deepEqual([w, h], actualSizes[0], 'all four cards share one identical size');
  }

  // Each card is SERVED from a re-encode beside the master, so a phone fetches
  // a few hundred pixels instead of 2560: the four masters alone are ~650 KB,
  // which was two thirds of the whole mobile page for four images that are not
  // even in the first viewport.
  for (const src of images) {
    const master = join(repoRoot, 'public', decodeURIComponent(src));
    for (const width of [585, 1170]) {
      const variant = join(repoRoot, 'public', decodeURIComponent(src).replace(/\.webp$/, `-${width}.webp`));
      assert.ok(existsSync(variant), `card artwork ships a ${width}w re-encode: ${src}`);
      assert.ok(
        statSync(variant).size < statSync(master).size / 2,
        `the ${width}w re-encode is materially smaller than the 2560w master: ${src}`
      );
    }
  }

  // A `sizes` prop only yields candidates if something can honour it, and here
  // that something is a loader: with `unoptimized` (what this used to pass)
  // Next emits no srcset at all, so the single 2560w file was downloaded whole
  // whatever the viewport was — on a phone as readily as on a desktop.
  const cardImageTag = landing.slice(
    landing.indexOf('src={option.image}'),
    landing.indexOf('/>', landing.indexOf('src={option.image}'))
  );
  assert.match(cardImageTag, /loader=\{cardImageLoader\}/, 'the card image is loaded through the responsive loader');
  assert.doesNotMatch(cardImageTag, /unoptimized/, 'and it does not opt out of responsive candidates');
  assert.match(landing, /const CARD_IMAGE_WIDTHS = \[585, 1170\] as const/);
  assert.match(landing, /sizes="\(min-width: 1024px\) 32vw, \(min-width: 640px\) 48vw, 88vw"/);

  // The first card answers for the section: eager, fetchpriority high, and
  // preloaded with the same srcset and sizes, so the preload is the file the
  // <img> would have chosen rather than a second download. The other three
  // stay lazy — they sit further along the carousel and further down the page.
  assert.match(landing, /priority=\{index === 0\}/, 'only the first card is prioritised');

  // The card is the artwork: contained (never cropped or stretched) inside one
  // shared 16:9 box so every card in the row lines up on the same line.
  assert.match(landing, /<Image\s+src=\{option\.image\}/);
  assert.match(landing, /className="h-full w-full object-contain"/);
  assert.match(landing, /aspect-\[16\/9\]/, 'cards share one box so the row aligns');
  // ONE outer shape for all four. Every file fills the frame edge to edge, so
  // whatever sits outside a card's own rounded corner (black on Pre-Call,
  // white on the rest) is still in the pixels; `rounded-xl` only clips once
  // the box also hides its overflow. Without `overflow-hidden` the radius is
  // inert and each card shows its own square corners.
  assert.match(
    landing,
    /rounded-xl overflow-hidden[^"]*"[\s\S]{0,1200}<Image/,
    'the card box must round AND clip, so all four share one outer edge',
  );
  assert.doesNotMatch(
    landing,
    /rounded-xl focus-visible:outline/,
    'a radius without overflow-hidden leaves the square corners visible',
  );
  // Scope to the card markup ITSELF (the map up to its closing '))}'). Slicing
  // to end-of-file would swallow whatever homepage sections follow the carousel
  // and flag their unrelated padding/border classes as card styling.
  const cardStart = landing.indexOf('GUIDED_INSPECTION_OPTIONS.map');
  assert.ok(cardStart > -1, 'the card carousel renders GUIDED_INSPECTION_OPTIONS');
  const card = landing.slice(cardStart, landing.indexOf('))}', cardStart) + 3);
  assert.doesNotMatch(card, /border-\[#DED4F0\]/, 'no border drawn around the image card');
  assert.doesNotMatch(card, /\bp-5\b/, 'no padding wrapper around the image card');
  // Past the React key, nothing renders the title or description as text.
  const key = 'key={option.title}';
  const cardBody = card.slice(card.indexOf(key) + key.length);
  assert.doesNotMatch(cardBody, /\{option\.title\}|\{option\.description\}/, 'card text is not rebuilt in HTML');

  // Each card opens ITS OWN inspection, already running on its first step.
  const suites = [...landing.matchAll(/suite: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(suites, ['pre_call', 'used_hardware', 'classroom', 'full']);
  assert.match(card, /data-inspection-card/);
  assert.match(card, /href=\{`\/inspection\?suite=\$\{option\.suite\}`\}/);

  // The inspection page honours that deep link: right preset, right first step.
  const flow = readFileSync('components/inspection/GuidedInspectionFlow.tsx', 'utf8');
  assert.match(flow, /URLSearchParams\(window\.location\.search\)\.get\('suite'\)/);
  assert.match(flow, /if \(!requested \|\| !PRESET_SUITES\[requested\]\) return;/);
  assert.match(flow, /setSelectedSuiteKey\(requested\);[\s\S]{0,80}setActiveStepIndex\(0\);/);

  // Landing on step 1 must NOT acquire a device: the guided flow itself never
  // calls getUserMedia, and in the media testers the only call site sits in the
  // Start handler, never in an effect body. So a card click reaches step 1 with
  // the permission prompt still unopened, waiting for the user to press Start.
  assert.doesNotMatch(flow, /getUserMedia/, 'the guided flow never requests a device permission');
  for (const tester of ['MicrophoneTester', 'WebcamTester']) {
    const src = readFileSync(`components/tests/${tester}.tsx`, 'utf8');
    const calls = [...src.matchAll(/getUserMedia\(/g)].map((m) => m.index!);
    assert.equal(calls.length, 1, `${tester} has a single getUserMedia call site`);
    // Everything from the preceding function boundary to the call must not be
    // an effect body: the call lives in the Start handler.
    const before = src.slice(0, calls[0]);
    const lastEffectEnd = before.lastIndexOf('}, [');
    const lastHandler = before.lastIndexOf('async (');
    assert.ok(lastHandler > lastEffectEnd, `${tester} only calls getUserMedia from a Start handler, not an effect`);
  }
});

test('homepage atmosphere - geometry is stationary and privacy is green', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  assert.match(page, /className="homepage-geometry pointer-events-none fixed inset-0/);
  assert.match(page, /border-2 border-\[#15803D\]/);
  assert.doesNotMatch(page, /animate-|animation:/, 'background shapes remain stationary');
  const globals = readFileSync('app/globals.css', 'utf8');
  assert.match(globals, /rgba\(21, 128, 61, 0\.06\)/);
  assert.match(landing, /bg-\[#F1F8F3\]/);
  assert.doesNotMatch(landing, /FFF6EC|text-\[#D97706\]/, 'privacy no longer uses the warning palette');
  assert.match(landing, /className="how-sequence/);
  assert.match(landing, /Media tools ask for browser permission first; the signal is processed locally\./);
});

test('homepage background - outlines and grid use the tool-icon green', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const globals = readFileSync('app/globals.css', 'utf8');
  const toolIcon = readFileSync('components/ui/ToolIcon.tsx', 'utf8');

  // The green the tool icons actually use, so the background cannot drift away.
  assert.match(toolIcon, /text-\[#15803D\] dark:text-\[#4ADE80\]/);
  const lightGreen = '#15803D';
  const darkGreen = '#4ADE80';

  // Every decorative outline is that green in both modes — no teal, violet or amber left.
  const outlines = [...page.matchAll(/rounded-(?:full|\[[^\]]+\])[^"]*border-2[^"]*/g)].map((m) => m[0]);
  assert.equal(outlines.length, 4, 'all four decorative outlines are covered');
  for (const outline of outlines) {
    assert.ok(outline.includes(lightGreen), `outline uses the light tool green: ${outline}`);
    assert.ok(outline.includes(`dark:border-[${darkGreen}]`), `outline uses the dark tool green: ${outline}`);
  }
  assert.doesNotMatch(page, /#0F766E|#2DD4BF|#7C3AED|#A78BFA|#D97706|#FBBF24/, 'no old background hues remain');

  // Grid: same greens, gentle in light mode, calm neon bloom in dark mode.
  const lightGrid = globals.slice(globals.indexOf('.homepage-geometry {'), globals.indexOf('.dark .homepage-geometry {'));
  const darkGrid = globals.slice(globals.indexOf('.dark .homepage-geometry {'), globals.indexOf('.how-step::after'));
  assert.match(lightGrid, /linear-gradient\(to right, rgba\(21, 128, 61, 0\.09\)/);
  assert.match(lightGrid, /linear-gradient\(to bottom, rgba\(21, 128, 61, 0\.09\)/);
  assert.doesNotMatch(lightGrid, /rgba\(15, 118, 110/, 'light grid is no longer teal');
  assert.doesNotMatch(lightGrid, /at 0% 0%/, 'the corner glow is a dark-mode-only treatment');
  assert.match(darkGrid, /rgba\(74, 222, 128, 0\.09\)/);
  // Dark-mode corner ambience, matched to the approved reference look: present
  // but soft, and contained so it never becomes a bright patch behind the text.
  const cornerGlow = darkGrid.match(/radial-gradient\((\d+)% (\d+)% at 0% 0%, rgba\(74, 222, 128, ([\d.]+)\)/);
  assert.ok(cornerGlow, 'dark mode pins a green ambience to the top-left corner');
  const [, glowW, glowH, coreAlpha] = cornerGlow;
  assert.ok(Number(coreAlpha) >= 0.26, `the corner glow reads (alpha ${coreAlpha})`);
  assert.ok(Number(coreAlpha) <= 0.32, `but stays soft, not a bright spot (alpha ${coreAlpha})`);
  assert.ok(Number(glowH) <= 45, `it dies out vertically above the hero paragraph (${glowH}% of viewport height)`);
  assert.ok(Number(glowW) <= 95, 'and fades horizontally toward the middle');
  assert.match(darkGrid, /rgba\(74, 222, 128, 0\) 7\d%\)/, 'the glow has a gradual fade to nothing');
  assert.match(lightGrid, /background-size: auto, 96px 96px, 96px 96px/, 'the bloom layer is not tiled');
  assert.doesNotMatch(darkGrid, /background-size/, 'dark mode inherits the untiled background-size');
  for (const block of [lightGrid, darkGrid]) {
    assert.doesNotMatch(block, /animation|transition|filter:/, 'background layers stay static and cheap');
  }

  // Visible enough to read, still calm: dark outlines clearly above light ones,
  // and light mode stays low enough to keep body text legible.
  for (const outline of outlines) {
    const light = Number(outline.match(/border-\[#15803D\]\/\[([\d.]+)\]/)![1]);
    const dark = Number(outline.match(/dark:border-\[#4ADE80\]\/\[([\d.]+)\]/)![1]);
    assert.ok(light > 0.12 && light <= 0.2, `light outline stays subtle (${light})`);
    assert.ok(dark > light, `dark outline is more present than light (${dark} > ${light})`);
    assert.ok(dark <= 0.32, `dark outline stays calm (${dark})`);
  }

  // Static, invisible to the pointer, and never a blur filter on a large surface.
  const decorative = page.slice(page.indexOf('function DecorativeBackground'), page.indexOf('export default function HomePage'));
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /animate-|animation:|transition:|backdrop-|blur-\[|blur-md|filter:/, 'glow is a static box-shadow, not an animated or filtered layer');

  // Every outline is haloed in dark mode, but lightly: a tight core plus a
  // wide bloom and nothing in between. The approved reference look is a thin
  // lit line, so no outline may grow a bright core or a third ring.
  const halos = [...decorative.matchAll(/dark:shadow-\[([^\]]+)\]/g)].map((m) =>
    [...m[1].matchAll(/0_0_(\d+)px_rgba\(74,222,128,([\d.]+)\)/g)].map(([, blur, alpha]) => ({ blur: +blur, alpha: +alpha }))
  );
  assert.equal(halos.length, 4, 'each outline carries a soft halo in dark mode');
  for (const halo of halos) {
    assert.equal(halo.length, 2, 'each halo is exactly one tight core plus one wide bloom');
    assert.ok(halo[1].blur > halo[0].blur, 'the bloom is wider than the core');
    assert.ok(halo[1].alpha < halo[0].alpha, 'and dimmer than the core');
    assert.ok(halo[0].blur <= 8, `the core hugs the line (${halo[0].blur}px)`);
    assert.ok(halo[0].alpha <= 0.13, `no strong halo around the outlines (core alpha ${halo[0].alpha})`);
    assert.ok(halo[1].alpha <= 0.1, `the wide bloom stays faint (alpha ${halo[1].alpha})`);
  }
});

test('homepage curve sparks - one dot per curved outline, riding that outline, off under reduced motion', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const globals = readFileSync('app/globals.css', 'utf8');
  const decorative = page.slice(page.indexOf('function DecorativeBackground'), page.indexOf('export default function HomePage'));

  // Exactly one dot per outline, and the dot is a CHILD of the line it traces.
  // That parenting is the mechanism, not a stylistic choice: the child is
  // placed in the outline's own box and inherits its rotation, so a path
  // written in local pixels stays welded to the border at any viewport width.
  // A sibling would have needed a second copy of the positioning classes, and
  // that copy is precisely what drifts and leaves a dot crossing empty space.
  const sparks = [...decorative.matchAll(/className="curve-spark (curve-spark--[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    sparks,
    ['curve-spark--circle', 'curve-spark--disc', 'curve-spark--ellipse', 'curve-spark--diamond'],
    'all four curved outlines carry exactly one dot, each with its own geometry'
  );
  assert.equal([...decorative.matchAll(/className="curve-spark /g)].length, 4, 'there are four dots, not a trail or a set');
  for (const shape of sparks) {
    const open = decorative.indexOf(`curve-spark ${shape}`);
    const close = decorative.indexOf('</div>', open);
    assert.ok(open !== -1 && close > open, `${shape} lives inside its outline`);
  }

  // Purely declarative: no script, no loop, no measurement. The path is
  // declared once in CSS, so there is nothing that can run per frame.
  assert.doesNotMatch(decorative, /useState|useEffect|requestAnimationFrame|<canvas|<script/i, 'no JS drives the dots');
  assert.doesNotMatch(page, /curveSpark/i, 'the dots carry no React state');

  // The square grid is explicitly NOT the target: it keeps its own straight
  // spark and gains nothing from this effect.
  const lightGrid = globals.slice(globals.indexOf('.homepage-geometry {'), globals.indexOf('.dark .homepage-geometry {'));
  const darkGrid = globals.slice(globals.indexOf('.dark .homepage-geometry {'), globals.indexOf('.how-step::after'));
  for (const block of [lightGrid, darkGrid]) {
    assert.doesNotMatch(block, /animation|@keyframes|curve-spark/, 'the grid layers stay a static background');
  }
  // The dots on the square grid were removed: the travelling light now belongs
  // to the green outlines only, and nothing rides a grid line any more.
  assert.equal([...decorative.matchAll(/grid-spark/g)].length, 0, 'no dot rides the square grid any more');
  assert.doesNotMatch(globals, /grid-spark/, 'the grid spark CSS is gone too, not just its markup');
  assert.doesNotMatch(globals, /@keyframes grid-spark-travel/, 'its keyframes are gone as well');

  // A real motion path per shape, and the dot is anchored to it.
  const base = globals.slice(globals.indexOf('.curve-spark {'), globals.indexOf('.curve-spark--circle {'));
  assert.match(base, /position: absolute/, 'the dot is out of flow, so it can never shift layout');
  assert.match(base, /pointer-events: none/, 'it can never intercept a hover or a tap');
  // The motion is declared per shape now, beside the path it follows: the
  // keyframes are written in that shape's own coordinates, so a dot cannot be
  // animated along another outline's curve.
  assert.doesNotMatch(base, /animation: curve-spark-travel/, 'the motion is declared per shape, not once for all four');
  for (const shape of sparks) {
    const block = globals.slice(globals.indexOf(`.${shape} {`), globals.indexOf('}', globals.indexOf(`.${shape} {`)));
    assert.match(block, /offset-path: path\("M /, `${shape} declares an explicit path`);
    // A curve, not a straight line: every shape's path is built from arc
    // segments, and a rounded square is arcs joined by straight runs rather
    // than a single circle.
    assert.ok(
      (block.match(/ A [\d.]+ [\d.]+ /g) || []).length >= 2,
      `${shape} is traced with arc segments, not a straight line`
    );
    assert.match(block, /--curve-period: \d+s/, `${shape} has its own period`);
    assert.match(block, /--curve-delay: -\d+s/, `${shape} starts mid-glide rather than at rest`);
  }
  // Four different periods and four different offsets: if these were shared the
  // four dots would pulse together and read as one heartbeat instead of four
  // independent glints.
  const periods = sparks.map((s) => globals.match(new RegExp(`\\.${s} \\{[\\s\\S]*?--curve-period: (\\d+)s`))![1]);
  const delays = sparks.map((s) => globals.match(new RegExp(`\\.${s} \\{[\\s\\S]*?--curve-delay: -(\\d+)s`))![1]);
  assert.equal(new Set(periods).size, 4, 'no two outlines share a period');
  assert.equal(new Set(delays).size, 4, 'no two outlines share a delay');

  // Only TRANSFORM and opacity animate, and that is a measured requirement
  // rather than a style preference: this browser reports `offset-distance` in
  // an Animation trace's `unsupportedProperties` for these four dots, i.e. the
  // traversal was NOT composited and every frame of it was main-thread style
  // work. A translate() over the same path IS composited (verified in the same
  // browser: zero unsupported properties, with `offset-path` still in place).
  //
  // Each shape therefore carries its own keyframes, sampled from its own path
  // at the ten stops the envelope needs. `offset-path` remains the single
  // declaration of the geometry, and it is also what keeps the 5px dot centred
  // ON the line rather than hung off it; only the animated property changed.
  const anim = globals.match(/@keyframes curve-spark-travel-circle \{([\s\S]*?)\n\}/)![1];
  for (const shape of sparks) {
    const name = shape.replace('curve-spark--', '');
    const block = globals.match(new RegExp(`@keyframes curve-spark-travel-${name} \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(block, `${name} has its own keyframes, written in its own path's coordinates`);
    assert.match(block![1], /transform: translate\(/, `${name} travels by transform`);
    assert.doesNotMatch(block![1], /offset-distance/, `${name} no longer animates the non-composited property`);
  }
  const keyframes = [...anim.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  for (const frame of keyframes) {
    for (const prop of frame.split(';').map((d) => d.split(':')[0].trim())) {
      assert.ok(['transform', 'opacity', ''].includes(prop), `only transform and opacity animate (found ${prop})`);
    }
  }
  // Ten stops, and every curve here is a closed loop: the translate values are
  // deltas from the path's own start point, so the dot is at that start point
  // at 0%, at the end of the crossing (78%) and for the whole rest window.
  const stops = [...anim.matchAll(/(\d+)%\s*\{\s*transform: translate\(([^)]*)\)/g)].map(([, pct, t]) => ({
    pct: Number(pct),
    t,
  }));
  // The samples are every 2% of the cycle across the 78% crossing. That
  // density is load-bearing: a translate travels in straight lines BETWEEN
  // keyframes, so sampling only at the glow envelope's stops is what let the
  // dot stray up to 44px off the line (measured against the real path). The
  // geometric bound that follows from this spacing is checked in the test
  // below, against each outline's own radius.
  assert.ok(stops.length >= 40, `the path is sampled densely enough to stay on it (${stops.length} stops)`);
  const crossing = stops.filter((s) => s.pct <= 78);
  const gaps = crossing.slice(1).map((s, i) => s.pct - crossing[i].pct);
  assert.ok(Math.max(...gaps) <= 2, `no gap between samples exceeds 2% of the cycle (${Math.max(...gaps)}%)`);
  for (const pct of [0, 78, 100]) {
    assert.equal(stops.find((s) => s.pct === pct)!.t, '0px, 0px', `the dot is back at the start of its path at ${pct}%`);
  }
  assert.ok(stops.some((s) => s.t !== '0px, 0px'), 'and it genuinely leaves it');

  // Occasional, not a constant lit line: a long cycle, and a rest window at
  // the end of it where the dot is parked unseen.
  assert.ok(periods.every((p) => Number(p) >= 24), 'every cycle is slow enough to be ambience');

  // The glow is a symmetric envelope, not a step on and off. Parsed as
  // (cycle %, opacity) pairs so the shape is checked, not just the endpoints.
  const frames = [...anim.matchAll(/(\d+(?:\.\d+)?)%\s*\{([^}]*)\}/g)].map(([, pct, body]) => ({
    pct: Number(pct),
    opacity: body.includes('opacity:') ? Number(body.match(/opacity: ([\d.]+)/)![1]) : null,
    rest: /transform: translate\(0px, 0px\)/.test(body),
  }));
  const opacityFrames = frames.filter((f) => f.opacity !== null);
  assert.ok(opacityFrames.length >= 7, `the glow is built from a ramp, not two steps (${opacityFrames.length} frames)`);

  // The peak must fall on the MIDDLE OF THE PATH, so it has to sit halfway
  // through the traversal window (the part of the cycle spent moving along the
  // path), not simply at the 50% mark of the cycle. The window is read back
  // out of the keyframes: the crossing ends at the first stop past 0% where the
  // dot is back at its path's start point.
  const travelStart = 0;
  const travelEnd = frames.find((f) => f.rest && f.pct > travelStart)!.pct;
  const peakFrame = opacityFrames.reduce((a, b) => (b.opacity! > a.opacity! ? b : a));
  const travelMid = (travelStart + travelEnd) / 2;
  assert.equal(peakFrame.pct, travelMid, `the glow peaks at the middle of the path (${peakFrame.pct}% vs ${travelMid}%)`);

  // Rises all the way to the peak and falls by the same amount after it, so
  // the dot does not blink on and off.
  const rising = opacityFrames.filter((f) => f.pct <= peakFrame.pct);
  const falling = opacityFrames.filter((f) => f.pct >= peakFrame.pct);
  for (let i = 1; i < rising.length; i++) {
    assert.ok(rising[i].opacity! > rising[i - 1].opacity!, `the glow rises gradually up to the peak (at ${rising[i].pct}%)`);
  }
  for (let i = 1; i < falling.length; i++) {
    // Non-increasing: once the dot has reached zero it stays at zero through
    // the rest window rather than dipping further.
    assert.ok(falling[i].opacity! <= falling[i - 1].opacity!, `the glow falls gradually after the peak (at ${falling[i].pct}%)`);
    if (falling[i - 1].opacity! > 0) {
      assert.ok(falling[i].opacity! < falling[i - 1].opacity!, `the fall is real while the dot is still lit (at ${falling[i].pct}%)`);
    }
  }
  // Invisible at both ends of the traversal, and symmetric about the peak.
  assert.equal(rising[0].opacity, 0, 'the dot leaves the far end of the curve unseen');
  assert.equal(falling[falling.length - 1].opacity, 0, 'and arrives at the near end unseen');
  for (const f of rising) {
    const mirror = falling.find((g) => g.pct === travelMid + (travelMid - f.pct));
    if (mirror) assert.equal(mirror.opacity, f.opacity, `the fade out mirrors the fade in at ${f.pct}%`);
  }

  // It rests unseen for the rest of the cycle, so the effect is an occasional
  // glint rather than a line that is permanently lit.
  assert.ok(travelEnd <= 90, `the dot finishes its crossing and then rests (crossing ends at ${travelEnd}%)`);
  assert.ok(100 - travelEnd >= 10, `it is absent for a real part of every cycle (rest ${100 - travelEnd}%)`);

  // The peak has to land on the middle of the PATH, which only holds if the dot
  // moves at a constant speed along it — the samples are evenly spaced in path
  // LENGTH and the timing is linear. Under the old ease-in-out the dot was a
  // quarter of the way along the curve at the cycle's halfway point, so the
  // envelope above would have peaked in the wrong place.
  for (const shape of sparks) {
    const block = globals.slice(globals.indexOf(`.${shape} {`), globals.indexOf('}', globals.indexOf(`.${shape} {`)));
    assert.match(
      block,
      /animation: curve-spark-travel-[a-z]+ var\(--curve-period\) linear var\(--curve-delay\) infinite/,
      `${shape} is animated from CSS, at a constant speed along its own path`
    );
  }

  // The one hard accessibility requirement: no motion at all when asked.
  const reduced = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));
  const reducedSpark = reduced.slice(reduced.indexOf('.curve-spark'), reduced.indexOf('.tool-card:hover'));
  assert.match(reducedSpark, /animation: none/, 'reduced motion switches the animation off');
  assert.match(reducedSpark, /opacity: 0/, 'and the dot is never placed on screen');

  // Subtle in both themes, and the dots use the same green as the lines they
  // ride so they read as part of the outline rather than as a separate light.
  const darkSpark = globals.slice(globals.indexOf('.dark .curve-spark {'), globals.indexOf('/* Subtle engineering dot-grid'));
  const peak = Math.max(...[...anim.matchAll(/opacity: ([\d.]+);/g)].map((m) => Number(m[1])));
  assert.ok(peak > 0 && peak <= 0.5, `the dot stays faint at its brightest (${peak})`);
  assert.match(base, /#15803D/, 'it uses the same light tool-icon green as the outlines');
  assert.match(darkSpark, /#4ADE80/, 'and the same dark green');
  assert.match(base, /box-shadow/, 'the glow is a small static box-shadow');
  assert.match(base, /width: 5px;[\s\S]*height: 5px;/, 'the dot is small');
  // The outlines themselves must not have picked up a second halo.
  assert.equal([...decorative.matchAll(/dark:shadow-\[/g)].length, 4, 'each outline still carries exactly one halo');
});

test('homepage curve sparks - every path traces the border its outline actually draws', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const globals = readFileSync('app/globals.css', 'utf8');
  const decorative = page.slice(page.indexOf('function DecorativeBackground'), page.indexOf('export default function HomePage'));

  // The reason this test exists: a motion path that is merely a plausible
  // curve is not enough. The dot has to sit ON the painted border, and a
  // uniform border-radius does not always paint the shape it appears to. A
  // `rounded-full` outline on a 512x176 box clamps to 88px — half the SHORT
  // side — so the browser draws a stadium (two straight 336px runs joined by
  // semicircular caps), NOT an ellipse. A path written as a true ellipse
  // agreed with the drawn line only at the four extremes and sat up to 25px
  // off it in between, which reads as the dot crossing empty space.
  //
  // So the geometry is DERIVED from each outline's own Tailwind classes rather
  // than restated here. If an outline's size or radius changes, this fails
  // until its path is updated to match.

  /** Tailwind's numeric spacing scale: n -> n/4 rem, so 80 -> 320px. */
  const spacing = (token: string) => (Number(token) / 4) * 16;
  /** `[Nrem]` arbitrary values, e.g. `h-[42rem]` -> 672. */
  const arbitrary = (token: string) => parseFloat(token) * 16;

  const outlines = [...decorative.matchAll(/<div className="absolute ([^"]*?)">\s*<span className="curve-spark curve-spark--([a-z]+)"/g)].map(
    (m) => ({ classes: m[1], shape: m[2] })
  );
  assert.equal(outlines.length, 4, 'each of the four outlines carries a dot');

  for (const { classes, shape } of outlines) {
    const dim = (axis: string) => {
      const bracket = classes.match(new RegExp(`${axis}-\\[([\\d.]+)rem\\]`));
      if (bracket) return arbitrary(bracket[1]);
      const plain = classes.match(new RegExp(`${axis}-(\\d+)\\b`));
      assert.ok(plain, `${shape}: no ${axis} size class found`);
      return spacing(plain[1]);
    };
    const w = dim('w');
    const h = dim('h');

    // A used border-radius: `rounded-full` clamps to half the short side,
    // `rounded-[Nrem]` is taken literally. A uniform radius can never exceed
    // half the short side on both axes.
    const usedRadius = classes.includes('rounded-full')
      ? Math.min(w, h) / 2
      : arbitrary(classes.match(/rounded-\[([\d.]+)rem\]/)![1]);
    // The border is 2px, so its centreline is half a pixel inside the edge.
    const BORDER = 2;
    const r = usedRadius - BORDER / 2;

    const block = globals.slice(globals.indexOf(`.curve-spark--${shape} {`), globals.indexOf('}', globals.indexOf(`.curve-spark--${shape} {`)));
    const d = block.match(/offset-path: path\("([^"]+)"\)/)![1];

    // The border centreline runs 1px inside the box edge, expressed against
    // the padding-box origin a positioned child is placed at, so from -1 to
    // w - 3.
    const xs = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
    assert.ok(xs.length > 0, `${shape}: path has coordinates`);

    // Every arc must use the outline's own corner radius, and must be a
    // circular arc (rx === ry). An elliptical arc (rx !== ry) can only ever
    // match a square box.
    const arcs = [...d.matchAll(/A ([\d.]+) ([\d.]+) /g)].map(([, rx, ry]) => [Number(rx), Number(ry)]);
    assert.ok(arcs.length >= 2, `${shape}: the path is built from arc segments`);
    for (const [rx, ry] of arcs) {
      assert.equal(rx, ry, `${shape}: every arc is circular, not elliptical (rx ${rx} vs ry ${ry})`);
      assert.equal(rx, r, `${shape}: arc radius ${rx} matches the outline's border radius (${r})`);
    }

    // The path must span exactly the border centreline, and no further: a
    // point outside [-1, w-3] x [-1, h-3] is not on the drawn line.
    const coords = [...d.matchAll(/([ML]) (-?[\d.]+) (-?[\d.]+)/g)].map(([, cmd, x, y]) => ({
      cmd, x: Number(x), y: Number(y),
    }));
    for (const { x, y } of coords) {
      assert.ok(x >= -1 && x <= w - 3, `${shape}: x ${x} is on the border centreline (-1..${w - 3})`);
      assert.ok(y >= -1 && y <= h - 3, `${shape}: y ${y} is on the border centreline (-1..${h - 3})`);
    }

    // The travelling dot has to stay ON that border too. Each shape's
    // keyframes translate the dot from the start of its own path, so every
    // sample, offset by the path's declared start point, must land inside the
    // border box the path traces — a sample outside it would be a dot crossing
    // empty space, exactly what this whole file exists to prevent.
    const [startX, startY] = d.match(/M (-?[\d.]+) (-?[\d.]+)/)!.slice(1).map(Number);
    const keyframeBlock = globals.match(
      new RegExp(`@keyframes curve-spark-travel-${shape.replace('curve-spark--', '')} \\{([\\s\\S]*?)\\n\\}`)
    )![1];
    const samples = [
      ...keyframeBlock.matchAll(/(\d+)%\s*\{\s*transform: translate\((-?[\d.]+)px, (-?[\d.]+)px\)/g),
    ].map(([, pct, x, y]) => [Number(pct), startX + Number(x), startY + Number(y)]);
    assert.ok(samples.length >= 40, `${shape}: the crossing is densely sampled (${samples.length} stops)`);
    for (const [, x, y] of samples) {
      assert.ok(x >= -1.6 && x <= w - 2.4, `${shape}: the dot stays on the drawn border (x ${x} in -1..${w - 3})`);
      assert.ok(y >= -1.6 && y <= h - 2.4, `${shape}: the dot stays on the drawn border (y ${y} in -1..${h - 3})`);
    }

    // And so does the ground BETWEEN the samples. A translate interpolates in
    // a straight line, so each pair of consecutive stops is a chord whose
    // greatest distance from the arc is the sagitta, L*L/(8r). Every chord here
    // has to bow less than the dot's own 2.5px radius, or the middle of that
    // chord would show as the dot leaving the line it rides.
    const crossingSamples = samples.filter(([pct]) => pct <= 78);
    for (let i = 1; i < crossingSamples.length; i++) {
      const chord = Math.hypot(
        crossingSamples[i][1] - crossingSamples[i - 1][1],
        crossingSamples[i][2] - crossingSamples[i - 1][2]
      );
      const sagitta = (chord * chord) / (8 * r);
      assert.ok(
        sagitta <= 2.5,
        `${shape}: a ${chord.toFixed(1)}px chord bows ${sagitta.toFixed(2)}px off its radius-${r} curve (between ${crossingSamples[i - 1][0]}% and ${crossingSamples[i][0]}%)`
      );
    }

    // A rounded square and a stadium both need four arcs (one per quarter);
    // only a true circle can close with two.
    const isCircle = w === h && usedRadius === w / 2;
    assert.equal(
      arcs.length,
      isCircle ? 2 : 4,
      `${shape}: ${isCircle ? 'a circle closes with two arcs' : 'a rounded square / stadium needs four'}`
    );
  }
});

test('homepage order - hero, tools, quick guided check, how, privacy, guides, FAQ', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const dictionary = readFileSync('lib/i18n/dictionaries/en.ts', 'utf8');

  const order = [
    'Hero',
    'Tools grid',
    'Quick Guided Check',
    'How it works',
    'Privacy by design',
    'Guides & troubleshooting',
    'FAQ',
  ];
  const positions = order.map((name) => landing.indexOf(`/* ================= ${name}`));
  for (const [i, name] of order.entries()) {
    assert.ok(positions[i] >= 0, `homepage still has the ${name} section`);
    if (i > 0) assert.ok(positions[i] > positions[i - 1], `${name} comes after ${order[i - 1]}`);
  }
  // The guided band is renamed, and the guides band no longer precedes it.
  assert.match(dictionary, /inspectionTitle: 'Quick Guided Check'/);
  assert.doesNotMatch(dictionary, /In a hurry/);
  assert.ok(
    landing.indexOf('Quick Guided Check') < landing.indexOf('Guides & troubleshooting'),
    'Guides & Troubleshooting sits after the quick guided check, not before it'
  );
  // Header and footer are untouched: they live outside LandingClient.
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /<Navbar t=\{t\} \/>/);
  assert.match(page, /<Footer t=\{t\} \/>/);
});

test('tools list - phones show 3 popular + IP + speed, then View all tests', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const dictionary = readFileSync('lib/i18n/dictionaries/en.ts', 'utf8');

  assert.match(landing, /const POPULAR_SLUGS = \['microphone-test', 'webcam-test', 'speakers-test'\]/);
  assert.match(landing, /const MOBILE_EXTRA_SLUGS = \['what-is-my-ip', 'internet-speed-test'\]/);
  assert.match(landing, /const MOBILE_DEFAULT_SET = new Set\(\[\.\.\.POPULAR_SLUGS, \.\.\.MOBILE_EXTRA_SLUGS\]\)/);
  for (const slug of ['microphone-test', 'webcam-test', 'speakers-test', 'what-is-my-ip', 'internet-speed-test']) {
    assert.ok(TOOLS_REGISTRY.some((tool) => tool.slug === slug), `${slug} is a real tool`);
  }
  // The trimmed grid is mobile-only and the rest of the catalog survives on desktop.
  assert.match(landing, /\{!isFiltering && mobileDefaultExtras\.length > 0 && \(\s*<div className="grid grid-cols-1 gap-3 md:hidden">/);
  assert.match(landing, /isFiltering \? '' : 'hidden md:grid'/);
  assert.match(landing, /md:grid-cols-3/);
  // Searching or filtering brings every match back on phones.
  assert.match(landing, /const isFiltering = Boolean\(searchQuery\.trim\(\)\) \|\| selectedCategory !== 'all'/);
  // The escape hatch points at the full catalog hub.
  assert.match(landing, /!isFiltering && hasMoreToolsThanMobileShows &&/);
  assert.match(landing, /href="\/tests"/);
  assert.match(dictionary, /viewAllTests: 'View all tests'/);
});

test('homepage renders on the server - no useSearchParams, no empty 60vh shell', () => {
  const landing = readFileSync('components/LandingClient.tsx', 'utf8');
  const page = readFileSync('app/page.tsx', 'utf8');

  // useSearchParams() opts the page out of static rendering: the server then
  // ships <main> with only a 60vh placeholder, the footer paints under the
  // header, and the real page is injected afterwards. That one jump was the
  // entire CLS score (0.33 mobile / 0.34 desktop).
  const landingCode = landing.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(landingCode, /useSearchParams/, 'LandingClient must not opt the homepage out of prerendering');
  assert.doesNotMatch(page, /min-h-\[60vh\]/, 'no empty placeholder shell around the homepage');
  assert.doesNotMatch(page, /<Suspense/, 'no Suspense boundary deferring the homepage markup');
  // The id is the skip-to-content target; the rest of the markup is unchanged.
  assert.match(page, /<main id="main-content" className="flex-1 relative z-10">[\s\S]*?<LandingClient t=\{t\} guides=\{pickHomeGuides\(\)\} \/>[\s\S]*?<\/main>/);

  // The URL is read through useSyncExternalStore instead, which gives the
  // server and the first client render the same snapshot, and popstate still
  // restores Back/Forward.
  assert.match(landing, /import React, \{[^}]*useSyncExternalStore/);
  assert.match(landing, /function subscribeToUrlChange[\s\S]*addEventListener\('popstate'/);
  assert.match(landing, /useSyncExternalStore\(subscribeToUrlChange, getUrlSearch, getServerUrlSearch\)/);
  assert.match(landing, /function getServerUrlSearch\(\) \{\s*return '';/);

  // router.replace() never emits popstate, so the visible filter is local state
  // that the URL merely mirrors; Back/Forward re-syncs both from the store.
  assert.match(landing, /const applyFilter = useCallback\([\s\S]*setSearchQuery\(query\);[\s\S]*setSelectedCategory\(category\);[\s\S]*router\.replace/);
  assert.match(landing, /if \(urlQuery !== lastUrlQuery\) \{[\s\S]*setSearchQuery\(urlQuery\);/);
  assert.match(landing, /if \(urlCategory !== lastUrlCategory\) \{[\s\S]*setSelectedCategory\(urlCategory\);/);
  assert.doesNotMatch(landing, /const searchQuery = urlQuery;/, 'filtering reads state, not the URL store');
  assert.doesNotMatch(landing, /syncUrl\(/, 'every filter path goes through applyFilter');
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

// ---------- Card artwork: one consistent outer shape ----------

test('inspection cards - no card bakes a frame or a dark corner into its pixels', async (t) => {
  // The Full Diagnostic file shipped with a ~5px lavender frame around its
  // whole perimeter while the other three had none, so it read as a rounded
  // card drawn inside a larger white square. The frame lives in the pixels:
  // no theme colour or border can hide it, so it has to be absent from the
  // file. Pre-Call instead fills its rounded corner with black; that is
  // handled by the shared CSS clip, and is deliberately NOT a failure here.
  //
  // Decoding needs a raster decoder, which is not a direct dependency here
  // (the rest of this file reads WebP headers only). The specifier is held in
  // a variable so TypeScript never hard-depends on it, and the test skips
  // loudly rather than pretending when no decoder is installed.
  type RawInfo = { width: number; height: number; channels: number };
  type Decoder = (file: string) => {
    removeAlpha: () => {
      raw: () => {
        toBuffer: (o: { resolveWithObject: true }) => Promise<{ data: Buffer; info: RawInfo }>;
      };
    };
  };
  const specifier = 'sharp';
  let decode: Decoder | null = null;
  try {
    const mod = (await import(specifier)) as unknown as Record<string, unknown>;
    const candidate = (mod.default ?? mod) as unknown;
    if (typeof candidate === 'function') decode = candidate as Decoder;
  } catch {
    decode = null;
  }
  if (!decode) {
    t.skip('no image decoder available (sharp not installed)');
    return;
  }

  const CARDS = [
    'pre-call-meeting-readiness.webp',
    'used-computer-hardware-inspection.webp',
    'classroom-lab-kiosk-verification.webp',
    'full-diagnostic-check-all-7-tests.webp',
  ];
  const sat = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  // A frame is a saturated, BRIGHT band. Pre-Call fills its rounded corner
  // with near-black, which is also "saturated" by the ratio above and must
  // not be mistaken for one — that wedge is handled by the CSS clip.
  const isFrameColour = (p: readonly [number, number, number]) =>
    sat(p[0], p[1], p[2]) > 0.15 && Math.max(p[0], p[1], p[2]) > 40;

  for (const name of CARDS) {
    const file = join(repoRoot, 'public', 'inspection', name);
    const { data, info } = await decode(file)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels } = info;
    const px = (x: number, y: number) => {
      const o = (y * W + x) * channels;
      return [data[o], data[o + 1], data[o + 2]] as const;
    };

    // Walk INWARD from each edge; a baked frame is a contiguous chromatic
    // band sitting on the perimeter. Sampled away from the corners, where a
    // rounded card legitimately has no edge colour.
    const N = 61;
    const measure = (edge: 'left' | 'right' | 'top' | 'bottom') => {
      let max = 0;
      const span = edge === 'left' || edge === 'right' ? H : W;
      for (let i = 2; i < N - 2; i++) {
        const t = Math.floor(((i + 0.5) / N) * span);
        let d = 0;
        while (d < 16) {
          const p =
            edge === 'left' ? px(d, t)
            : edge === 'right' ? px(W - 1 - d, t)
            : edge === 'top' ? px(t, d)
            : px(t, H - 1 - d);
          if (!isFrameColour(p)) break;
          d++;
        }
        if (d > max) max = d;
      }
      return max;
    };

    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      const band = measure(edge);
      // Artwork that runs to the card edge can colour one or two pixels; a
      // frame is a deliberate band several pixels thick.
      assert.ok(band <= 2, `${name}: ${band}px frame band baked into the ${edge} edge`);
    }

    // And the frame must be gone on every side, not just the sampled ones.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (Math.min(x, y, W - 1 - x, H - 1 - y) >= 6) continue;
        const p = px(x, y);
        assert.ok(
          !isFrameColour(p),
          `${name}: frame-coloured pixel survives at (${x}, ${y}) = rgb(${p.join(',')})`,
        );
      }
    }
  }
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

// ---------- Theme control: one accessible switch, not a Light/Dark pair ----------

test('navbar - the theme control is a single switch shared by drawer and header', async () => {
  // The old Light/Dark two-button pair is gone: one control, both states.
  assert.doesNotMatch(navbarSource, /role="radiogroup"/, 'the Light/Dark button pair must be replaced');
  assert.doesNotMatch(navbarSource, /role="radio"/, 'no per-mode radio buttons remain');
  assert.doesNotMatch(navbarSource, /function ThemeControl/, 'the segmented control is replaced by ThemeSwitch');

  // Switch semantics: state comes from aria-checked, the name says what is
  // being switched (not which state it is currently in).
  assert.match(navbarSource, /role="switch"/);
  assert.match(navbarSource, /aria-checked=\{isDark\}/);
  assert.match(navbarSource, /aria-label=\{t\.nav\.themeSwitch\}/);
  // The track/thumb are decorative; their state is already announced.
  assert.match(navbarSource, /aria-hidden="true"/);
  // The name must describe the control, not restate the state.
  const { getDictionary } = await import('../lib/i18n/index.js');
  const label = getDictionary().nav.themeSwitch;
  assert.notEqual(label, getDictionary().nav.themeToggle, 'the switch must not be named after its section');
  assert.doesNotMatch(label, /^(on|off)$/i);
  // The switch shows no visible text, so aria-label is its ONLY name: it has
  // to name the action or a screen reader announces an unlabelled switch.
  assert.match(label, /dark/i, 'the accessible name must mention dark mode');
  assert.match(label, /toggle/i, 'the accessible name must describe the action');
  const switchBody = navbarSource.slice(
    navbarSource.indexOf('function ThemeSwitch'),
    navbarSource.indexOf('function NavbarInner'),
  );
  assert.doesNotMatch(switchBody, /\{t\.nav\.themeSwitch\}<\/span>/, 'the switch must render no visible label');

  // Reuses the shared theme system, so localStorage persistence is unchanged.
  assert.match(navbarSource, /const \{ theme, toggleTheme \} = useTheme\(\);/);
  assert.match(navbarSource, /onClick=\{toggleTheme\}/);
});

test('navbar - the theme switch toggles on click and on Space (native button activation)', () => {
  // Scope to the switch itself: the drawer legitimately uses keydown elsewhere.
  const start = navbarSource.indexOf('function ThemeSwitch');
  const end = navbarSource.indexOf('function NavbarInner');
  assert.ok(start !== -1 && end > start, 'the ThemeSwitch component must exist');
  const switchSrc = navbarSource.slice(start, end);

  // A real <button> fires click on Space/Enter natively. A manual key handler
  // would double-toggle, so its absence is the actual regression guard.
  assert.match(switchSrc, /<button\s+type="button"\s+role="switch"/, 'the switch must be a real button element');
  assert.doesNotMatch(
    switchSrc.replace(/NO onKey\w+/g, ''),
    /onKeyDown|onKeyUp|onKeyPress/,
    'the switch must not add a key handler (it would double-toggle)',
  );
  // Keyboard users must be able to see where they are. A ring, not an
  // outline: `outline-none` and `outline-2` share --tw-outline-style and
  // cancel each other out, leaving no visible focus ring at all.
  assert.match(switchSrc, /focus-visible:ring-2/);
  assert.match(switchSrc, /focus-visible:ring-\[#0F766E\]/);
  assert.doesNotMatch(switchSrc, /focus-visible:outline-2/, 'the outline utilities cancel out the ring');
});

test('navbar - the theme switch travels within its track and stays visible on mobile', () => {
  assert.match(navbarSource, /variant="desktop"/, 'desktop header must render the compact ThemeSwitch variant');
  assert.match(
    navbarSource,
    /hidden lg:flex[\s\S]{0,200}<ThemeSwitch t=\{t\} variant="desktop" \/>/,
    'desktop switch must be hidden on mobile (drawer switch covers mobile)'
  );
  assert.match(navbarSource, /<ThemeSwitch t=\{t\} \/>/, 'the drawer keeps the switch');

  // On a phone the switch sits alone under the APPEARANCE heading, padded to
  // a 44px tap target and lined up with the icon column of the rows above.
  assert.match(navbarSource, /compact \? '' : 'px-3 py-1\.5'/, 'the drawer switch needs a 44px tap target');
  assert.doesNotMatch(navbarSource, /w-full justify-between gap-3/, 'the switch must not span the drawer row');
  assert.match(
    navbarSource,
    /mb-1 px-3 text-\[10px\] font-extrabold[\s\S]{0,200}<ThemeSwitch t=\{t\} \/>/,
    'the APPEARANCE heading must stay above the switch, on the same left edge',
  );

  // The iPhone look: a sliding thumb on a rounded track. Travel equals
  // track width - thumb width - the 2px inset, so it can never overflow.
  assert.match(navbarSource, /w-11 h-6'/);
  assert.match(navbarSource, /w-5 h-5 translate-x-0 dark:translate-x-5/, 'desktop thumb slides 20px');
  assert.match(navbarSource, /w-14 h-8'/);
  assert.match(navbarSource, /w-7 h-7 translate-x-0 dark:translate-x-6/, 'drawer thumb slides 24px');
  assert.match(navbarSource, /rounded-full bg-\[#D9D4E8\] dark:bg-\[#14B8A6\]/, 'track colour follows the mode');
  assert.match(navbarSource, /transition-transform duration-300/);
  // Both modes keep a glyph, so the state is readable without relying on colour.
  assert.match(navbarSource, /<Sun className=\{`\$\{iconSize\} text-\[#D97706\] dark:hidden`\}/);
  assert.match(navbarSource, /<Moon className=\{`\$\{iconSize\} hidden text-\[#0F766E\] dark:inline`\}/);
});

test('navbar - the theme switch is positioned by CSS, not by hydration', () => {
  // .dark is set on <html> before first paint, so the track/thumb/glyph must be
  // driven by `dark:` variants. If the visuals read the React theme value
  // instead, a returning visitor with a stored Light would see the switch in
  // the wrong position until the client bundle hydrates.
  const start = navbarSource.indexOf('function ThemeSwitch');
  const end = navbarSource.indexOf('function NavbarInner');
  const switchSrc = navbarSource.slice(start, end);
  const visual = switchSrc.slice(switchSrc.indexOf('aria-hidden="true"'));
  assert.ok(visual.length > 0, 'the decorative track must exist');
  assert.doesNotMatch(visual, /isDark/, 'the visual state must come from CSS, not the React theme value');
  // The React value is still used for the accessible state and the tooltip.
  assert.match(switchSrc, /aria-checked=\{isDark\}/);
  assert.match(switchSrc, /title=\{isDark \? t\.nav\.themeDark : t\.nav\.themeLight\}/);
});

// ---------- Phone drawer sizing ----------

test('navbar - the phone nav drawer hugs its content instead of covering the screen', () => {
  // The nav drawer used to be w-[86%] max-w-sm, i.e. ~303px on a 390px phone —
  // almost the full screen, with a lot of empty space beside short labels.
  // It now sizes to its longest row ("Share DeviceTry", ~204px + padding).
  assert.match(
    navbarSource,
    /id="site-nav-drawer"[\s\S]{0,400}width="w-fit max-w-\[86vw\]"/,
    'the nav drawer must size itself to its content and stay capped',
  );
  assert.doesNotMatch(
    navbarSource,
    /id="site-nav-drawer"[\s\S]{0,400}w-\[86%\]/,
    'the nav drawer must not span 86% of a phone screen',
  );
  // Width is now a per-drawer prop; the tools drawer still needs the room for
  // its search field, so the percentage width must remain the default.
  assert.match(navbarSource, /width\?: string;/);
  assert.match(navbarSource, /width = 'w-\[86%\] max-w-sm',/);
  assert.match(
    navbarSource,
    /id="tools-drawer"[\s\S]{0,400}label=\{t\.nav\.toolsDrawerTitle\}/,
    'the tools drawer is unchanged',
  );
  // The panel still fills the height and carries the slide-in transform.
  assert.match(navbarSource, /absolute top-0 \$\{side\}-0 h-full \$\{width\}/);
});
