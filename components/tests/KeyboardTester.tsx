'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Keyboard, Play, Square, RotateCcw, AlertCircle, Check, Smartphone } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import { isVirtualKeyboardKey, VIRTUAL_TYPING_NOTICE, TOUCH_DEVICE_NOTICE } from '@/lib/testing/virtualTyping';

interface KeyboardTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /** Registry identity for the in-card banner's safe share + history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

type LayoutType = 'qwerty' | 'azerty' | 'arabic';

interface KeyDef {
  code: string;
  labels: {
    qwerty: string;
    azerty: string;
    arabic: string;
  };
  width?: string;
}

const subscribeNoop = () => () => {};

const KEYBOARD_ROWS: KeyDef[][] = [
  // Row 1: Function keys & Esc
  [
    { code: 'Escape', labels: { qwerty: 'Esc', azerty: 'Échap', arabic: 'Esc' }, width: 'w-12' },
    { code: 'F1', labels: { qwerty: 'F1', azerty: 'F1', arabic: 'F1' } },
    { code: 'F2', labels: { qwerty: 'F2', azerty: 'F2', arabic: 'F2' } },
    { code: 'F3', labels: { qwerty: 'F3', azerty: 'F3', arabic: 'F3' } },
    { code: 'F4', labels: { qwerty: 'F4', azerty: 'F4', arabic: 'F4' } },
    { code: 'F5', labels: { qwerty: 'F5', azerty: 'F5', arabic: 'F5' } },
    { code: 'F6', labels: { qwerty: 'F6', azerty: 'F6', arabic: 'F6' } },
    { code: 'F7', labels: { qwerty: 'F7', azerty: 'F7', arabic: 'F7' } },
    { code: 'F8', labels: { qwerty: 'F8', azerty: 'F8', arabic: 'F8' } },
    { code: 'F9', labels: { qwerty: 'F9', azerty: 'F9', arabic: 'F9' } },
    { code: 'F10', labels: { qwerty: 'F10', azerty: 'F10', arabic: 'F10' } },
    { code: 'F11', labels: { qwerty: 'F11', azerty: 'F11', arabic: 'F11' } },
    { code: 'F12', labels: { qwerty: 'F12', azerty: 'F12', arabic: 'F12' } },
  ],
  // Row 2: Numbers
  [
    { code: 'Backquote', labels: { qwerty: '` ~', azerty: '²', arabic: 'ذّ' } },
    { code: 'Digit1', labels: { qwerty: '1 !', azerty: '& 1', arabic: '1 !' } },
    { code: 'Digit2', labels: { qwerty: '2 @', azerty: 'é 2', arabic: '2 @' } },
    { code: 'Digit3', labels: { qwerty: '3 #', azerty: '" 3', arabic: '3 #' } },
    { code: 'Digit4', labels: { qwerty: '4 $', azerty: "' 4", arabic: '4 $' } },
    { code: 'Digit5', labels: { qwerty: '5 %', azerty: '( 5', arabic: '5 %' } },
    { code: 'Digit6', labels: { qwerty: '6 ^', azerty: '- 6', arabic: '6 ^' } },
    { code: 'Digit7', labels: { qwerty: '7 &', azerty: 'è 7', arabic: '7 &' } },
    { code: 'Digit8', labels: { qwerty: '8 *', azerty: '_ 8', arabic: '8 *' } },
    { code: 'Digit9', labels: { qwerty: '9 (', azerty: 'ç 9', arabic: '9 (' } },
    { code: 'Digit0', labels: { qwerty: '0 )', azerty: 'à 0', arabic: '0 )' } },
    { code: 'Minus', labels: { qwerty: '- _', azerty: ') °', arabic: '- _' } },
    { code: 'Equal', labels: { qwerty: '= +', azerty: '= +', arabic: '= +' } },
    { code: 'Backspace', labels: { qwerty: 'Bksp', azerty: 'Retour', arabic: 'مسح' }, width: 'w-16' },
  ],
  // Row 3: QWERTY / AZERTY / Arabic top alpha row
  [
    { code: 'Tab', labels: { qwerty: 'Tab', azerty: 'Tab', arabic: 'Tab' }, width: 'w-14' },
    { code: 'KeyQ', labels: { qwerty: 'Q', azerty: 'A', arabic: 'ض' } },
    { code: 'KeyW', labels: { qwerty: 'W', azerty: 'Z', arabic: 'ص' } },
    { code: 'KeyE', labels: { qwerty: 'E', azerty: 'E', arabic: 'ث' } },
    { code: 'KeyR', labels: { qwerty: 'R', azerty: 'R', arabic: 'ق' } },
    { code: 'KeyT', labels: { qwerty: 'T', azerty: 'T', arabic: 'ف' } },
    { code: 'KeyY', labels: { qwerty: 'Y', azerty: 'Y', arabic: 'غ' } },
    { code: 'KeyU', labels: { qwerty: 'U', azerty: 'U', arabic: 'ع' } },
    { code: 'KeyI', labels: { qwerty: 'I', azerty: 'I', arabic: 'ه' } },
    { code: 'KeyO', labels: { qwerty: 'O', azerty: 'O', arabic: 'خ' } },
    { code: 'KeyP', labels: { qwerty: 'P', azerty: 'P', arabic: 'ح' } },
    { code: 'BracketLeft', labels: { qwerty: '[ {', azerty: '^ ¨', arabic: 'ج' } },
    { code: 'BracketRight', labels: { qwerty: '] }', azerty: '$ £', arabic: 'د' } },
    { code: 'Backslash', labels: { qwerty: '\\ |', azerty: '* µ', arabic: '\\ |' } },
  ],
  // Row 4: Home row
  [
    { code: 'CapsLock', labels: { qwerty: 'Caps', azerty: 'Verr Maj', arabic: 'Caps' }, width: 'w-16' },
    { code: 'KeyA', labels: { qwerty: 'A', azerty: 'Q', arabic: 'ش' } },
    { code: 'KeyS', labels: { qwerty: 'S', azerty: 'S', arabic: 'س' } },
    { code: 'KeyD', labels: { qwerty: 'D', azerty: 'D', arabic: 'ي' } },
    { code: 'KeyF', labels: { qwerty: 'F', azerty: 'F', arabic: 'ب' } },
    { code: 'KeyG', labels: { qwerty: 'G', azerty: 'G', arabic: 'ل' } },
    { code: 'KeyH', labels: { qwerty: 'H', azerty: 'H', arabic: 'ا' } },
    { code: 'KeyJ', labels: { qwerty: 'J', azerty: 'J', arabic: 'ت' } },
    { code: 'KeyK', labels: { qwerty: 'K', azerty: 'K', arabic: 'ن' } },
    { code: 'KeyL', labels: { qwerty: 'L', azerty: 'L', arabic: 'م' } },
    { code: 'Semicolon', labels: { qwerty: '; :', azerty: 'm M', arabic: 'ك' } },
    { code: 'Quote', labels: { qwerty: '\' "', azerty: 'ù %', arabic: 'ط' } },
    { code: 'Enter', labels: { qwerty: 'Enter', azerty: 'Entrée', arabic: 'إدخال' }, width: 'w-20' },
  ],
  // Row 5: Shift row
  [
    { code: 'ShiftLeft', labels: { qwerty: 'Shift', azerty: 'Maj', arabic: 'Shift' }, width: 'w-20' },
    { code: 'KeyZ', labels: { qwerty: 'Z', azerty: 'W', arabic: 'ئ' } },
    { code: 'KeyX', labels: { qwerty: 'X', azerty: 'X', arabic: 'ء' } },
    { code: 'KeyC', labels: { qwerty: 'C', azerty: 'C', arabic: 'ؤ' } },
    { code: 'KeyV', labels: { qwerty: 'V', azerty: 'V', arabic: 'ر' } },
    { code: 'KeyB', labels: { qwerty: 'B', azerty: 'B', arabic: 'لا' } },
    { code: 'KeyN', labels: { qwerty: 'N', azerty: 'N', arabic: 'ى' } },
    { code: 'KeyM', labels: { qwerty: 'M', azerty: ', ?', arabic: 'ة' } },
    { code: 'Comma', labels: { qwerty: ', <', azerty: '; .', arabic: 'و' } },
    { code: 'Period', labels: { qwerty: '. >', azerty: ': /', arabic: 'ز' } },
    { code: 'Slash', labels: { qwerty: '/ ?', azerty: '! §', arabic: 'ظ' } },
    { code: 'ShiftRight', labels: { qwerty: 'Shift', azerty: 'Maj', arabic: 'Shift' }, width: 'w-24' },
  ],
  // Row 6: Space & Modifiers
  [
    { code: 'ControlLeft', labels: { qwerty: 'Ctrl', azerty: 'Ctrl', arabic: 'Ctrl' }, width: 'w-14' },
    { code: 'MetaLeft', labels: { qwerty: 'Win/Cmd', azerty: 'Win/Cmd', arabic: 'Cmd' }, width: 'w-14' },
    { code: 'AltLeft', labels: { qwerty: 'Alt', azerty: 'Alt', arabic: 'Alt' }, width: 'w-14' },
    { code: 'Space', labels: { qwerty: 'Space', azerty: 'Espace', arabic: 'مسافة' }, width: 'flex-1' },
    { code: 'AltRight', labels: { qwerty: 'AltGr', azerty: 'AltGr', arabic: 'AltGr' }, width: 'w-14' },
    { code: 'ControlRight', labels: { qwerty: 'Ctrl', azerty: 'Ctrl', arabic: 'Ctrl' }, width: 'w-14' },
    { code: 'ArrowLeft', labels: { qwerty: '←', azerty: '←', arabic: '←' } },
    { code: 'ArrowUp', labels: { qwerty: '↑', azerty: '↑', arabic: '↑' } },
    { code: 'ArrowDown', labels: { qwerty: '↓', azerty: '↓', arabic: '↓' } },
    { code: 'ArrowRight', labels: { qwerty: '→', azerty: '→', arabic: '→' } },
  ],
];

export function KeyboardTester({ t, onRecordResult, onResultClear, toolId, toolTitle, toolSlug }: KeyboardTesterProps) {
  const { result, emit, clear, reset, startRun, invalidate } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const [isTestActive, setIsTestActive] = useState<boolean>(false);
  const [layout, setLayout] = useState<LayoutType>('qwerty');
  const [pressedCodes, setPressedCodes] = useState<Set<string>>(new Set());
  const [activeCodes, setActiveCodes] = useState<Set<string>>(new Set());
  const [lastKey, setLastKey] = useState<{ key: string; code: string; keyCode: number } | null>(null);
  const [virtualInfo, setVirtualInfo] = useState<string | null>(null);
  const [virtualCount, setVirtualCount] = useState<number>(0);

  const isTestActiveRef = useRef<boolean>(false);
  const emitRef = useRef(emit);

  useEffect(() => {
    isTestActiveRef.current = isTestActive;
  }, [isTestActive]);

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  /**
   * Correction E: detect coarse-pointer (touch-first) devices to explain —
   * honestly — that the on-screen keyboard cannot verify physical keys or
   * layout, and that this full test needs a physical Bluetooth/USB keyboard
   * or a desktop. Detection is display-capability based only; nothing is
   * stored or reported anywhere.
   *
   * Device capability is browser state, not React state: useSyncExternalStore
   * reads it without a setState-in-effect cascade and stays hydration-safe
   * (server snapshot is `false`, so SSR/CSR markup match on first paint).
   */
  const touchDevice = useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(pointer: fine)').matches,
    () => false
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTestActiveRef.current) return;

      // Intercept navigation keys only when keyboard test is actively enabled
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      setLastKey({
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
      });

      /**
       * Correction E: events whose keyCode is 229 come from an on-screen
       * (virtual) keyboard or IME composition. They light up the virtual
       * typing check below but are NEVER treated as physical-key evidence,
       * never counted toward the matrix, and never produce a full
       * keyboard-test pass.
       */
      if (isVirtualKeyboardKey(e)) {
        setVirtualCount((c) => c + 1);
        setVirtualInfo(`Virtual key “${e.key}” received — on-screen typing only`);
        return;
      }

      setPressedCodes((prev) => {
        const next = new Set(prev).add(e.code);
        // Direct emission for a live keydown: the controller dedupes
        // identical verdicts, and a post-reset keydown belongs to the new
        // run only if the user restarted the test.
        emitRef.current(
          'passed',
          `${next.size} keys verified response without ghosting.`,
          { totalKeysTested: next.size }
        );
        return next;
      });

      setActiveCodes((prev) => new Set(prev).add(e.code));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isTestActiveRef.current) return;

      setActiveCodes((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Unmount: invalidate in-flight emissions without deleting a completed
      // guided result.
      invalidate();
    };
  }, [invalidate]);

  const resetAllKeys = () => {
    setIsTestActive(false);
    isTestActiveRef.current = false;
    setPressedCodes(new Set());
    setActiveCodes(new Set());
    setLastKey(null);
    setVirtualCount(0);
    setVirtualInfo(null);
    // Explicit user reset: clears the verdict and the host/guided result
    // exactly once, and invalidates any in-flight emissions.
    reset();
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.keyboardTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.keyboardTest.shortDesc}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{t.keyboardTest.layoutSelector}</span>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as LayoutType)}
              className="text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded px-2.5 py-1.5 focus:outline-none"
            >
              <option value="qwerty">{t.keyboardTest.layoutQwerty}</option>
              <option value="azerty">{t.keyboardTest.layoutAzerty}</option>
              <option value="arabic">{t.keyboardTest.layoutArabic}</option>
            </select>
          </div>

          {!isTestActive ? (
            <button
              id="btn-start-keyboard-test"
              onClick={() => setIsTestActive(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {t.common.startTest}
            </button>
          ) : (
            <button
              id="btn-stop-keyboard-test"
              onClick={() => setIsTestActive(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4" />
              {t.common.stopTest}
            </button>
          )}

          <button
            id="btn-reset-keyboard"
            onClick={resetAllKeys}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-medium rounded-md border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.common.reset}
          </button>
        </div>
      </div>

      {/* Correction E: touch-first devices get an honest scope notice before
          the matrix; a physical keyboard still works here when connected. */}
      {touchDevice && (
        <div
          className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5"
          role="note"
        >
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">{TOUCH_DEVICE_NOTICE}</p>
        </div>
      )}

      {/* Real-time Pressed Key Status Banner */}
      <div className="mt-4 p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isTestActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {isTestActive ? 'Capturing Keystrokes' : 'Inactive (Click Start Test to begin)'}
            </span>
          </div>

          <div>
            <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.keyboardTest.lastKeyPressed}: </span>
            <span className="font-semibold text-[#0F766E] dark:text-[#14B8A6] font-mono-num text-sm ml-1">
              <bdi>{lastKey ? lastKey.key : '—'}</bdi>
            </span>
          </div>

          <div>
            <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.keyboardTest.physicalCodeLabel}: </span>
            <span className="font-mono text-[#142033] dark:text-[#E9EEF4] font-medium ml-1">
              <bdi>{lastKey ? lastKey.code : '—'}</bdi>
            </span>
          </div>
        </div>

        <div className="font-mono-num text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          <span>{pressedCodes.size}</span> keys verified
        </div>
      </div>

      {/* Visual Keyboard Matrix */}
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[700px] p-3 rounded-xl bg-[#F6F7F9] dark:bg-[#0E1520] border border-[#DFE5EB] dark:border-[#223043] space-y-1.5">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1.5 justify-center">
              {row.map((k) => {
                const isCurrentlyActive = activeCodes.has(k.code);
                const hasBeenPressed = pressedCodes.has(k.code);
                const label = k.labels[layout] || k.labels.qwerty;

                return (
                  <div
                    key={k.code}
                    className={`h-11 ${k.width || 'w-11'} flex items-center justify-center rounded-md text-[11px] font-medium transition-all select-none border ${
                      isCurrentlyActive
                        ? 'bg-[#0F766E] text-white border-[#0D665F] scale-95 shadow-inner'
                        : hasBeenPressed
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-[#16202E] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#253448] shadow-xs'
                    }`}
                  >
                    <bdi>{label}</bdi>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-3 italic text-center">
        {t.keyboardTest.pressInstruction}
      </p>

      {/* Correction E: clearly SEPARATE virtual-typing check. Counts only
          keyCode-229/composition events, never touches the pass verdict,
          and says explicitly that it is not a keyboard test. */}
      {(touchDevice || virtualCount > 0) && (
        <div
          className="mt-3 p-3 rounded-lg bg-[#F6F8FB] dark:bg-[#192332] border border-dashed border-[#DFE5EB] dark:border-[#223043] text-xs"
          data-testid="virtual-typing-check"
        >
          <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
            Virtual keyboard typing check
          </p>
          <p className="mt-1 text-[#59677D] dark:text-[#9AA6B8] leading-relaxed">
            {VIRTUAL_TYPING_NOTICE}
          </p>
          <p className="mt-1.5 font-mono-num font-semibold text-[#0F766E] dark:text-[#14B8A6]" role="status">
            {virtualCount > 0
              ? `${virtualCount} on-screen key event${virtualCount === 1 ? '' : 's'} received${virtualInfo ? ` — ${virtualInfo}` : ''}`
              : 'Type on the on-screen keyboard to try it.'}
          </p>
        </div>
      )}

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />

      {/* OS Notice & Troubleshooting */}
      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            {t.keyboardTest.interpretationTitle}
          </h3>
          <p className="leading-relaxed">{t.keyboardTest.interpretationText}</p>
          <p className="mt-2 text-[11px] text-[#8996A6]">{t.keyboardTest.osInterceptionNotice}</p>
        </div>

        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
            {t.keyboardTest.troubleshootingTitle}
          </h3>
          <ul className="space-y-1.5 list-disc list-inside">
            {t.keyboardTest.troubleshootingSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
