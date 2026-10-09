/**
 * Tester mount flags — the development-StrictMode remount regression.
 *
 * `reactStrictMode` is on (next.config.ts), so in development React mounts a
 * component, runs its effects, runs the cleanups, then mounts again — WITHOUT
 * re-initialising refs. A tester whose cleanup raises `unmountedRef.current =
 * true` and never lowers it is therefore "unmounted" for the rest of the
 * session in dev. The damage is invisible in production but fatal in the
 * preview: the microphone stops its own stream right after getUserMedia
 * resolves and sits on "Awaiting permission" forever, the voice recorder
 * silently refuses to start, and the webcam never adopts its stream.
 *
 * These components cannot be driven here (no DOM test environment), so the
 * invariant is locked at the source level: wherever the flag is raised, it
 * must also be lowered, and the lowering must come first. PitchDetectorTester
 * is the reference implementation and already passes this.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TESTER_DIR = 'components/tests';
const RAISE = 'unmountedRef.current = true';
const LOWER = 'unmountedRef.current = false';

test('tester mount flags - a ref raised by the unmount cleanup is lowered on mount', () => {
  const files = readdirSync(TESTER_DIR)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join(TESTER_DIR, name));

  const guarded: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const raised = source.indexOf(RAISE);
    if (raised === -1) continue; // this tester does not use the flag

    guarded.push(file);
    const lowered = source.indexOf(LOWER);
    assert.ok(
      lowered !== -1,
      `${file} raises ${RAISE} in its cleanup but never clears it on mount — ` +
        'development StrictMode would leave it permanently "unmounted"'
    );
    assert.ok(
      lowered < raised,
      `${file} must clear the flag in the effect body, BEFORE the cleanup raises it`
    );
  }

  // A path or naming change must not be able to make this test vacuous.
  assert.ok(
    guarded.length >= 4,
    `expected the permission-gated testers to use the flag (found ${guarded.length}: ${guarded.join(', ')})`
  );
});
