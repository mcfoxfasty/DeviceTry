import test from 'node:test';
import assert from 'node:assert/strict';
import {
  forwardGenericResult,
  forwardRichResult,
} from '../lib/testing/resultPolicy';
import { calculateReportStatus } from '../lib/testing/reportStatus';
import { TOOLS_REGISTRY, ALL_TOOL_PAGES } from '../lib/tools/registry.js';
import { TESTER_COMPONENTS } from '../components/ToolRenderer';

test('forwarding policy - generic results forward everything except skipped', () => {
  assert.equal(forwardGenericResult('passed'), true);
  assert.equal(forwardGenericResult('warning'), true);
  assert.equal(forwardGenericResult('failed'), true);
  assert.equal(forwardGenericResult('inconclusive'), true);
  assert.equal(forwardGenericResult('unsupported'), true, 'unsupported must forward on generic hosts');
  assert.equal(forwardGenericResult('skipped'), false, 'skipped means "not attempted" - a missing result already maps to inconclusive');
});

test('forwarding policy - rich results never forward unsupported or skipped', () => {
  assert.equal(forwardRichResult('passed'), true);
  assert.equal(forwardRichResult('warning'), true);
  assert.equal(forwardRichResult('failed'), true);
  assert.equal(forwardRichResult('inconclusive'), true);
  assert.equal(forwardRichResult('unsupported'), false, 'rich report payloads have no unsupported member');
  assert.equal(forwardRichResult('skipped'), false);
});

test('forwarding policy - dropped skipped results still yield inconclusive reports', () => {
  // Simulates a report where a test was skipped: its absence (nothing forwarded)
  // must map to 'inconclusive', never silently 'passed'.
  const status = calculateReportStatus(['mic', 'webcam', 'speakers'], {
    mic: { status: 'passed' },
    webcam: { status: 'passed' },
    // speakers skipped -> not recorded
  });
  assert.equal(status, 'inconclusive');
});

test('every registry componentName resolves to a real tester component', () => {
  // ALL_TOOL_PAGES covers primary + supporting: every routable page must render.
  const missing = ALL_TOOL_PAGES.filter((tool) => !TESTER_COMPONENTS[tool.componentName]);
  assert.deepEqual(
    missing.map((tool) => `${tool.id}:${tool.componentName}`),
    [],
    'registry tools with no registered tester component would render nothing'
  );
});

test('renderer covers flagship testers and no duplicate registrations', () => {
  // BatteryTester is intentionally absent: battery-monitor was retired from
  // the public catalog in Phase 9; the component remains for guided
  // inspection only and is mounted directly, not via ToolRenderer.
  for (const name of ['MicrophoneTester', 'WebcamTester', 'SpeakersTester', 'KeyboardTester', 'MouseTester', 'GamepadTester']) {
    assert.ok(TESTER_COMPONENTS[name], `${name} must be registered`);
  }
  const registered = Object.keys(TESTER_COMPONENTS);
  assert.equal(new Set(registered).size, registered.length, 'duplicate tester registrations');
  assert.equal(registered.length, ALL_TOOL_PAGES.length, 'renderer map must cover exactly the routable tool pages');
});
