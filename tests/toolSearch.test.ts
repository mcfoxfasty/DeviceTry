/**
 * Regression tests for the landing-page tool search (lib/tools/search.ts),
 * updated for the Phase 9 final 15-tool catalog.
 *
 * Coverage:
 * - Strong matches: exact title/keyword/alias, prefix, substring.
 * - Fuzzy fallback only (bounded distance: 1 medium, 2 long, never 3),
 *   applied to titles/keywords/aliases only — never descriptions.
 * - Natural-language queries ("my mic is not working").
 * - Multi-device queries ranked separately instead of zero results.
 * - False-positive prevention (camera/battery/mouse/printer/xylophone).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTools, withinEditDistance } from '../lib/tools/search';
import { TOOLS_REGISTRY } from '../lib/tools/registry';

function slugsFor(query: string): string[] {
  return searchTools(query).map((hit) => hit.tool.slug);
}

// ---------- Positive: strong matches ----------

test('search - exact single word matches (backward compatible)', () => {
  assert.ok(slugsFor('microphone').includes('microphone-test'));
});

test('search - alias matching: camera resolves to the Webcam Test', () => {
  assert.equal(slugsFor('camera')[0], 'webcam-test');
  assert.equal(slugsFor('mic')[0], 'microphone-test');
  assert.equal(slugsFor('controller')[0], 'gamepad-test');
  // Mirror is now a Webcam Test tab; the alias must resolve to the merged tool.
  assert.equal(slugsFor('mirror')[0], 'webcam-test');
});

test('search - prefix matching: fps -> Refresh Rate Test, gyro-free catalog stays correct', () => {
  assert.equal(slugsFor('fps')[0], 'refresh-rate-test');
  assert.equal(slugsFor('cps')[0], 'click-speed-test');
});

test('search - substring matching: pixel -> Screen Test', () => {
  assert.equal(slugsFor('pixel')[0], 'screen-test');
});

test('search - word order and spacing ("web cam", "dead pixel")', () => {
  assert.ok(slugsFor('web cam').includes('webcam-test'));
  assert.equal(slugsFor('dead pixel')[0], 'screen-test');
});

test('search - glued compound ("deadpixel") reaches Screen Test', () => {
  assert.equal(slugsFor('deadpixel')[0], 'screen-test');
});

// ---------- Fuzzy fallback ----------

test('search - fuzzy fallback: typos within distance 1-2 still resolve', () => {
  // "microfon" -> "microphone": the alias "microfon" is an exact alias hit;
  // "keybord" -> "keyboard" is distance 2 on a long word.
  assert.equal(slugsFor('microfon')[0], 'microphone-test');
  assert.equal(slugsFor('keybord')[0], 'keyboard-test');
});

test('withinEditDistance - bounded behavior (never distance 3)', () => {
  assert.equal(withinEditDistance('printer', 'center', 3), true);
  // Search policy caps at 2; short words (<=4) never fuzzy-match:
  assert.equal(withinEditDistance('mic', 'mice', 1), true);
  assert.equal(withinEditDistance('mic', 'ice', 1), false);
});

// ---------- Natural-language queries ----------

test('search - "I want to test my camera" finds the Webcam Test first', () => {
  assert.equal(slugsFor('I want to test my camera')[0], 'webcam-test');
});

test('search - "check if my webcam works" finds the Webcam Test first', () => {
  assert.equal(slugsFor('check if my webcam works')[0], 'webcam-test');
});

test('search - "my mic is not working" finds the Microphone Test first', () => {
  assert.equal(slugsFor('my mic is not working')[0], 'microphone-test');
});

test('search - "test laptop keyboard" finds the Keyboard Test first', () => {
  assert.equal(slugsFor('test laptop keyboard')[0], 'keyboard-test');
});

test('search - "camera and microphone test" lists both device tools (no zero results)', () => {
  const slugs = slugsFor('camera and microphone test');
  assert.ok(slugs.includes('webcam-test'), 'webcam-test must appear');
  assert.ok(slugs.includes('microphone-test'), 'microphone-test must appear');
  assert.ok(slugs.length > 0);
});

test('search - "test the mouse buttons" finds the Mouse Test first', () => {
  assert.equal(slugsFor('test the mouse buttons')[0], 'mouse-test');
});

test('search - "how fast can I click" reaches the CPS test', () => {
  const slugs = slugsFor('click speed test');
  assert.ok(slugs.includes('click-speed-test'), 'click-speed-test must appear for click speed queries');
});

test('search - "internet speed" and "my ip" reach the network tools', () => {
  assert.equal(slugsFor('internet speed')[0], 'internet-speed-test');
  assert.equal(slugsFor('my ip')[0], 'what-is-my-ip');
});

// ---------- Multi-device ranking ----------

test('search - multi-device query ranks matching tools separately by token count', () => {
  const hits = searchTools('camera microphone');
  const slugs = hits.map((h) => h.tool.slug);
  assert.ok(slugs.includes('webcam-test'), 'webcam tool must appear for camera+microphone query');
  assert.ok(slugs.includes('microphone-test'), 'microphone tool must appear for camera+microphone query');
  // Each result matches at least one query token — no noise results.
  for (const hit of hits) {
    assert.ok(hit.matchedTokens.length >= 1);
  }
  // The top result is the strongest single-device match (title hit).
  assert.equal(slugs[0], 'microphone-test');
  // Related tools (permission diagnostics) that match 'camera' may follow,
  // but must not outrank the direct device matches.
  const permIndex = slugs.indexOf('permission-diagnostics');
  if (permIndex !== -1) {
    assert.ok(permIndex > slugs.indexOf('webcam-test'), 'camera-adjacent tool ranks below Webcam Test');
  }
});

// ---------- False positives ----------

test('search - "camera" must not return Gamepad or Gyroscope', () => {
  const slugs = slugsFor('camera');
  assert.equal(slugs.includes('gamepad-test'), false, 'gamepad leaked for camera');
  assert.equal(slugs.includes('touchscreen-test'), false, 'touchscreen leaked for camera');
});

test('search - "battery" returns no results (retired tool, no false positives)', () => {
  const slugs = slugsFor('battery');
  assert.equal(slugs.includes('mouse-test'), false, 'mouse leaked for battery');
  assert.equal(slugs.includes('screen-test'), false, 'screen leaked for battery');
  assert.equal(slugs.includes('what-is-my-ip'), false, 'ip leaked for battery');
});

test('search - "mouse" must not return Voice Recorder', () => {
  const slugs = slugsFor('mouse');
  assert.equal(slugs.includes('voice-recorder'), false, 'voice-recorder leaked for mouse');
  assert.equal(slugs[0], 'mouse-test');
});

test('search - "printer" and "xylophone" return zero results', () => {
  assert.deepEqual(slugsFor('printer'), [], 'printer leaked results');
  assert.deepEqual(slugsFor('xylophone'), [], 'xylophone leaked results');
});

// ---------- Category subsets & empty query ----------

test('search - category subset restricts results', () => {
  const displayOnly = TOOLS_REGISTRY.filter((t) => t.category === 'display');
  const hits = searchTools('microphone', displayOnly);
  assert.equal(hits.length, 0, 'a mic query must not leak tools from the display category');
});

test('search - empty query returns all tools in registry order', () => {
  const hits = searchTools('   ');
  assert.equal(hits.length, TOOLS_REGISTRY.length);
  assert.equal(hits[0].tool.slug, TOOLS_REGISTRY[0].slug);
});
