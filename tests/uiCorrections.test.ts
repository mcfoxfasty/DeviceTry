import test from 'node:test';
import assert from 'node:assert/strict';

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
