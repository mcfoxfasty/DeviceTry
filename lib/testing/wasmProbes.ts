/**
 * WebAssembly feature probes and fib benchmark — extracted from
 * WebAssemblyTester so probe validity and benchmark math are
 * regression-testable without a browser.
 *
 * Probe rules:
 * - Each probe is a MINIMAL VALID module exercising the feature's opcode, so
 *   `WebAssembly.validate` distinguishes "feature unsupported" (module
 *   rejected) from "probe broken" (would be a code bug, not a browser state).
 * - A validate() rejection reports the feature as unsupported — that is the
 *   honest, meaningful signal; execution is only attempted for the MVP path.
 *
 * Benchmark rules:
 * - Speedup is JavaScript duration / Wasm duration (JS time per Wasm time).
 * - Zero, negative, non-finite, or timer-resolution-limited durations yield
 *   null — never Infinity, never a fabricated number.
 * - Equivalent workloads: both implementations are the SAME iterative
 *   algorithm and outputs must match before a comparison is shown.
 */

/** Minimum plausible measurable duration for requestAnimationFrame-era
 *  timers (performance.now resolution can be clamped to ~0.1–1 ms and the
 *  event loop adds jitter). Below this, a ratio would be noise. */
export const MIN_RELIABLE_DURATION_MS = 1;

/**
 * Minimal valid module: (func (result v128) v128.const 0). 0xFD 0x0C is
 * v128.const; the immediate is 16 lane bytes. Rejection means SIMD
 * unsupported.
 */
export const SIMD_PROBE: number[] = [
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type: () -> v128 (0x7b), 5-byte section
  0x03, 0x02, 0x01, 0x00, // func section
  0x0a, 0x16, 0x01, 0x14, 0x00, // code: count 1, body 20 (0 locals + insts)
  0xfd, 0x0c, // v128.const
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 lane bytes
  0x0b, // end
];

/**
 * Bulk memory: (memory 1) + (func memory.fill 0 0 0). memory.fill is prefix
 * 0xFC opcode 11 with three i32 operands (dst, val, len).
 */
export const BULK_MEMORY_PROBE: number[] = [
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type: () -> ()
  0x03, 0x02, 0x01, 0x00, // function section (id 3 precedes memory id 5)
  0x05, 0x03, 0x01, 0x00, 0x01, // memory section: 1 page min
  // code: size 13 = count(1) + bodySize(1) + body(11: 0-locals + 8 inst +
  // memory.fill 0xFC 0x0B with reserved memidx 0x00 + end)
  0x0a, 0x0d, 0x01, 0x0b, 0x00,
  0x41, 0x00, // i32.const 0 (dst)
  0x41, 0x00, // i32.const 0 (val)
  0x41, 0x00, // i32.const 0 (len)
  0xfc, 0x0b, 0x00, // memory.fill + reserved memory index byte
  0x0b, // end
];

/**
 * Reference types: (func (result funcref) ref.null func). ref.null is
 * 0xD0 with heap type 0x70 (funcref).
 */
export const REFERENCE_TYPES_PROBE: number[] = [
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x70, // type: () -> funcref
  0x03, 0x02, 0x01, 0x00,
  0x0a, 0x06, 0x01, 0x04, 0x00, // code: count 1, body 4 (0 locals + insts)
  0xd0, 0x70, // ref.null func
  0x0b, // end
];

/** Copy into a plain ArrayBuffer (a valid BufferSource under strict lib.dom). */
function toArrayBuffer(bytes: number[] | Uint8Array): ArrayBuffer {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const copy = new ArrayBuffer(src.byteLength);
  new Uint8Array(copy).set(src);
  return copy;
}

/** Validate a byte array when WebAssembly.validate exists; null = cannot probe. */
export function validateProbe(bytes: number[] | Uint8Array): boolean | null {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') {
    return null;
  }
  try {
    return WebAssembly.validate(toArrayBuffer(bytes));
  } catch {
    return null;
  }
}

export interface WasmFeatureProbes {
  simd: boolean | null;
  bulkMemory: boolean | null;
  referenceTypes: boolean | null;
}

export function probeFeatures(): WasmFeatureProbes {
  return {
    simd: validateProbe(SIMD_PROBE),
    bulkMemory: validateProbe(BULK_MEMORY_PROBE),
    referenceTypes: validateProbe(REFERENCE_TYPES_PROBE),
  };
}

/** Iterative Fibonacci identical to the Wasm module's algorithm. */
export function jsFib(n: number): number {
  let prev = 0;
  let curr = 1;
  for (let i = 0; i < n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return prev;
}

export interface SpeedupResult {
  /** JS duration / Wasm duration, or null when not measurable. */
  ratio: number | null;
  /** Human-readable label; explains unmeasurable cases honestly. */
  label: string;
}

/**
 * Compute the speedup as JavaScript duration / Wasm duration.
 * Returns null (with an honest label) when either duration is zero,
 * negative, non-finite, or below the timer-reliability floor.
 */
export function computeSpeedup(jsMs: number, wasmMs: number): SpeedupResult {
  const invalid =
    !Number.isFinite(jsMs) ||
    !Number.isFinite(wasmMs) ||
    jsMs <= 0 ||
    wasmMs <= 0 ||
    jsMs < MIN_RELIABLE_DURATION_MS ||
    wasmMs < MIN_RELIABLE_DURATION_MS;
  if (invalid) {
    return {
      ratio: null,
      label: 'n/a (durations too small for this timer’s resolution)',
    };
  }
  const ratio = jsMs / wasmMs;
  return { ratio, label: `${ratio.toFixed(2)}× (JS time ÷ Wasm time)` };
}
