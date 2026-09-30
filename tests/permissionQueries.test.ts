/**
 * Permission diagnostics regressions.
 *
 * The previous implementation reported "passed" whenever nothing was denied —
 * including the case where every single query had failed and nothing had been
 * learned. These tests pin the corrected behaviour.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSION_QUERIES,
  PermissionRow,
  countPermissionStates,
  hasQueryablePermissionsApi,
  runPermissionQueries,
  summarizePermissionQuery,
} from '../lib/testing/permissionQueries';

const SPECS = [
  { name: 'microphone', label: 'Microphone' },
  { name: 'camera', label: 'Camera' },
  { name: 'midi', label: 'MIDI Access' },
];

test('permission queries - a queryable API is detected by a callable query function', () => {
  assert.equal(hasQueryablePermissionsApi({ permissions: { query: () => undefined } }), true);
  assert.equal(hasQueryablePermissionsApi({ permissions: {} }), false, 'a non-callable query is not usable');
  assert.equal(hasQueryablePermissionsApi({}), false);
  assert.equal(hasQueryablePermissionsApi(null), false);
});

test('permission queries - each state is tracked distinctly', async () => {
  const rows = await runPermissionQueries(async ({ name }) => {
    if (name === 'microphone') return { state: 'granted' };
    if (name === 'camera') return { state: 'denied' };
    throw new TypeError(`${name} is not a valid permission name`);
  }, SPECS);

  assert.deepEqual(rows.map((r) => r.state), ['granted', 'denied', 'error']);
  assert.match(String(rows[2].detail), /not a valid permission name/);
  assert.deepEqual(countPermissionStates(rows), {
    granted: 1,
    prompt: 0,
    denied: 1,
    unqueryable: 0,
    error: 1,
    checked: 2,
    total: 3,
  });
});

test('permission queries - an unrecognised state is not treated as evidence', async () => {
  const rows = await runPermissionQueries(async () => ({ state: 'maybe-ish' }), SPECS);
  assert.ok(rows.every((row) => row.state === 'error'));
  assert.match(String(rows[0].detail), /unrecognised state/);
});

test('permission queries - a rejected query becomes an error row, never a pass', async () => {
  const rows = await runPermissionQueries(async () => {
    throw new Error('SecurityError');
  }, SPECS);
  assert.ok(rows.every((row) => row.state === 'error'));
  const summary = summarizePermissionQuery(rows, true);
  assert.equal(summary.status, 'inconclusive');
  assert.notEqual(summary.status, 'passed');
});

test('permission queries - no queryable permission at all is inconclusive, never passed', () => {
  const rows: PermissionRow[] = PERMISSION_QUERIES.map((spec) => ({ ...spec, state: 'unqueryable' }));
  const summary = summarizePermissionQuery(rows, true);

  assert.equal(summary.status, 'inconclusive');
  assert.match(summary.details, /No permission could be queried/);
  assert.match(summary.details, /This is not a pass/);
  assert.equal(summary.counts.checked, 0);
  assert.equal(summary.unknownNames.length, PERMISSION_QUERIES.length);
});

test('permission queries - a missing Permissions API is unsupported, with an explanation', () => {
  const summary = summarizePermissionQuery([], false);
  assert.equal(summary.status, 'unsupported');
  assert.match(summary.details, /navigator\.permissions\.query\(\) is not available/);
  assert.match(summary.details, /Nothing is known/);
});

test('permission queries - partial coverage discloses exactly what is unknown', () => {
  const rows: PermissionRow[] = [
    { name: 'microphone', label: 'Microphone', state: 'granted' },
    { name: 'camera', label: 'Camera', state: 'denied' },
    { name: 'geolocation', label: 'Geolocation', state: 'unqueryable' },
    { name: 'midi', label: 'MIDI Access', state: 'error', detail: 'boom' },
  ];
  const summary = summarizePermissionQuery(rows, true);

  assert.equal(summary.status, 'warning');
  assert.match(summary.details, /Blocked: Camera/);
  assert.match(summary.details, /Checked 2 of 4/);
  assert.match(summary.details, /unknown: Geolocation, MIDI Access/);
  assert.deepEqual(summary.unknownNames, ['Geolocation', 'MIDI Access']);
});

test('permission queries - prompt is never treated as granted', () => {
  const rows: PermissionRow[] = [
    { name: 'microphone', label: 'Microphone', state: 'prompt' },
    { name: 'camera', label: 'Camera', state: 'prompt' },
  ];
  const summary = summarizePermissionQuery(rows, true);

  assert.equal(summary.counts.granted, 0);
  assert.equal(summary.counts.prompt, 2);
  assert.match(summary.details, /Not yet decided: Microphone, Camera/);
  assert.match(summary.details, /a granted state does not prove a microphone or camera delivers sound or video/i);
  assert.doesNotMatch(summary.details, /Granted:/);
});

test('permission queries - nothing blocked reports measured, never passed', () => {
  const rows: PermissionRow[] = [
    { name: 'microphone', label: 'Microphone', state: 'granted' },
    { name: 'camera', label: 'Camera', state: 'granted' },
  ];
  const summary = summarizePermissionQuery(rows, true);

  assert.equal(summary.status, 'measured');
  assert.notEqual(summary.status, 'passed');
  assert.match(summary.details, /Granted: 2/);
  assert.match(summary.details, /All 2 names returned a state/);
});

test('permission queries - the default query list is read-only in shape', () => {
  // Only descriptor names — no getUserMedia, no permission request anywhere.
  for (const spec of PERMISSION_QUERIES) {
    assert.equal(typeof spec.name, 'string');
    assert.equal(typeof spec.label, 'string');
    assert.doesNotMatch(spec.name, /[(){}]/);
  }
});
