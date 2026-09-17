'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Video, Mic, ShieldAlert, RotateCw, ExternalLink, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export type PermissionKind = 'microphone' | 'camera' | 'both';

interface PermissionDeniedModalProps {
  open: boolean;
  kind: PermissionKind;
  /** Called after access is granted (or should be re-attempted) — re-triggers getUserMedia in the tester */
  onRetry: () => void;
  onClose: () => void;
}

const KIND_META: Record<
  PermissionKind,
  { title: string; device: string; reason: string; step2: string; step3: string; icon: React.ComponentType<{ className?: string }> }
> = {
  microphone: {
    title: 'Allow microphone access',
    device: 'microphone',
    reason: 'We need access to your microphone to test it. Please allow access when your browser asks.',
    step2:
      'Blocked earlier? Click the lock (or sliders) icon at the left of the address bar, set Microphone to “Allow”, then come back here.',
    step3:
      'Still blocked? Your system itself may deny access — check Settings → Privacy → Microphone and enable your browser there.',
    icon: Mic,
  },
  camera: {
    title: 'Allow camera access',
    device: 'camera',
    reason: 'We need access to your camera to test it. Please allow access when your browser asks.',
    step2:
      'Blocked earlier? Click the lock (or sliders) icon at the left of the address bar, set Camera to “Allow”, then come back here.',
    step3:
      'Still blocked? Your system itself may deny access — check Settings → Privacy → Camera and enable your browser there.',
    icon: Video,
  },
  both: {
    title: 'Allow camera & microphone access',
    device: 'camera and microphone',
    reason: 'We need access to your camera and microphone to test them. Please allow access when your browser asks.',
    step2:
      'Blocked earlier? Click the lock (or sliders) icon at the left of the address bar, set Camera and Microphone to “Allow”, then come back here.',
    step3:
      'Still blocked? Your system itself may deny access — check Settings → Privacy → Camera / Microphone and enable your browser there.',
    icon: Video,
  },
};

type CheckState = 'unknown' | 'granted' | 'denied' | 'prompt';

export function PermissionDeniedModal({ open, kind, onRetry, onClose }: PermissionDeniedModalProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  const [permState, setPermState] = useState<CheckState>('unknown');
  const [requesting, setRequesting] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string>('');

  const constraints: MediaStreamConstraints =
    kind === 'microphone'
      ? { audio: true, video: false }
      : kind === 'camera'
        ? { audio: false, video: true }
        : { audio: true, video: true };

  const stopAll = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  /** Ask the browser what it currently thinks about our permission. */
  const queryPermission = useCallback(async () => {
    try {
      if (navigator.permissions?.query) {
        const name = kind === 'camera' ? 'camera' : 'microphone';
        const status = await navigator.permissions.query({ name: name as PermissionName });
        setPermState(status.state as CheckState);
        status.onchange = () => setPermState(status.state as CheckState);
      }
    } catch {
      // Safari/Firefox may not support camera/mic permission queries — leave as unknown.
    }
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    queryPermission();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, queryPermission, onClose]);

  if (!open) return null;

  /**
   * One-click re-request: calls getUserMedia again. If the site permission is still
   * 'prompt' (first time or never-decided), the BROWSER'S NATIVE PROMPT appears —
   * the real system dialog. If it's 'denied', the browser rejects instantly and we
   * tell the user to use the address bar (browsers deliberately never re-prompt
   * after a hard block — that's a privacy rule in Chrome/Safari/Firefox).
   */
  const requestAccess = async () => {
    setRequesting(true);
    setRequestError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Success — access granted. Clean up immediately; the tester will open its own stream.
      stopAll(stream);
      setPermState('granted');
      setRequesting(false);
      // Give the UI a beat to show the success state, then hand back to the tester.
      setTimeout(() => {
        onRetry();
      }, 450);
    } catch (err) {
      const error = err as Error;
      setRequesting(false);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermState('denied');
        setRequestError(
          'The browser is still blocking access. Because it was denied before, the browser won’t show the popup again automatically — use Step 1 below (address-bar icon → Allow), then press this button again.'
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setRequestError('No ' + meta.device + ' found on this device. Check that it’s connected and enabled.');
      } else {
        setRequestError(error.message || 'Could not access the ' + meta.device + '.');
      }
    }
  };

  const grantedNow = permState === 'granted';

  return (
    <div
      className="no-print fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0B111A]/70 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={meta.title}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-2xl overflow-hidden fade-up">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F1F4F7] dark:hover:bg-[#192332] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-7 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#0F766E]/15 dark:bg-[#14B8A6]/20 blur-md scale-110" aria-hidden="true" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-[#0B111A]">
                <Icon className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Title + reason */}
          <h2 className="mt-5 text-xl sm:text-2xl font-extrabold text-[#142033] dark:text-[#E9EEF4] text-center tracking-tight">
            {meta.title}
          </h2>
          <p className="mt-2.5 text-sm text-center text-[#3D4A5C] dark:text-[#AEB9C8] leading-relaxed">
            {meta.reason}
          </p>

          {/* Browser prompt visual */}
          <div className="mt-5 mx-auto max-w-[280px] rounded-2xl bg-[#F1F4F7] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] px-4 py-3.5 shadow-sm">
            <p className="text-[13px] font-semibold text-[#142033] dark:text-[#E9EEF4] leading-snug">
              Allow “devicetry.com” to use your {meta.device}?
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <span className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-[#E4E9EF] dark:bg-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8]">
                Don’t allow
              </span>
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-[#0B111A]">
                Allow
              </span>
              <Lock className="w-3.5 h-3.5 self-center text-[#8996A6]" aria-hidden="true" />
            </div>
          </div>

          {/* PRIMARY ACTION — fires the real native browser prompt */}
          <button
            onClick={requestAccess}
            disabled={requesting || grantedNow}
            className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-900/20 transition-all cursor-pointer disabled:cursor-not-allowed ${
              grantedNow
                ? 'bg-emerald-500 dark:bg-emerald-500 text-white'
                : 'bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A]'
            }`}
          >
            {requesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for your answer…
              </>
            ) : grantedNow ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Access granted — opening tester…
              </>
            ) : (
              <>
                <Icon className="w-4 h-4" />
                Enable {meta.device} access
              </>
            )}
          </button>

          {/* Live status line */}
          {permState !== 'unknown' && !grantedNow && (
            <p className="mt-2 text-center text-[11px] text-[#8996A6]">
              Current browser permission: <span className="font-semibold">{permState}</span>
              {permState === 'denied' && ' — a previous “Block” is remembered'}
            </p>
          )}

          {/* Error from the re-request attempt */}
          {requestError && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              {requestError}
            </div>
          )}

          {/* Manual fallback steps */}
          <div className="mt-4 pt-4 border-t border-[#DFE5EB] dark:border-[#223043] space-y-2.5 text-[13px] text-[#3D4A5C] dark:text-[#AEB9C8]">
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#F1F4F7] dark:bg-[#192332] text-[10px] font-extrabold text-[#5F6B7A] dark:text-[#9AA6B8]">1</span>
              <p>{meta.step2}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#F1F4F7] dark:bg-[#192332] text-[10px] font-extrabold text-[#5F6B7A] dark:text-[#9AA6B8]">2</span>
              <p>{meta.step3}</p>
            </div>
          </div>

          {/* Help links */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href="https://support.microsoft.com/en-us/windows/windows-privacy-settings-8d6c1b1e-1f4b-4d9c-9d1a-2b4c3d5e6f7a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] hover:border-[#0F766E] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
            >
              Windows privacy settings
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://security.apple.com/guides/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] hover:border-[#0F766E] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
            >
              Mac privacy settings
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PermissionDeniedModal;
