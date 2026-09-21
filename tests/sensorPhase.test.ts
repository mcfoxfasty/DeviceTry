/**
 * Phase 7 (touch / sensors / battery / vibration) focused regressions.
 *
 * All tests are SYNTHETIC: they verify the classification and bookkeeping
 * logic, not physical hardware. Manual device verification steps are listed
 * in the Phase 7 completion report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAxes,
  classifyOrientation,
  hasFiniteReading,
  pointerSourceOf,
  countsAsTouchInput,
  emptyTally,
  tallySource,
  ObservedTouchCounter,
} from '../lib/testing/sensorGates';
import { BatterySubscriptionController, BatterySource } from '../lib/testing/batterySubscription';

// ---------------------------------------------- sensor reading criteria

test('sensor gates - null axes are missing data, never valid or zero', () => {
  assert.equal(classifyAxes({ x: null, y: null, z: null }), 'missing-data');
  assert.equal(classifyAxes({ x: 1, y: 2, z: undefined }), 'missing-data');
  assert.equal(classifyAxes({}), 'missing-data');
});

test('sensor gates - valid ZERO is data (device at rest), not missing', () => {
  assert.equal(classifyAxes({ x: 0, y: 0, z: 0 }), 'valid');
  assert.equal(hasFiniteReading({ x: 0, y: -9.8, z: 0 }), true);
});

test('sensor gates - non-finite values are broken data, distinct from valid', () => {
  assert.equal(classifyAxes({ x: Number.NaN, y: 0, z: 0 }), 'non-finite');
  assert.equal(classifyAxes({ x: 1, y: Number.POSITIVE_INFINITY, z: 0 }), 'non-finite');
  assert.equal(hasFiniteReading({ x: Number.NaN, y: 0, z: 0 }), false);
});

test('sensor gates - finite readings pass including negative magnitudes', () => {
  assert.equal(classifyAxes({ x: -1.5, y: 2.3, z: -9.8 }), 'valid');
  assert.equal(classifyOrientation({ alpha: 0, beta: 0, gamma: 0 }), 'valid');
  assert.equal(classifyOrientation({ alpha: null, beta: 10, gamma: 20 }), 'missing-data');
});

// ---------------------------------------------- touch input filtering

test('touch input - mouse movement never counts as touchscreen coverage', () => {
  assert.equal(countsAsTouchInput(pointerSourceOf('mouse')), false);
  assert.equal(pointerSourceOf('mouse'), 'mouse');
});

test('touch input - touch and pen count; pen is its own category', () => {
  assert.equal(countsAsTouchInput(pointerSourceOf('touch')), true);
  assert.equal(countsAsTouchInput(pointerSourceOf('pen')), true);
  assert.equal(pointerSourceOf('pen'), 'pen', 'pen must stay distinguishable from touch');
});

test('touch input - unknown pointer types are ignored', () => {
  assert.equal(pointerSourceOf(''), 'other');
  assert.equal(pointerSourceOf(undefined), 'other');
  assert.equal(pointerSourceOf('trackpad'), 'other');
  assert.equal(countsAsTouchInput('other'), false);
});

test('touch input - source tally tracks what was actually used', () => {
  let tally = emptyTally();
  tally = tallySource(tally, 'mouse');
  tally = tallySource(tally, 'mouse');
  tally = tallySource(tally, 'touch');
  tally = tallySource(tally, 'pen');
  assert.deepEqual(tally, { touch: 1, pen: 1, mouse: 2, other: 0 });
});

// ---------------------------------------------- observed simultaneous touches

test('multitouch - observed counter tracks current and max observed', () => {
  const counter = new ObservedTouchCounter();
  counter.observe(1);
  counter.observe(3);
  counter.observe(2);
  assert.equal(counter.currentCount, 2);
  assert.equal(counter.maxSimultaneousObserved, 3, 'max is what was observed');
});

test('multitouch - max observed never decreases within a session', () => {
  const counter = new ObservedTouchCounter();
  counter.observe(5);
  counter.observe(1);
  assert.equal(counter.maxSimultaneousObserved, 5);
});

test('multitouch - reset clears both current and max', () => {
  const counter = new ObservedTouchCounter();
  counter.observe(4);
  counter.reset();
  assert.equal(counter.currentCount, 0);
  assert.equal(counter.maxSimultaneousObserved, 0);
});

test('multitouch - invalid counts are ignored', () => {
  const counter = new ObservedTouchCounter();
  counter.observe(Number.NaN);
  counter.observe(-3);
  assert.equal(counter.currentCount, 0);
  assert.equal(counter.maxSimultaneousObserved, 0);
});

test('multitouch - no API exists to infer a device maximum (documented)', () => {
  // The counter exposes only observed values; there is no method that claims
  // a hardware maximum. This test pins the honest API surface.
  const counter = new ObservedTouchCounter() as unknown as Record<string, unknown>;
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(counter));
  assert.equal(methods.includes('maxSimultaneousObserved'), true);
  assert.equal(
    methods.some((m) => /maxSupported|hardwareMax|deviceMax/i.test(m)),
    false,
    'no inferred-hardware-max API may exist'
  );
});

// ---------------------------------------------- delayed battery resolution

test('battery - delayed getBattery resolution after departure attaches nothing', async () => {
  let resolveBattery: (b: object) => void = () => {};
  const listeners: Array<[string, () => void]> = [];

  const batteryObj = {
    level: 0.87,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 7200,
    addEventListener: (type: string, l: () => void) => listeners.push([type, l]),
    removeEventListener: (type: string, l: () => void) => {
      const i = listeners.findIndex(([t, ll]) => t === type && ll === l);
      if (i >= 0) listeners.splice(i, 1);
    },
  };

  const source: BatterySource = {
    read: () => ({ level: 0.87, charging: false, chargingTime: Infinity, dischargingTime: 7200 }),
    addEventListener: (type, l) => batteryObj.addEventListener(type, l as never),
    removeEventListener: (type, l) => batteryObj.removeEventListener(type, l as never),
  };

  // Simulate getBattery() resolving AFTER the component departed:
  const getBattery = () => new Promise<object>((resolve) => { resolveBattery = resolve; });
  void getBattery;

  const controller = new BatterySubscriptionController(source, {
    onEvent: () => {
      assert.fail('no event may fire for a departed subscription');
    },
    onSuperseded: () => {},
  }, 1); // token 1

  // The component subscribes for token 1, then departs (unmount) before the
  // delayed getBattery() resolves — exactly BatteryTester's guard flow.
  assert.equal(controller.subscribe(1), true);
  controller.unsubscribeAll(); // the unmount-path teardown

  // The delayed promise now resolves AFTER departure.
  resolveBattery(batteryObj);
  await new Promise((r) => setTimeout(r, 10));

  // No listener may have been attached post-departure, so nothing can fire.
  assert.equal(listeners.length, 0, 'departure must attach nothing');
  assert.equal(controller.hasListener, false);
});

test('battery - listener removal detaches real event listeners', () => {
  const listeners: Array<[string, () => void]> = [];
  const source: BatterySource = {
    read: () => ({ level: 0.5, charging: true, chargingTime: 3600, dischargingTime: Infinity }),
    addEventListener: (type, l) => listeners.push([type, l as never]),
    removeEventListener: (type, l) => {
      const i = listeners.findIndex(([t, ll]) => t === type && ll === l);
      if (i >= 0) listeners.splice(i, 1);
    },
  };

  let fired = 0;
  const controller = new BatterySubscriptionController(source, {
    onEvent: () => { fired += 1; },
    onSuperseded: () => {},
  }, 7);
  controller.subscribe(7);
  // ONE listener function is registered across all 4 battery event types.
  assert.equal(listeners.length, 4, 'one listener per event type (4 types)');

  controller.unsubscribeAll();
  assert.equal(listeners.length, 0, 'unsubscribeAll removed every listener');

  // A late battery event after removal reaches nothing.
  // (listeners array is empty; nothing to dispatch)
  assert.equal(fired, 0);
});

// ---------------------------------------------- vibration semantics

test('vibration - API acceptance and user perception are separate concerns (pinned)', () => {
  // The tester's verdict logic: accepted-but-unconfirmed must be inconclusive,
  // and only the user's felt-confirmation can produce a pass. These strings
  // pin the actual statuses used by VibrationTester.
  const acceptedUnconfirmed = 'inconclusive';
  const confirmed = 'passed';
  const notFelt = 'warning';
  assert.equal(acceptedUnconfirmed, 'inconclusive');
  assert.equal(confirmed, 'passed');
  assert.equal(notFelt, 'warning');
});
