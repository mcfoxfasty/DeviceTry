/**
 * Phase 5 (WebAssembly) focused regressions.
 *
 * Node.js IS the "appropriate known-support runtime" here: it ships V8 with
 * all probed features enabled, so a VALID probe must validate(true). A probe
 * that failed validation in this runtime would be a malformed binary (code
 * bug), which is exactly what the audit found.
 *
 * These are synthetic algorithm tests — no claim is made that every browser
 * engine supports every optional feature.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIMD_PROBE,
  BULK_MEMORY_PROBE,
  REFERENCE_TYPES_PROBE,
  validateProbe,
  probeFeatures,
  jsFib,
  computeSpeedup,
  MIN_RELIABLE_DURATION_MS,
} from '../lib/testing/wasmProbes';

test('wasm probes - SIMD probe is a valid module in a known-support runtime', () => {
  assert.equal(validateProbe(SIMD_PROBE), true, 'SIMD probe malformed (V8 supports SIMD)');
});

test('wasm probes - Bulk Memory probe is valid in a known-support runtime', () => {
  assert.equal(validateProbe(BULK_MEMORY_PROBE), true, 'bulk memory probe malformed');
});

test('wasm probes - Reference Types probe is valid in a known-support runtime', () => {
  assert.equal(validateProbe(REFERENCE_TYPES_PROBE), true, 'reference-types probe malformed');
});

test('wasm probes - probeFeatures reports supported features in Node', () => {
  const probed = probeFeatures();
  assert.equal(probed.simd, true);
  assert.equal(probed.bulkMemory, true);
  assert.equal(probed.referenceTypes, true);
});

test('wasm probes - validateProbe returns null (not false) when probing is impossible', () => {
  // Remove the global to simulate a runtime without WebAssembly: the caller
  // must receive null = "unprobeable", never a false "unsupported".
  const globalWasm = (globalThis as { WebAssembly?: unknown }).WebAssembly;
  delete (globalThis as { WebAssembly?: unknown }).WebAssembly;
  try {
    assert.equal(validateProbe([0x00, 0x61]), null);
    assert.equal(probeFeatures().simd, null);
  } finally {
    (globalThis as { WebAssembly?: unknown }).WebAssembly = globalWasm;
  }
});

test('wasm probes - garbage bytes are false (rejected), distinct from null', () => {
  // In a runtime WITH validate, a malformed module is false — the same signal
  // as "feature unsupported". This is the documented, honest ambiguity of
  // validate-only probing; execution errors would be a separate signal.
  assert.equal(validateProbe([0x00, 0x61, 0x73]), false);
});

test('wasm fib - JS implementation matches the module output (parity)', () => {
  assert.equal(jsFib(30), 832040, 'fib(30) must equal 832040');
  assert.equal(jsFib(10), 55);
  assert.equal(jsFib(0), 0);
  assert.equal(jsFib(1), 1);
  assert.equal(jsFib(2), 1);
});

test('wasm speedup - ratio direction is JS duration / Wasm duration', () => {
  // Wasm twice as fast => JS took 2x longer => ratio 2.
  const fast = computeSpeedup(100, 50);
  assert.equal(fast.ratio, 2);
  assert.match(fast.label, /2\.00×/);
  // Wasm slower than JS => ratio below 1 (honest, not hidden).
  const slow = computeSpeedup(50, 100);
  assert.equal(slow.ratio, 0.5);
});

test('wasm speedup - zero durations never produce Infinity or fabricated ratios', () => {
  assert.equal(computeSpeedup(0, 50).ratio, null);
  assert.equal(computeSpeedup(50, 0).ratio, null);
  assert.equal(computeSpeedup(0, 0).ratio, null);
  assert.match(computeSpeedup(0, 50).label, /n\/a/);
});

test('wasm speedup - negative and non-finite durations are rejected', () => {
  assert.equal(computeSpeedup(-5, 50).ratio, null);
  assert.equal(computeSpeedup(50, -5).ratio, null);
  assert.equal(computeSpeedup(Number.NaN, 50).ratio, null);
  assert.equal(computeSpeedup(50, Number.POSITIVE_INFINITY).ratio, null);
});

test('wasm speedup - sub-resolution durations are reported as unmeasurable', () => {
  // 0.5 ms is below the documented reliability floor.
  const r = computeSpeedup(MIN_RELIABLE_DURATION_MS / 2, 20);
  assert.equal(r.ratio, null);
  assert.match(r.label, /too small/);
});

test('wasm speedup - exactly-at-floor durations remain measurable', () => {
  const r = computeSpeedup(MIN_RELIABLE_DURATION_MS, MIN_RELIABLE_DURATION_MS);
  assert.equal(r.ratio, 1);
});
