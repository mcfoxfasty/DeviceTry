/**
 * Duplicate-delivery regression (lib/testing/deliver.ts).
 *
 * Real-device failure: one tap on "Download PDF report" produced TWO files —
 * a valid PDF and a `text.txt` whose entire contents were the PDF's filename.
 *
 * These tests drive the real delivery module with a fake browser so both
 * branches are exercised for real: a share sheet that accepts files, a share
 * that fails after the OS already took the file, and a platform with no file
 * sharing at all. Each asserts the single most important property: exactly
 * one file, never two.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { deliverOnce, DeliveryEnvironment } from '../lib/testing/deliver';

const FILENAME = 'devicetry-click-speed-test-2026-09-24T12-00-00-000Z.pdf';

function makeBlob(): Blob {
  return new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });
}

/** Records every artifact the user would end up with. */
function recorder() {
  const saved: Array<{ name: string; kind: 'file' | 'text' }> = [];
  let urlSeq = 0;
  const env: DeliveryEnvironment = {
    createObjectURL: () => `blob:fake/${++urlSeq}`,
    startDownload: (_url, name) => {
      saved.push({ name, kind: 'file' });
    },
  };
  return { env, saved };
}

test('delivery - a shareable platform delivers the file once and downloads nothing', async () => {
  const { env, saved } = recorder();
  const shared: ShareData[] = [];
  env.canShare = () => true;
  env.share = async (data) => {
    shared.push(data);
  };

  const result = await deliverOnce(makeBlob(), FILENAME, env);

  assert.equal(result.method, 'share');
  assert.equal(shared.length, 1, 'the share sheet is opened exactly once');
  assert.equal(saved.length, 0, 'no second file is downloaded alongside the share');
});

test('delivery - the share payload never carries a title (the text.txt cause)', async () => {
  const { env, saved } = recorder();
  const shared: ShareData[] = [];
  env.canShare = () => true;
  env.share = async (data) => {
    shared.push(data);
  };

  await deliverOnce(makeBlob(), FILENAME, env);

  const payload = shared[0];
  assert.equal(payload.title, undefined, 'title would be saved as a text.txt body by some targets');
  assert.equal((payload as { text?: string }).text, undefined, 'no plain-text payload is sent either');
  assert.equal(payload.files?.length, 1, 'exactly one file is shared');
  assert.equal(payload.files![0].name, FILENAME, 'the file itself carries the correct name');

  // A target that cannot carry files must find nothing to serialize as text.
  const serializableAsText = payload.title ?? (payload as { text?: string }).text;
  assert.equal(serializableAsText, undefined, 'there is no filename to leak into a text file');
  assert.equal(saved.filter((s) => s.name.endsWith('.txt')).length, 0, 'no .txt artifact is produced');
});

test('delivery - a share that fails after the OS took the file does NOT also download', async () => {
  // This is the second half of the duplicate bug: a rejected share used to
  // fall through to the download path, so a user who had already received the
  // PDF through the share sheet then got a second copy.
  const { env, saved } = recorder();
  env.canShare = () => true;
  env.share = async () => {
    throw new DOMException('Share failed', 'NotAllowedError');
  };

  const result = await deliverOnce(makeBlob(), FILENAME, env);

  assert.equal(result.shareAttempted, true);
  assert.equal(result.method, 'share', 'the attempted share is terminal for this action');
  assert.equal(saved.length, 0, 'no duplicate download follows a failed share');
});

test('delivery - a user-cancelled share produces no file at all and no download', async () => {
  const { env, saved } = recorder();
  env.canShare = () => true;
  env.share = async () => {
    throw new DOMException('cancelled', 'AbortError');
  };

  const result = await deliverOnce(makeBlob(), FILENAME, env);

  assert.equal(result.method, 'share');
  assert.equal(saved.length, 0, 'cancelling the sheet must not silently download a copy');
});

test('delivery - a platform without file sharing falls back to a single download', async () => {
  const { env, saved } = recorder();
  // e.g. desktop Chrome: `share` exists but `canShare({files})` is false.
  env.canShare = () => false;
  env.share = async () => {
    throw new Error('must not be called when files are not shareable');
  };

  const result = await deliverOnce(makeBlob(), FILENAME, env);

  assert.equal(result.method, 'download');
  assert.equal(result.shareAttempted, false);
  assert.deepEqual(saved, [{ name: FILENAME, kind: 'file' }], 'exactly one file, correctly named');
});

test('delivery - a platform with no Web Share at all still downloads once', async () => {
  const { env, saved } = recorder();
  // Neither share nor canShare is defined.
  const result = await deliverOnce(makeBlob(), FILENAME, env);
  assert.equal(result.method, 'download');
  assert.equal(saved.length, 1);
});

test('delivery - a throwing canShare is treated as unsupported, not as a crash', async () => {
  const { env, saved } = recorder();
  env.canShare = () => {
    throw new Error('boom');
  };
  env.share = async () => {
    throw new Error('must not run');
  };

  const result = await deliverOnce(makeBlob(), FILENAME, env);
  assert.equal(result.method, 'download');
  assert.equal(saved.length, 1, 'the user still gets exactly one file');
});

test('delivery - one tap never yields more than one artifact in any scenario', async () => {
  // Exhaustive sweep: whatever the browser does, the user gets at most the
  // single intended PDF. This is the property the device report violated.
  const scenarios: Array<[string, Partial<DeliveryEnvironment>]> = [
    ['share ok', { canShare: () => true, share: async () => {} }],
    ['share rejects', { canShare: () => true, share: async () => { throw new Error('x'); } }],
    ['share cancelled', { canShare: () => true, share: async () => { throw new DOMException('c', 'AbortError'); } }],
    ['not shareable', { canShare: () => false, share: async () => {} }],
    ['canShare throws', { canShare: () => { throw new Error('x'); }, share: async () => {} }],
  ];

  for (const [label, overrides] of scenarios) {
    const { env, saved } = recorder();
    Object.assign(env, overrides);
    await deliverOnce(makeBlob(), FILENAME, env);

    const total = saved.length;
    assert.ok(total <= 1, `${label}: produced ${total} files, expected at most 1`);
    for (const s of saved) {
      assert.equal(s.name, FILENAME, `${label}: only the intended PDF is produced`);
      assert.ok(s.name.endsWith('.pdf'), `${label}: no text artifact`);
    }
  }
});
