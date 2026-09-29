/**
 * Icon artwork ↔ registry integrity.
 *
 * A slug in TOOL_ICON_FILES with no file under public/Icons/ renders as a
 * broken image wherever the icon is used — on the tool card, the test page
 * header, and /advanced-diagnostics. That is invisible in review and only
 * shows up in the browser, so it is pinned here instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TOOL_ICON_FILES, toolIconSrc } from '../lib/tools/iconAssets';
import { TOOLS_REGISTRY, SUPPORTING_REGISTRY } from '../lib/tools/registry';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = join(repoRoot, 'public', 'Icons');

test('icon assets - every mapped PNG exists and is a real PNG', () => {
  for (const [slug, file] of Object.entries(TOOL_ICON_FILES)) {
    const path = join(iconDir, file);
    assert.ok(existsSync(path), `${slug} is mapped to ${file}, which is missing from public/Icons/`);
    const bytes = readFileSync(path);
    assert.equal(
      bytes.subarray(0, 8).toString('hex'),
      '89504e470d0a1a0a',
      `${file} must be a PNG (a renamed .jpg or an HTML error page will not render)`,
    );
    assert.ok(bytes.length > 100, `${file} looks empty (${bytes.length} bytes)`);
  }
});

test('icon assets - file names follow the slug convention', () => {
  // The uploaded artwork arrived as "Codec-support .png" and
  // "browser-compatibility .png": a space before the extension and mixed case
  // both need encoding in a URL and are easy to break by hand again.
  for (const [slug, file] of Object.entries(TOOL_ICON_FILES)) {
    assert.equal(file, `${slug}.png`, `${slug} must map to ${slug}.png`);
    assert.doesNotMatch(file, /[^a-z0-9.-]/, `${file} must be lowercase with no spaces`);
  }
});

test('icon assets - the public path is built from the same map', () => {
  assert.equal(toolIconSrc('codec-support'), '/Icons/codec-support.png');
  assert.equal(toolIconSrc('permission-diagnostics'), null, 'no supplied artwork → SVG fallback');
});

test('icon assets - every primary catalog tool has supplied artwork', () => {
  for (const tool of TOOLS_REGISTRY) {
    assert.ok(toolIconSrc(tool.slug), `${tool.slug} must have a PNG in TOOL_ICON_FILES`);
  }
});

test('icon assets - supporting diagnostics use the supplied artwork, except the one without', () => {
  const withPng = SUPPORTING_REGISTRY.filter((tool) => toolIconSrc(tool.slug)).map((tool) => tool.slug);
  assert.deepEqual(
    [...withPng].sort(),
    [
      'browser-compatibility',
      'browser-system-info',
      'codec-support',
      'devicetry-storage-inspector',
      'webrtc-test',
    ],
    'exactly the five supplied supporting icons are used',
  );
  // Permission Diagnostics keeps its original shield SVG on purpose.
  assert.equal(toolIconSrc('permission-diagnostics'), null);
});
