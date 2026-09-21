import test from 'node:test';
import assert from 'node:assert';
import { TOOLS_REGISTRY, SUPPORTING_REGISTRY, ALL_TOOL_PAGES } from '../lib/tools/registry.js';
import { FINAL_CATALOG } from '../lib/tools/migration.js';

test('TOOLS_REGISTRY contains exactly the 15 primary Phase 9 tools', () => {
  assert.strictEqual(TOOLS_REGISTRY.length, 15, 'Primary catalog must hold exactly 15 tools');
});

test('SUPPORTING_REGISTRY holds the 6 supporting diagnostics', () => {
  assert.strictEqual(SUPPORTING_REGISTRY.length, 6, 'Supporting registry must hold exactly 6 tools');
  assert.strictEqual(ALL_TOOL_PAGES.length, 21, '21 routable tool pages total');
});

test('Final catalog matches the migration map exactly', () => {
  const primary = TOOLS_REGISTRY.map((tool) => tool.slug);
  assert.deepEqual(primary, [...FINAL_CATALOG]);
});

test('No retired tool remains in any public registry', () => {
  const retired = new Set([
    'battery-monitor',
    'accelerometer-test',
    'gyroscope-test',
    'vibration-test',
    'clipboard-test',
    'browser-storage-test',
    'clock-timezone',
    'offline-check',
    'font-rendering',
    'canvas-benchmark',
    'javascript-benchmark',
    'webassembly-benchmark',
    'webgl-test',
    'instrument-tuner',
    'metronome',
  ]);
  for (const tool of ALL_TOOL_PAGES) {
    assert.equal(retired.has(tool.slug), false, `Retired tool ${tool.slug} leaked into a registry`);
    assert.equal(retired.has(tool.id), false, `Retired tool id ${tool.id} leaked into a registry`);
  }
});

test('Every tool definition has required fields and unique slugs', () => {
  const slugs = new Set<string>();
  const ids = new Set<string>();

  for (const tool of ALL_TOOL_PAGES) {
    assert.ok(tool.id, 'Tool missing ID');
    assert.ok(tool.slug, `Tool ${tool.id} missing slug`);
    assert.ok(tool.title, `Tool ${tool.id} missing title`);
    assert.ok(tool.instructions.length > 0, `Tool ${tool.id} missing instructions`);
    assert.ok(tool.limitations.length > 0, `Tool ${tool.id} missing limitations`);
    assert.ok(tool.troubleshooting.length > 0, `Tool ${tool.id} missing troubleshooting`);
    assert.ok(
      tool.keywords.every((k) => /^[\x20-\x7E]+$/.test(k)),
      `Tool ${tool.id} has non-English keywords`
    );

    assert.ok(!slugs.has(tool.slug), `Duplicate slug detected: ${tool.slug}`);
    assert.ok(!ids.has(tool.id), `Duplicate ID detected: ${tool.id}`);

    slugs.add(tool.slug);
    ids.add(tool.id);
  }
});

test('Every relatedToolIds resolves against the final registries', () => {
  const knownIds = new Set(ALL_TOOL_PAGES.map((tool) => tool.id));

  for (const tool of ALL_TOOL_PAGES) {
    for (const rel of tool.relatedToolIds) {
      assert.ok(knownIds.has(rel), `${tool.id} references unknown related tool "${rel}"`);
      assert.equal(
        retired(rel),
        false,
        `${tool.id} links to retired tool "${rel}"`
      );
    }
  }
});

test('Every supportLink href is a local route that exists', () => {
  const routable = new Set<string>(ALL_TOOL_PAGES.map((tool) => `/test/${tool.slug}`));
  routable.add('/guides');

  for (const tool of ALL_TOOL_PAGES) {
    for (const link of tool.supportLinks ?? []) {
      assert.equal(link.href.startsWith('/'), true, `${tool.id} supportLink must be local`);
      assert.equal(
        routable.has(link.href) || link.href.startsWith('/guides/'),
        true,
        `${tool.id} supportLink points at unknown route ${link.href}`
      );
    }
  }
});

function retired(slug: string): boolean {
  const retiredSlugs = [
    'battery-monitor',
    'accelerometer-test',
    'gyroscope-test',
    'vibration-test',
    'clipboard-test',
    'browser-storage-test',
    'clock-timezone',
    'offline-check',
    'font-rendering',
    'canvas-benchmark',
    'javascript-benchmark',
    'webassembly-benchmark',
    'webgl-test',
    'instrument-tuner',
    'metronome',
  ];
  return retiredSlugs.includes(slug);
}
