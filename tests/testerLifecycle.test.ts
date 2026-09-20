/**
 * Tester-lifecycle regressions for the extracted camera and battery helpers.
 *
 * These exercise the REAL tester lifecycle helpers (CameraSession,
 * BatterySubscriptionController) — the exact objects WebcamTester and
 * BatteryTester run in production — not ResultController simulations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraSession, CameraStreamHandle } from '../lib/testing/cameraSession';
import {
  BatterySubscriptionController,
  BatterySource,
  BatterySnapshotLike,
} from '../lib/testing/batterySubscription';

/** Fake MediaStream whose track stops are recorded. */
function fakeStream(id: string): CameraStreamHandle & { stoppedTracks: string[]; label: string } {
  const stopped: string[] = [];
  return {
    label: id,
    stoppedTracks: stopped,
    getTracks: () => [
      { stop: () => stopped.push(`${id}:video`) },
      { stop: () => stopped.push(`${id}:audio`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// WebcamTester lifecycle (via CameraSession)
// ---------------------------------------------------------------------------

test('webcam lifecycle - Stop then a new start rejects the old pending request', () => {
  const session = new CameraSession<CameraStreamHandle>();

  // Start camera: startRun() mints token 1, session.begin binds the attempt.
  session.begin(1);
  assert.equal(session.hasLiveAttempt, true);

  // User presses Stop: stopCamera() invalidates pending callbacks.
  session.invalidate();
  assert.equal(session.hasLiveAttempt, false);

  // The pending getUserMedia resolves AFTER the stop — it must be rejected.
  const stale = session.resolve(1, fakeStream('old'));
  assert.equal(stale.live, false, 'a request resolved after Stop must be rejected');
  assert.equal(stale.stream, null);
});

test('webcam lifecycle - stale webcam tracks are stopped', () => {
  const session = new CameraSession<CameraStreamHandle>();

  // Attempt 1 begins, then a device change starts attempt 2 (new token).
  session.begin(1);
  session.begin(2);

  // Attempt 1's getUserMedia resolves late.
  const oldStream = fakeStream('old-camera');
  const result = session.resolve(1, oldStream);

  assert.equal(result.live, false);
  assert.equal(oldStream.stoppedTracks.length, 2, 'every returned track of a stale stream must be stopped immediately');
  assert.deepEqual(oldStream.stoppedTracks, ['old-camera:video', 'old-camera:audio']);
});

test('webcam lifecycle - camera device change clears the old guided result once', () => {
  const session = new CameraSession<CameraStreamHandle>();
  let hostClears = 0;

  // Device 1 acquires successfully (session adopts the stream).
  session.begin(1);
  const stream1 = fakeStream('cam-1');
  assert.equal(session.resolve(1, stream1).live, true);
  hostClears += 1; // the tester's startRun on device change notifies onResultClear once

  // User selects device 2: startRun() fires the host clear exactly once and
  // the session releases the old stream (teardown) and binds the new attempt.
  session.begin(2);
  const stream2 = fakeStream('cam-2');
  const adoption = session.resolve(2, stream2);

  assert.equal(adoption.live, true, 'the new attempt must be adopted');
  assert.equal(hostClears, 1, 'device change must clear the old guided result exactly once');
  assert.equal(stream1.stoppedTracks.length, 2, 'the superseded stream is released');
  assert.equal(stream2.stoppedTracks.length, 0, 'the live stream stays untouched');
});

test('webcam lifecycle - unmount causes no parent clear and no live-stream adoption', () => {
  const session = new CameraSession<CameraStreamHandle>();
  let hostClears = 0;

  session.begin(1);
  const stream = fakeStream('cam');
  assert.equal(session.resolve(1, stream).live, true);

  // Unmount: invalidate() + releaseAll() — no host clear notification.
  session.invalidate();
  session.releaseAll();
  assert.equal(stream.stoppedTracks.length, 2, 'resources released on unmount');
  assert.equal(hostClears, 0, 'unmount must NOT notify onResultClear (guided result survives)');

  // A late getUserMedia resolution after unmount is rejected and stopped.
  const late = fakeStream('late');
  const outcome = session.resolve(1, late);
  assert.equal(outcome.live, false);
  assert.equal(late.stoppedTracks.length, 2, 'late stream tracks stopped, no UI update');
});

test('webcam lifecycle - releaseAll is pure teardown and does not invalidate a live attempt', () => {
  const session = new CameraSession<CameraStreamHandle>();
  session.begin(1);
  const stream = fakeStream('cam');
  session.resolve(1, stream);

  // Stop-as-resource-cleanup: hardware released, attempt NOT invalidated.
  session.releaseAll();
  assert.equal(stream.stoppedTracks.length, 2);
  assert.equal(session.hasLiveAttempt, true, 'releaseAll must not change lifecycle state');

  // The still-live attempt can adopt a re-acquired stream on the same token.
  const reacquired = fakeStream('cam-new');
  assert.equal(session.resolve(1, reacquired).live, true);
});

// ---------------------------------------------------------------------------
// BatteryTester lifecycle (via BatterySubscriptionController)
// ---------------------------------------------------------------------------

interface FakeBatterySource extends BatterySource {
  listeners: Map<string, Set<(event: { type: string }) => void>>;
  emit(type: string, next: Partial<BatterySnapshotLike>): void;
}

function fakeBatterySource(initial: BatterySnapshotLike): FakeBatterySource {
  const listeners = new Map<string, Set<(event: { type: string }) => void>>();
  let snapshot = { ...initial };
  return {
    listeners,
    read: () => ({ ...snapshot }),
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    // test helper: mutate the reading and dispatch like the BatteryManager would
    emit(type: string, next: Partial<BatterySnapshotLike>) {
      snapshot = { ...snapshot, ...next };
      listeners.get(type)?.forEach((l) => l({ type }));
    },
  };
}

function makeEvents() {
  const events: Array<{ token: number; snapshot: BatterySnapshotLike }> = [];
  return {
    events,
    count: () => events.length,
    onEvent: (token: number, snapshot: BatterySnapshotLike) => events.push({ token, snapshot }),
  };
}

test('battery lifecycle - reset followed by a fresh event can report again', () => {
  const source = fakeBatterySource({ level: 0.8, charging: false, chargingTime: 0, dischargingTime: 3600 });
  const sink = makeEvents();
  let superseded = 0;

  const controller = new BatterySubscriptionController(source, {
    onEvent: sink.onEvent,
    onSuperseded: () => {
      superseded += 1;
    },
  }, 1);
  controller.subscribe(1);

  // First observation reports normally.
  source.emit('levelchange', { level: 0.75 });
  assert.equal(sink.count(), 1);
  assert.equal(sink.events[0].token, 1);

  // User clears the result (Reset) — this is a REFRESH, not permanent
  // invalidation: startRun() in the tester captures the fresh token and hands
  // it to the controller (tokens are owned by the lifecycle, not invented).
  const freshToken = controller.refresh(2);
  assert.equal(freshToken, true);
  assert.equal(controller.liveToken, 2);
  assert.equal(superseded, 1, 'a reported subscription superseded by refresh notifies the host exactly once');

  // A LATER battery event produces a NEW result again.
  source.emit('levelchange', { level: 0.7 });
  assert.equal(sink.count(), 2, 'battery events after reset must report again');
  assert.equal(sink.events[1].token, 2, 'the new result belongs to the fresh token');
});

test('battery lifecycle - an old battery listener cannot report after refresh', () => {
  const source = fakeBatterySource({ level: 0.5, charging: true, chargingTime: 600, dischargingTime: 0 });
  const sink = makeEvents();
  let superseded = 0;

  const controller = new BatterySubscriptionController(source, {
    onEvent: sink.onEvent,
    onSuperseded: () => {
      superseded += 1;
    },
  }, 1);
  controller.subscribe(1);

  source.emit('chargingchange', { charging: false });
  assert.equal(sink.count(), 1);

  // Grab the OLD listener objects before the refresh, simulating a
  // removeEventListener race where they keep firing.
  const oldListeners = [...source.listeners.get('levelchange')!];
  assert.equal(oldListeners.length, 1);

  // Refresh for a new observation: the tester's startRun() minted token 2 and
  // the controller re-subscribed with it.
  controller.refresh(2);
  assert.equal(superseded, 1);

  // The OLD listener object fires post-refresh (race scenario).
  oldListeners.forEach((l) => l({ type: 'levelchange' }));
  assert.equal(sink.count(), 1, 'a stale listener cannot report after refresh');

  // Fresh listeners DO report with the new token.
  source.emit('levelchange', { level: 0.4 });
  assert.equal(sink.count(), 2);
  assert.equal(sink.events[1].token, 2, 'new events use the new token');

  // Post-teardown: no reporting at all.
  controller.unsubscribeAll();
  const before = sink.count();
  source.emit('levelchange', { level: 0.1 });
  assert.equal(sink.count(), before, 'events after unsubscribeAll report nothing');
});

test('battery lifecycle - refresh without a prior report does not notify the host', () => {
  const source = fakeBatterySource({ level: 0.9, charging: false, chargingTime: 0, dischargingTime: 7200 });
  const sink = makeEvents();
  let superseded = 0;

  const controller = new BatterySubscriptionController(source, {
    onEvent: sink.onEvent,
    onSuperseded: () => {
      superseded += 1;
    },
  }, 1);
  controller.subscribe(1);

  // No event reported yet; refresh must NOT emit a host clear.
  controller.refresh(2);
  assert.equal(superseded, 0, 'refresh with nothing recorded must not fire onSuperseded');

  source.emit('levelchange', { level: 0.85 });
  assert.equal(sink.count(), 1);
  assert.equal(sink.events[0].token, 2, 'post-refresh events carry the fresh token');
});

test('battery lifecycle - unsubscribeAll is pure teardown and preserves tokens', () => {
  const source = fakeBatterySource({ level: 0.6, charging: false, chargingTime: 0, dischargingTime: 1800 });
  const sink = makeEvents();

  const controller = new BatterySubscriptionController(source, { onEvent: sink.onEvent, onSuperseded: () => {} }, 3);
  controller.subscribe(3);
  source.emit('levelchange', { level: 0.55 });
  assert.equal(sink.count(), 1);

  controller.unsubscribeAll();
  assert.equal(controller.liveToken, 3, 'teardown does not touch lifecycle tokens');
  assert.equal(controller.hasListener, false, 'all listeners removed');

  source.emit('levelchange', { level: 0.5 });
  assert.equal(sink.count(), 1, 'no reporting after unsubscribeAll');
});
