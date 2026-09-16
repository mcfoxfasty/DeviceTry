'use client';

import React, { useState, useRef } from 'react';
import { Binary, Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface WasmFeatures {
  mvp: boolean;
  simd: boolean;
  threads: boolean;
  bigInt: boolean;
  bulkMemory: boolean;
  referenceTypes: boolean;
}

interface WasmResult {
  features: WasmFeatures;
  wasmFibMs: number;
  jsFibMs: number;
  speedup: string;
}

// Minimal valid Wasm module: (func (export "fib") (param i32) (result i32))
// Iteratively computes fib(n) with three i32 locals; fib(30) = 832040.
// Hand-assembled from the following WAT:
//   i32.const 0; local.set 1   ;; prev = 0
//   i32.const 1; local.set 2   ;; curr = 1
//   block; loop                ;; while n != 0:
//     local.get 0; i32.eqz; br_if 1
//     local.get 1; local.get 2; i32.add; local.set 3   ;; next = prev+curr
//     local.get 2; local.set 1                          ;; prev = curr
//     local.get 3; local.set 2                          ;; curr = next
//     local.get 0; i32.const 1; i32.sub; local.set 0    ;; n -= 1
//     br 0
//   end; end
//   local.get 1               ;; return prev
function buildFibonacciModule(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    // Magic "\0asm" + version 1
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    // Type section: type 0 = (i32) -> i32
    0x01, 0x06, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f,
    // Function section: func 0 uses type 0
    0x03, 0x02, 0x01, 0x00,
    // Export section: export "fib" as func 0
    0x07, 0x07, 0x01, 0x03, 0x66, 0x69, 0x62, 0x00, 0x00,
    // Code section: body of 49 bytes (locals: 3 × i32)
    0x0a, 0x33, 0x01, 0x31, 0x01, 0x03, 0x7f,
    // prev = 0
    0x41, 0x00, 0x21, 0x01,
    // curr = 1
    0x41, 0x01, 0x21, 0x02,
    // block $exit
    0x02, 0x40,
    // loop $loop
    0x03, 0x40,
    // if n == 0, break
    0x20, 0x00, 0x45, 0x0d, 0x01,
    // next = prev + curr
    0x20, 0x01, 0x20, 0x02, 0x6a, 0x21, 0x03,
    // prev = curr
    0x20, 0x02, 0x21, 0x01,
    // curr = next
    0x20, 0x03, 0x21, 0x02,
    // n = n - 1
    0x20, 0x00, 0x41, 0x01, 0x6b, 0x21, 0x00,
    // br $loop
    0x0c, 0x00,
    0x0b, // end loop
    0x0b, // end block
    // return prev
    0x20, 0x01,
    0x0b, // end function
  ]);
}

export function WebAssemblyTester({ onResultUpdate }: TesterProps) {
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<WasmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasmSupported = useRef<boolean>(typeof WebAssembly !== 'undefined');

  const runBenchmark = async () => {
    if (!wasmSupported.current) {
      setError('WebAssembly is not supported by this browser.');
      onResultUpdate?.('unsupported', 'WebAssembly unavailable');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const features: WasmFeatures = {
        mvp: true,
        simd: typeof WebAssembly.validate === 'function' && WebAssembly.validate(
          new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 11, 11])
        ),
        threads: typeof SharedArrayBuffer !== 'undefined',
        bigInt: typeof BigInt !== 'undefined' && typeof BigInt64Array !== 'undefined',
        bulkMemory: WebAssembly.validate(
          new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 6, 1, 4, 0, 252, 11, 11, 11])
        ),
        referenceTypes: WebAssembly.validate(
          new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 6, 1, 4, 0, 208, 208, 26, 11, 11])
        ),
      };

      // Instantiate the fibonacci module
      const wasmBytes = buildFibonacciModule();
      if (!WebAssembly.validate(wasmBytes)) {
        throw new Error('Module validation failed');
      }
      const { instance } = await WebAssembly.instantiate(wasmBytes);
      const exports = instance.exports as { fib?: (n: number) => number };
      if (!exports.fib) throw new Error('fib export missing from module');

      // Sanity check: fib(30) must be 832040
      const sanity = exports.fib(30);
      if (sanity !== 832040) {
        throw new Error(`fib(30) returned ${sanity}, expected 832040`);
      }

      const N = 30;
      const ITER = 20000;

      // Wasm timing
      let t0 = performance.now();
      let sink = 0;
      for (let i = 0; i < ITER; i++) sink += exports.fib(N);
      const wasmFibMs = performance.now() - t0;

      // Equivalent JS timing (iterative fib)
      const jsFib = (n: number): number => {
        let prev = 0, curr = 1;
        for (let i = 0; i < n; i++) {
          const next = prev + curr;
          prev = curr;
          curr = next;
        }
        return prev;
      };
      t0 = performance.now();
      for (let i = 0; i < ITER; i++) sink += jsFib(N);
      const jsFibMs = performance.now() - t0;

      if (sink < 0) console.log('unreachable', sink); // keep sink alive

      const speedup = jsFibMs > 0 ? `${(wasmFibMs / jsFibMs).toFixed(2)}× vs JS` : 'n/a';
      const res: WasmResult = { features, wasmFibMs: Math.round(wasmFibMs), jsFibMs: Math.round(jsFibMs), speedup };
      setResult(res);
      onResultUpdate?.('passed', `Wasm module compiled & executed — fib(30) × ${ITER.toLocaleString()} in ${Math.round(wasmFibMs)} ms`);
    } catch (err) {
      setError((err as Error).message || 'Wasm instantiation failed');
      onResultUpdate?.('failed', 'WebAssembly instantiation failed');
    }
    setRunning(false);
  };

  const featureRows = result
    ? [
        { label: 'MVP (core)', ok: result.features.mvp },
        { label: 'SIMD (128-bit)', ok: result.features.simd },
        { label: 'Threads (SAB)', ok: result.features.threads },
        { label: 'BigInt64 / i64', ok: result.features.bigInt },
        { label: 'Bulk Memory', ok: result.features.bulkMemory },
        { label: 'Reference Types', ok: result.features.referenceTypes },
      ]
    : [];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Binary className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">WebAssembly Support &amp; Speed Test</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Compiles an in-memory binary module and times native bytecode execution</p>
          </div>
        </div>
        <button
          onClick={runBenchmark}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Compiling…' : 'Run Wasm Benchmark'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {featureRows.map((f) => (
              <div key={f.label} className="flex items-center gap-2 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs">
                {f.ok ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className={f.ok ? 'font-semibold text-[#142033] dark:text-[#E9EEF4]' : 'text-[#5F6B7A] dark:text-[#9AA6B8]'}>{f.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Wasm fib(30)×20k</p>
              <p className="font-mono-num text-xl font-black text-[#0F766E] dark:text-[#14B8A6] mt-1">{result.wasmFibMs} ms</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">JS equivalent</p>
              <p className="font-mono-num text-xl font-black text-[#142033] dark:text-[#E9EEF4] mt-1">{result.jsFibMs} ms</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Relative speed</p>
              <p className="font-mono-num text-xl font-black text-[#142033] dark:text-[#E9EEF4] mt-1">{result.speedup}</p>
            </div>
          </div>
        </div>
      ) : !error ? (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Binary className="w-10 h-10 mx-auto opacity-40 text-[#5F6B7A] mb-2" />
          <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            Compiles a hand-built Wasm binary in memory, then benchmarks fib(30) 20,000 times against the JS equivalent.
          </p>
        </div>
      ) : null}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        The module is instantiated entirely from a bundled byte array in browser memory — no network fetch. SIMD/Threads features depend on CPU vector extensions and cross-origin isolation headers.
      </div>
    </div>
  );
}
