'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Globe, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { fetchPublicIp, IpLookupError, IpResult } from '@/lib/testing/ipLookup';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: IpResult }
  | { kind: 'error'; message: string };

/**
 * What's My IP (Phase 9, item G). One explicit user-triggered lookup —
 * nothing runs on page load and nothing retries automatically. Shows a
 * copy button, IPv4/IPv6 identification where reliable, honest errors, and
 * a clear VPN/proxy note. No location or ISP information exists to show.
 */
export function WhatsMyIpTester() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel an in-flight request on departure; no persistence of results.
  useEffect(() => () => abortRef.current?.abort(), []);

  const lookup = useCallback(async () => {
    if (state.kind === 'loading') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'loading' });
    setCopied(false);
    try {
      const result = await fetchPublicIp(controller.signal);
      setState({ kind: 'done', result });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message =
        err instanceof IpLookupError
          ? err.message
          : 'Something went wrong while looking up your IP.';
      setState({ kind: 'error', message });
    }
  }, [state.kind]);

  const copy = useCallback(async () => {
    if (state.kind !== 'done') return;
    try {
      await navigator.clipboard.writeText(state.result.ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the IP remains visible to copy manually.
      setCopied(false);
    }
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#111D30] text-center">
        {state.kind === 'idle' && (
          <>
            <Globe className="w-8 h-8 mx-auto text-[#0F766E] dark:text-[#14B8A6] mb-2" />
            <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">Show the public IP of this connection</p>
            <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1 mb-4">
              Sends one small request when you click. Nothing runs automatically.
            </p>
            <button
              onClick={lookup}
              className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Show My IP
            </button>
          </>
        )}

        {state.kind === 'loading' && (
          <div className="py-4">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-[#0F766E] dark:text-[#14B8A6]" />
            <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-2">Contacting the lookup endpoint…</p>
          </div>
        )}

        {state.kind === 'done' && (
          <div className="py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8996A6]">Your public IP</p>
            <p className="mt-1 text-xl font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4] break-all">
              {state.result.ip}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              {state.result.version !== 'unknown' && (
                <span className="px-2 py-0.5 rounded bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[10px] font-bold">
                  {state.result.version}
                </span>
              )}
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={lookup}
                className="text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline cursor-pointer"
              >
                Check again
              </button>
            </div>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="py-2">
            <AlertCircle className="w-6 h-6 mx-auto text-amber-500 mb-2" />
            <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">{state.message}</p>
            <button
              onClick={lookup}
              className="mt-3 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[11px] text-[#59677D] dark:text-[#9AA6B8] leading-relaxed space-y-1.5">
        <p>
          This shows the address your connection presents to the lookup service. If you use a VPN or
          proxy, it shows the VPN/proxy exit address — by design.
        </p>
        <p>
          No location, ISP, or identity information is looked up or displayed, and the address is not
          stored by this site. See the privacy page for how the lookup endpoint handles requests.
        </p>
      </div>
    </div>
  );
}
