import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Mobile layout regressions.
 *
 * These all shipped as real, user-visible bugs verified against the served
 * preview at 360–430px: a toolbar that pushed the page 127px past the
 * viewport, result tables whose columns were clipped away with no way to
 * reach them, a header grid that could not shrink, and long unbreakable URLs
 * widening the page. Each pin fails if the treatment is reverted.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8').toLowerCase();

test('result tables never sit inside a clipping wrapper', () => {
  const tables = [
    'components/tests/BrowserCompatibilityTester.tsx',
    'components/tests/BrowserSystemInfoTester.tsx',
    'components/tests/CodecSupportTester.tsx',
    'components/tests/JavascriptBenchmarkTester.tsx',
    'components/tests/PermissionDiagnosticsTester.tsx',
    'components/tests/PrivacyStorageInspectorTester.tsx',
    'components/guides/GuideArticleView.tsx',
    'components/inspection/GuidedInspectionFlow.tsx',
  ];
  for (const file of tables) {
    const src = read(file);
    assert.ok(src.includes('scrollabletable'), `${file} must use the shared ScrollableTable wrapper`);
    const idx = src.indexOf('<table');
    assert.ok(idx > 0, `${file} must contain a <table>`);
    const before = src.slice(Math.max(0, idx - 400), idx);
    assert.ok(!before.includes('overflow-hidden'), `${file} wraps its table in overflow-hidden, clipping columns on mobile`);
  }
});

test('the scroll wrapper is keyboard reachable and labelled', () => {
  const wrapper = read('components/ui/ScrollableTable.tsx');
  assert.ok(wrapper.includes('role="region"'), 'scroll region needs a landmark role');
  assert.ok(wrapper.includes('tabindex={0}'), 'scroll region must be focusable (WCAG 2.1.1)');
  assert.ok(wrapper.includes('aria-label'), 'scroll region needs an accessible name');
  assert.ok(wrapper.includes('overflow-x-auto'), 'wrapper must scroll rather than clip');
  assert.ok(wrapper.includes('swipe the table sideways'), 'a visible affordance is required on narrow screens');
  assert.ok(wrapper.includes('sm:hidden'), 'the affordance must disappear on desktop where it is noise');
});

test('toolbar rows wrap instead of pushing the page sideways', () => {
  // Keyboard tester: the layout selector + Reset exceeded the viewport by 127px.
  const keyboard = read('components/tests/KeyboardTester.tsx');
  assert.ok(keyboard.includes('flex flex-wrap items-center gap-3'), 'keyboard toolbar must wrap on narrow screens');
  assert.ok(
    !/(<div className="flex items-center gap-3">)/.test(keyboard.replace(/\n/g, ' ')),
    'keyboard toolbar must not revert to a non-wrapping row',
  );
  assert.ok(keyboard.includes('flex flex-wrap items-center gap-2 min-w-0'), 'the layout selector row must wrap too');

  // Result banner: Export + Share overflowed by 15px at 360px.
  const banner = read('components/TestResultBanner.tsx');
  assert.ok(
    banner.includes('flex flex-wrap items-center gap-1.5 sm:shrink-0'),
    'result banner actions must wrap below sm',
  );

  // Dead-pixel tester: the colour label + fullscreen button overflowed at 320px.
  const deadPixel = read('components/tests/DeadPixelTester.tsx');
  assert.ok(deadPixel.includes('flex flex-wrap items-center gap-2'), 'fullscreen controls must wrap at 320px');
  assert.ok(deadPixel.includes('flex flex-wrap items-center gap-x-2 gap-y-1'), 'colour label must wrap at 320px');
});

test('the header grid tracks can shrink below their content', () => {
  const nav = read('components/layout/Navbar.tsx');
  assert.ok(
    nav.includes('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'),
    'a bare 1fr track has a min-content floor and widens the page on narrow screens',
  );
  // The closed drawer panel sits translated off-screen but still occupies
  // layout; without clipping it widened the mobile layout viewport.
  assert.ok(nav.includes('no-print fixed inset-0 z-50 overflow-hidden'), 'the drawer wrapper must clip its off-screen panel');
});

test('guide and tool prose can break long unbreakable tokens', () => {
  // chrome://settings/content/microphone is 269px in a 248px column.
  const guide = read('components/guides/GuideArticleView.tsx');
  assert.ok(guide.includes('[overflow-wrap:anywhere]'), 'guide paragraphs must be able to break long URLs');
  assert.ok((guide.match(/\[overflow-wrap:anywhere\]/g) || []).length >= 4, 'paragraphs, steps, bullets, and FAQs all need it');

  const seo = read('components/ToolSeoContent.tsx');
  assert.ok(seo.includes('[overflow-wrap:anywhere]'), 'tool page prose must be able to break long URLs');
});

test('guide related tools resolve against every registry', () => {
  const guide = read('components/guides/GuideArticleView.tsx');
  assert.ok(guide.includes('findtoolbyslug'), 'guide related tools must search ALL_TOOL_PAGES');
  assert.ok(
    !guide.includes('tools_registry.find'),
    'TOOLS_REGISTRY.find silently drops the six supporting tools (Permission Diagnostics, Codec Support, …)',
  );
});
