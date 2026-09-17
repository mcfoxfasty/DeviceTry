import test from 'node:test';
import assert from 'node:assert';
import { TOOLS_REGISTRY } from '../lib/tools/registry.js';

test('TOOLS_REGISTRY contains all 38 tools', () => {
  assert.strictEqual(TOOLS_REGISTRY.length, 38, 'Expected exactly 38 diagnostic tools');
});

test('Every tool definition has required fields and unique slugs', () => {
  const slugs = new Set<string>();
  const ids = new Set<string>();

  for (const tool of TOOLS_REGISTRY) {
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
