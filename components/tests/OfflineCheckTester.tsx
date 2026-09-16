'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, HardDriveDownload, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface CachePartition {
  name: string;
  count: number | null;
  error?: string;
}

interface NetworkInfo {
  effectiveType: string | null;
  downlink: string | null;
  rtt: string | null;
  saveData: boolean | null;
}

export function OfflineCheckTester({ onResultUpdate }: TesterProps) {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [cacheSupported, setCacheSupported] = useState<boolean>(false);
  const [caches_, setCaches] = useState<CachePartition[]>([]);
  const [serviceWorkerState, setServiceWorkerState] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const readConnection = useCallback((): NetworkInfo => {
    const conn = (navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    }).connection;
    return {
      effectiveType: conn?.effectiveType ?? null,
      downlink: typeof conn?.downlink === 'number' ? `${conn.downlink} Mb/s` : null,
      rtt: typeof conn?.rtt === 'number' ? `${conn.rtt} ms` : null,
      saveData: typeof conn?.saveData === 'boolean' ? conn.saveData : null,
    };
  }, []);

  const scanCaches = useCallback(async () => {
    if (typeof caches === 'undefined') {
      setCacheSupported(false);
      return;
    }
    setCacheSupported(true);
    setScanning(true);
    try {
      const names = await caches.keys();
      const partitions: CachePartition[] = [];
      for (const name of names) {
        try {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          partitions.push({ name, count: keys.length });
        } catch (err) {
          partitions.push({ name, count: null, error: err instanceof Error ? err.message : 'Unreadable' });
        }
      }
      setCaches(partitions);
    } catch {
      setCaches([]);
    } finally {
      setScanning(false);
    }
  }, []);

  const inspectServiceWorker = useCallback(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setServiceWorkerState(null);
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        setServiceWorkerState(regs.length > 0 ? `${regs.length} registered service worker${regs.length > 1 ? 's' : ''}` : 'No service workers registered');
      })
      .catch(() => setServiceWorkerState('Service worker registry unavailable'));
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!navigator.onLine) {
      onResultUpdate?.('warning', 'Browser reports offline connectivity');
    }
    // Report once on mount; don't spam on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualRefresh = () => {
    setNetwork(readConnection());
    inspectServiceWorker();
    void scanCaches();
    onResultUpdate?.(online ? 'passed' : 'warning', online ? 'Online, caches inspected' : 'Offline');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${online ? 'border-green-500/40 bg-green-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
          {online ? (
            <Wifi className="h-5 w-5 text-green-600" aria-hidden="true" />
          ) : (
            <WifiOff className="h-5 w-5 text-amber-600" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold">{online ? 'Online' : 'Offline'}</span>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Connection</p>
          <p className="mt-1 text-sm font-semibold">{network?.effectiveType ?? 'Unknown'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Downlink</p>
          <p className="mt-1 text-sm font-semibold">{network?.downlink ?? '—'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">RTT</p>
          <p className="mt-1 text-sm font-semibold">{network?.rtt ?? '—'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Save Data</p>
          <p className="mt-1 text-sm font-semibold">{network?.saveData == null ? '—' : network.saveData ? 'On' : 'Off'}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">CacheStorage partitions</p>
          </div>
          {scanning ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <span className="text-xs text-muted-foreground">{cacheSupported ? `${caches_.length} partition(s)` : 'API unavailable'}</span>
          )}
        </div>
        {!cacheSupported && (
          <p className="mt-2 text-xs text-muted-foreground">CacheStorage is not exposed in this browser context (requires secure origin).</p>
        )}
        {cacheSupported && caches_.length === 0 && !scanning && (
          <p className="mt-2 text-xs text-muted-foreground">No cache partitions found. Visit pages that precache assets first.</p>
        )}
        {caches_.length > 0 && (
          <ul className="mt-3 space-y-2">
            {caches_.map((c) => (
              <li key={c.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-mono text-xs">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.error ? c.error : `${c.count} entr${c.count === 1 ? 'y' : 'ies'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
        {serviceWorkerState && serviceWorkerState.startsWith('No') ? (
          <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : serviceWorkerState ? (
          <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-sm">{serviceWorkerState ?? 'Service Worker API unavailable'}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: toggle Wi-Fi or Airplane mode to watch the Online/Offline badge react to real browser connectivity events.
      </p>
    </div>
  );
}

export default OfflineCheckTester;
