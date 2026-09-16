'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Monitor, Play, Loader2, CheckCircle, XCircle, ArrowLeftRight } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface StepLog {
  label: string;
  ok: boolean;
  detail?: string;
}

interface WebRtcResult {
  steps: StepLog[];
  handshakeMs: number | null;
  pingMs: number | null;
  candidateTypes: string[];
  dataChannelMessages: number;
}

const PING_COUNT = 5;

export function WebRTCTester({ onResultUpdate }: TesterProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WebRtcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<{ pc1: RTCPeerConnection; pc2: RTCPeerConnection; dc?: RTCDataChannel } | null>(null);

  const teardown = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.dc?.close();
        pcRef.current.pc1.close();
        pcRef.current.pc2.close();
      } catch {
        // ignore teardown errors
      }
      pcRef.current = null;
    }
  }, []);

  const runTest = useCallback(async () => {
    if (typeof RTCPeerConnection === 'undefined') {
      setError('RTCPeerConnection is not supported by this browser.');
      onResultUpdate?.('unsupported', 'WebRTC unavailable');
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    teardown();

    const steps: StepLog[] = [];
    const candidateTypes = new Set<string>();
    let handshakeMs: number | null = null;
    let pingMs: number | null = null;
    let dataChannelMessages = 0;

    try {
      const started = performance.now();

      const pc1 = new RTCPeerConnection({ iceServers: [] });
      const pc2 = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = { pc1, pc2 };

      pc1.onicecandidate = (e) => {
        if (e.candidate?.type) {
          candidateTypes.add(e.candidate.type);
          void pc2.addIceCandidate(e.candidate).catch(() => undefined);
        }
      };
      pc2.onicecandidate = (e) => {
        if (e.candidate?.type) {
          candidateTypes.add(e.candidate.type);
          void pc1.addIceCandidate(e.candidate).catch(() => undefined);
        }
      };

      const dc = pc1.createDataChannel('devicetry-ping');
      pcRef.current.dc = dc;
      dc.binaryType = 'arraybuffer';

      const pingStart = performance.now();
      let pongs = 0;

      const waitForOpen = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for data channel to open (8s).')), 8000);
        dc.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        dc.onmessage = () => {
          pongs += 1;
        };
      });

      const connectionOpen = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out establishing peer connection (8s).')), 8000);
        pc2.onconnectionstatechange = () => {
          if (pc2.connectionState === 'connected') {
            clearTimeout(timeout);
            resolve();
          }
          if (pc2.connectionState === 'failed' || pc2.connectionState === 'closed') {
            clearTimeout(timeout);
            reject(new Error(`Peer connection entered state: ${pc2.connectionState}`));
          }
        };
      });

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);
      steps.push({ label: 'SDP offer/answer exchange', ok: true });

      await Promise.all([waitForOpen, connectionOpen]);
      handshakeMs = Math.round(performance.now() - started);
      steps.push({ label: 'Local loopback connection established', ok: true, detail: `${handshakeMs} ms` });
      steps.push({ label: 'RTCDataChannel opened', ok: true, detail: dc.label });

      // Roundtrip pings over the loopback data channel.
      for (let i = 0; i < PING_COUNT; i++) {
        dc.send(`ping-${i}`);
      }
      const pingDeadline = performance.now() + 3000;
      while (pongs < PING_COUNT && performance.now() < pingDeadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      dataChannelMessages = pongs;
      pingMs = Math.round((performance.now() - pingStart) / Math.max(pongs, 1));
      steps.push({
        label: 'DataChannel roundtrip pings',
        ok: pongs === PING_COUNT,
        detail: `${pongs}/${PING_COUNT} messages, ~${pingMs} ms total`,
      });

      setResult({ steps, handshakeMs, pingMs, candidateTypes: Array.from(candidateTypes), dataChannelMessages });

      const ok = steps.every((s) => s.ok);
      onResultUpdate?.(ok ? 'passed' : 'warning', ok ? `Handshake ${handshakeMs} ms, ${dataChannelMessages} messages` : 'Incomplete data channel exchange');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebRTC loopback test failed.';
      setError(message);
      setResult({ steps, handshakeMs, pingMs, candidateTypes: Array.from(candidateTypes), dataChannelMessages });
      onResultUpdate?.('failed', message);
    } finally {
      teardown();
      setRunning(false);
      void pingMs;
    }
  }, [onResultUpdate, teardown]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Loopback peer connection with zero external STUN/TURN servers.
          </p>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {running ? 'Testing…' : 'Test Local WebRTC Loopback'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Handshake</p>
              <p className="mt-1 text-xl font-semibold">{result.handshakeMs != null ? `${result.handshakeMs} ms` : '—'}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ping Avg</p>
              <p className="mt-1 text-xl font-semibold">{result.pingMs != null ? `${result.pingMs} ms` : '—'}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Messages</p>
              <p className="mt-1 text-xl font-semibold">{result.dataChannelMessages}/{PING_COUNT}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidates</p>
              <p className="mt-1 text-xl font-semibold">{result.candidateTypes.length || '—'}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card divide-y">
            {result.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                {step.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                )}
                <span className="text-sm font-medium">{step.label}</span>
                {step.detail && <span className="ml-auto text-xs text-muted-foreground">{step.detail}</span>}
              </div>
            ))}
          </div>

          {result.candidateTypes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <Monitor className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Gathered candidate types: {result.candidateTypes.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default WebRTCTester;
