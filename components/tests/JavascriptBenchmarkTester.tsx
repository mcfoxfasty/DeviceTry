'use client';

import React, { useState, useRef } from 'react';
import { Cpu, Play, Loader2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface BenchRow {
  name: string;
  ops: number;
  unit: string;
  ms: number;
}

interface BenchResult {
  rows: BenchRow[];
  totalScore: number;
  totalMs: number;
}

// ---------- workloads (pure synchronous, bounded) ----------

function primeSieve(limit: number): number {
  const sieve = new Uint8Array(limit + 1);
  let count = 0;
  for (let i = 2; i <= limit; i++) {
    if (!sieve[i]) {
      count++;
      for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
    }
  }
  return count;
}

function matrixMultiply(size: number): number {
  const a = new Float64Array(size * size);
  const b = new Float64Array(size * size);
  for (let i = 0; i < size * size; i++) {
    a[i] = i % 7 + 1;
    b[i] = i % 5 + 1;
  }
  const c = new Float64Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let k = 0; k < size; k++) {
      const aik = a[i * size + k];
      for (let j = 0; j < size; j++) {
        c[i * size + j] += aik * b[k * size + j];
      }
    }
  }
  return c[size * size - 1];
}

function stringProcessing(iterations: number): number {
  let acc = 0;
  const base = 'DeviceTry benchmark payload ';
  for (let i = 0; i < iterations; i++) {
    const s = base + i;
    acc += s.length + (s.includes('bench') ? 1 : 0) + s.toUpperCase().length % 97;
  }
  return acc;
}

async function sha256Hash(iterations: number): Promise<number> {
  const data = new TextEncoder().encode('DeviceTry crypto benchmark iteration');
  let acc = 0;
  for (let i = 0; i < iterations; i++) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    acc += new DataView(digest).getUint8(0);
  }
  return acc;
}

// ---------- component ----------

export function JavascriptBenchmarkTester({ onResultUpdate }: TesterProps) {
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<BenchResult | null>(null);
  const cryptoOk = useRef<boolean>(typeof crypto !== 'undefined' && !!crypto.subtle);

  const runBenchmark = async () => {
    setRunning(true);
    setResult(null);
    const rows: BenchRow[] = [];

    // 1. Prime sieve
    setProgress('Prime sieve…');
    await new Promise((r) => setTimeout(r, 30));
    let t0 = performance.now();
    const sieveIterations = 12;
    for (let i = 0; i < sieveIterations; i++) primeSieve(30000);
    const sieveMs = performance.now() - t0;
    rows.push({ name: 'Prime Sieve (30k)', ops: Math.round((sieveIterations / sieveMs) * 1000), unit: 'runs/s', ms: Math.round(sieveMs) });

    // 2. Matrix multiply
    setProgress('Matrix multiplication…');
    await new Promise((r) => setTimeout(r, 30));
    t0 = performance.now();
    const matIterations = 6;
    for (let i = 0; i < matIterations; i++) matrixMultiply(96);
    const matMs = performance.now() - t0;
    rows.push({ name: 'Matrix Multiply 96²', ops: Math.round((matIterations / matMs) * 1000), unit: 'runs/s', ms: Math.round(matMs) });

    // 3. String processing
    setProgress('String processing…');
    await new Promise((r) => setTimeout(r, 30));
    t0 = performance.now();
    stringProcessing(300000);
    const strMs = performance.now() - t0;
    rows.push({ name: 'String Ops (300k)', ops: Math.round((300000 / strMs) * 1000), unit: 'ops/s', ms: Math.round(strMs) });

    // 4. SHA-256 hashing
    if (cryptoOk.current) {
      setProgress('SHA-256 hashing…');
      await new Promise((r) => setTimeout(r, 30));
      t0 = performance.now();
      const hashIterations = 1500;
      await sha256Hash(hashIterations);
      const hashMs = performance.now() - t0;
      rows.push({ name: 'SHA-256 Hash', ops: Math.round((hashIterations / hashMs) * 1000), unit: 'hash/s', ms: Math.round(hashMs) });
    }

    const totalMs = rows.reduce((a, r) => a + r.ms, 0);
    const totalScore = Math.round(rows.reduce((a, r) => a + r.ops, 0) / 100);
    const res: BenchResult = { rows, totalScore, totalMs: Math.round(totalMs) };
    setResult(res);
    setRunning(false);
    setProgress('');
    onResultUpdate?.('passed', `JS benchmark complete — composite score ${totalScore}`);
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">JavaScript Engine CPU Benchmark</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Single-thread JIT workload suite: sieve, matrices, strings, SHA-256</p>
          </div>
        </div>
        <button
          onClick={runBenchmark}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? progress || 'Running…' : 'Run Benchmark'}
        </button>
      </div>

      {result ? (
        <>
          <div className="mt-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
                <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <th className="py-2.5 px-4 font-semibold">Workload</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Throughput</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Elapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                {result.rows.map((row) => (
                  <tr key={row.name} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                    <td className="py-2.5 px-4 font-medium text-[#142033] dark:text-[#E9EEF4]">{row.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-bold text-[#0F766E] dark:text-[#14B8A6]">
                      {row.ops.toLocaleString()} {row.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8]">{row.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-[#0F766E]/10 border border-[#0F766E]/30">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Composite Score</p>
              <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">Total compute time {result.totalMs} ms</p>
            </div>
            <p className="font-mono-num text-4xl font-black text-[#0F766E] dark:text-[#14B8A6]">{result.totalScore}</p>
          </div>
        </>
      ) : (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Cpu className="w-10 h-10 mx-auto opacity-40 text-[#5F6B7A] mb-2" />
          <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            Runs ~2 seconds of bounded local computation. Plug in your laptop for maximum CPU clock.
          </p>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Measures single-thread JavaScript JIT efficiency inside the browser sandbox. Background tasks and thermal throttling affect results. Everything runs locally — no scores are uploaded.
      </div>
    </div>
  );
}
