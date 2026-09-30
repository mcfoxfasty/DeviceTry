'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Monitor, Play, Loader2, CheckCircle, XCircle, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  REQUIRED_ECHOES,
  WebRtcLoopback,
  browserLoopbackDeps,
  buildLoopbackMetrics,
  LoopbackOutcome,
  LoopbackSnapshot,
} from '@/lib/testing/webrtcLoopback';
import { useResetPulse } from './useResetSignal';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
  /** Host clear (banner Clear result): must also wipe this component's state. */
  onResultClear?: () => void;
  /** Increments whenever the host clears its banner. */
  resetSignal?: number;
}

interface StepLog {
  label: string;
  ok: boolean;
  detail?: string;
}

interface WebRtcResult {
  steps: StepLog[];
  handshakeMs: number | null;
  rttMs: number | null;
  candidateTypes: string[];
  echoesReceived: number;
  duplicatesIgnored: number;
  unrelatedIgnored: number;
  iceCandidateAddErrors: number;
}

/**
 * Scope statement shown under every result. A local loopback is evidence about
 * this browser and nothing else, and the card says so rather than letting a
 * green verdict imply a working call.
 */
const SCOPE =
  'This covers the local browser only: no media track was captured and no request left the page. It is not evidence that a microphone or camera works, that calls connect across the internet, or that a VPN or DNS hides your address.';

/**
 * Metrics handed to the shared banner, and from there to local history, rerun
 * comparison and every export.
 *
 * A measurement that could not be taken is OMITTED, never coerced to 0. A run
 * that failed before connecting has no handshake time, and recording
 * `handshakeMs: 0` would put a number that was never measured into the
 * comparison store, where the next genuine run is then compared against it.
 *
 * The filter tests for null/undefined and non-finite values, not falsiness, so
 * a genuinely measured 0 — an instantaneous local connection — survives.
 */
export function WebRTCTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WebRtcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ echoes: number; connected: boolean } | null>(null);

  /**
   * Run generation. Every async continuation checks it, so a callback from an
   * abandoned run (a superseded rerun, a host clear, or an unmount) can never
   * write state or emit a result.
   */
  const generationRef = useRef(0);
  const loopRef = useRef<WebRtcLoopback | null>(null);

  const stopRun = useCallback(() => {
    generationRef.current += 1;
    loopRef.current?.reset();
    loopRef.current = null;
    setRunning(false);
    setProgress(null);
  }, []);

  // Unmount: invalidate the generation and release peers, channels and timers.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      loopRef.current?.dispose();
      loopRef.current = null;
    };
  }, []);

  const adopt = useCallback(
    (outcome: LoopbackOutcome, generation: number) => {
      if (generationRef.current !== generation) return; // obsolete run
      setResult({
        steps: outcome.steps,
        handshakeMs: outcome.handshakeMs,
        // No valid replies means no round-trip figure at all — never 0.
        rttMs: outcome.rttMs,
        candidateTypes: outcome.candidateTypes,
        echoesReceived: outcome.echoesReceived,
        duplicatesIgnored: outcome.duplicatesIgnored,
        unrelatedIgnored: outcome.unrelatedIgnored,
        iceCandidateAddErrors: outcome.iceCandidateAddErrors,
      });
    },
    []
  );

  const runTest = useCallback(async () => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      setError('RTCPeerConnection is not available in this browser, so no peer connection could be attempted.');
      onResultUpdate?.(
        'unsupported',
        'RTCPeerConnection is unavailable in this browser. Local WebRTC capability could not be tested at all.'
      );
      return;
    }

    stopRun();
    const generation = generationRef.current;
    setError(null);
    setResult(null);
    setRunning(true);
    setProgress({ echoes: 0, connected: false });

    const loop = new WebRtcLoopback(browserLoopbackDeps(), {
      onSnapshot: (snapshot: LoopbackSnapshot) => {
        if (generationRef.current !== generation) return;
        setProgress({ echoes: snapshot.echoesReceived, connected: snapshot.connected });
      },
      onSettled: (outcome: LoopbackOutcome) => {
        loopRef.current = null;
        if (generationRef.current !== generation) return; // obsolete run: emit nothing
        adopt(outcome, generation);
        setProgress(null);
        setRunning(false);

        const rttText = outcome.rttMs != null ? `, median round trip ${outcome.rttMs} ms` : '';
        const iceText = outcome.iceCandidateAddErrors > 0 ? `, ${outcome.iceCandidateAddErrors} ICE candidate(s) rejected` : '';

        if (outcome.ok) {
          setError(null);
          // A pass requires a connected peer and every echo, so the handshake was
          // measured; the branch still formats defensively rather than printing
          // a placeholder number.
          const handshakeText = outcome.handshakeMs != null ? `handshake ${outcome.handshakeMs} ms` : 'handshake not measured';
          onResultUpdate?.(
            'passed',
            `Local loopback observed: connection reached "connected" and the second peer echoed ${outcome.echoesReceived}/${REQUIRED_ECHOES} uniquely identified messages (${handshakeText}${rttText}${iceText}). ${SCOPE}`,
            buildLoopbackMetrics(outcome)
          );
          return;
        }

        const connectedPart =
          outcome.connected || outcome.handshakeMs != null
            ? `The connection did reach "connected" (handshake ${outcome.handshakeMs} ms) but the data exchange was incomplete`
            : 'The loopback did not complete';
        const failure = outcome.failure ?? 'an unknown failure';
        setError(failure);
        onResultUpdate?.(
          outcome.connected ? 'warning' : 'failed',
          `${connectedPart}: ${failure}. ${SCOPE}`,
          buildLoopbackMetrics(outcome)
        );
      },
    });
    loopRef.current = loop;
    loop.start();
  }, [adopt, onResultUpdate, stopRun]);

  const resetAll = useCallback(() => {
    stopRun();
    setResult(null);
    setError(null);
    // Clear the shared banner too, so the card and the banner never disagree.
    onResultClear?.();
  }, [onResultClear, stopRun]);

  const hasResult = result !== null || error !== null;

  // A host clear wipes this card too: peers released, generation bumped so an
  // in-flight run can never re-populate it with an obsolete verdict.
  useResetPulse(resetSignal, () => {
    stopRun();
    setResult(null);
    setError(null);
  });

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" aria-hidden="true" />
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Local WebRTC Loopback</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Two peers in this tab, {REQUIRED_ECHOES} echoed messages, iceServers: [] — no STUN or TURN server is contacted
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={!hasResult && !running}
            title="Reset WebRTC result"
            aria-label="Reset WebRTC result"
            className="px-3 py-2 rounded-lg border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
            {running ? 'Running loopback…' : 'Run loopback test'}
          </button>
        </div>
      </div>

      {running && progress && (
        <p className="mt-4 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]" role="status">
          {progress.connected ? 'Connection established — exchanging messages.' : 'Negotiating the local connection…'}{' '}
          {progress.echoes}/{REQUIRED_ECHOES} echo replies confirmed.
        </p>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Handshake</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
                {result.handshakeMs != null ? `${result.handshakeMs} ms` : '—'}
              </p>
              <p className="mt-1 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">time to &quot;connected&quot;</p>
            </div>
            <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Echo RTT</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
                {result.rttMs != null ? `${result.rttMs} ms` : 'No valid replies'}
              </p>
              <p className="mt-1 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">
                {result.rttMs != null ? 'median of matched replies' : 'measured per message, never assumed'}
              </p>
            </div>
            <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Echo Replies</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
                {result.echoesReceived}/{REQUIRED_ECHOES}
              </p>
              <p className="mt-1 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">unique and matched</p>
            </div>
            <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">ICE Types</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
                {result.candidateTypes.length > 0 ? result.candidateTypes.join(' · ') : '—'}
              </p>
              <p className="mt-1 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">
                {result.iceCandidateAddErrors > 0 ? `${result.iceCandidateAddErrors} rejected when added` : 'all accepted'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] divide-y divide-[#DFE5EB] dark:divide-[#223043]">
            {result.steps.map((step, i) => (
              <div key={`${step.label}-${i}`} className="flex items-start gap-3 p-3">
                {step.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                )}
                <span className="text-sm font-medium text-[#142033] dark:text-[#E9EEF4]">{step.label}</span>
                {step.detail && (
                  <span className="ml-auto text-xs text-[#5F6B7A] dark:text-[#9AA6B8] text-right break-words">
                    {step.detail}
                  </span>
                )}
              </div>
            ))}
          </div>

          {(result.duplicatesIgnored > 0 || result.unrelatedIgnored > 0) && (
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              {result.duplicatesIgnored} duplicate {result.duplicatesIgnored === 1 ? 'reply' : 'replies'} and{' '}
              {result.unrelatedIgnored} unrelated {result.unrelatedIgnored === 1 ? 'message' : 'messages'} were received and
              ignored — they do not count toward the {REQUIRED_ECHOES} confirmed echoes.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-2">
            <Monitor className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            {SCOPE}
          </p>
        </div>
      )}

      {!result && !error && !running && (
        <p className="mt-4 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          No loopback has been run yet. Running it creates two peer connections in this tab, negotiates locally, and exchanges{' '}
          {REQUIRED_ECHOES} identified messages so each reply can be matched to the ping that produced it.
        </p>
      )}
    </div>
  );
}

export default WebRTCTester;
