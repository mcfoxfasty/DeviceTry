'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Printer,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { MicrophoneTester } from '../tests/MicrophoneTester';
import { WebcamTester } from '../tests/WebcamTester';
import { SpeakersTester } from '../tests/SpeakersTester';
import { KeyboardTester } from '../tests/KeyboardTester';
import { MouseTester } from '../tests/MouseTester';
import { DisplayTester } from '../tests/DisplayTester';
import { GamepadTester } from '../tests/GamepadTester';
import { BatteryTester } from '../tests/BatteryTester';
import { saveLocalInspection, updateLocalInspectionNotes } from '@/lib/testing/localHistory';
import { calculateReportStatus, TestResultItem } from '@/lib/testing/reportStatus';

interface GuidedInspectionFlowProps {
  t: Translations;
  isPro?: boolean;
  workspaceId?: string;
  companyName?: string;
}

type TestKey = 'mic' | 'webcam' | 'speakers' | 'keyboard' | 'mouse' | 'display' | 'gamepad' | 'battery';

const PRESET_SUITES: Record<string, { title: string; desc: string; steps: TestKey[] }> = {
  pre_call: {
    title: 'Pre-Call / Meeting Readiness (3 Mins)',
    desc: 'Verifies microphone audio input, webcam video, and speaker clarity before an interview or video conference.',
    steps: ['mic', 'webcam', 'speakers'],
  },
  used_hardware: {
    title: 'Used Computer Hardware Inspection (7 Mins)',
    desc: 'Comprehensive check for buying or selling a laptop or desktop: display, keyboard, mouse, audio, video, battery.',
    steps: ['display', 'keyboard', 'mouse', 'speakers', 'mic', 'webcam', 'battery'],
  },
  classroom: {
    title: 'Classroom / Lab Kiosk Verification (4 Mins)',
    desc: 'Rapid diagnostic run for school lab workstations or shared kiosks: keyboard, mouse, audio, display.',
    steps: ['keyboard', 'mouse', 'display', 'speakers'],
  },
  full: {
    title: 'Full Diagnostic Check (All 8 Tests)',
    desc: 'Complete inspection evaluating all available browser device APIs.',
    steps: ['mic', 'webcam', 'speakers', 'keyboard', 'mouse', 'display', 'gamepad', 'battery'],
  },
};

export function GuidedInspectionFlow({
  t,
  companyName,
}: GuidedInspectionFlowProps) {
  const [selectedSuiteKey, setSelectedSuiteKey] = useState<string>('used_hardware');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1); // -1 = config screen
  const [deviceLabel, setDeviceLabel] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  // Set when saving the local report fails (quota exceeded / storage disabled):
  // shown honestly in the finished-report UI instead of being swallowed.
  const [saveError, setSaveError] = useState<string | null>(null);
  // Guards the async save attempt against a New Inspection reset in flight.
  const saveRunRef = useRef<number>(0);

  // Results tracker
  const [results, setResults] = useState<Record<string, TestResultItem>>({});
  const resultsRef = useRef<Record<string, TestResultItem>>({});

  // The report id this run saved into (set on first finish). Going back and
  // finishing again UPDATES the same local entry instead of creating a
  // duplicate history row for one inspection run.
  const savedIdRef = useRef<string | null>(null);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const suite = PRESET_SUITES[selectedSuiteKey];
  const activeStepKey = suite.steps[activeStepIndex];
  const isFinished = activeStepIndex >= suite.steps.length;

  const startSuite = () => {
    saveRunRef.current += 1;
    setActiveStepIndex(0);
    setResults({});
    resultsRef.current = {};
    setSaveError(null);
    savedIdRef.current = null; // a new run is a new local history entry
  };

  const handleStepResult = (
    key: TestKey,
    res: {
      status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported';
      details: string;
      metrics?: Record<string, unknown>;
    }
  ) => {
    const updated: TestResultItem = {
      ...res,
      classification:
        key === 'speakers' || key === 'display' ? 'user' : res.status === 'unsupported' ? 'unsupported' : 'browser',
    };

    setResults((prev) => {
      const next = { ...prev, [key]: updated };
      resultsRef.current = next;
      return next;
    });
  };

  /**
   * Backward-compatible clear callback (onResultClear): removes the step's
   * old entry from BOTH results state and resultsRef when the user resets,
   * retests, or changes the selected device. The report becomes inconclusive
   * until the new observation produces a result. A completed step is never
   * erased merely because its component unmounted — clear only fires from
   * explicit user actions inside the tester.
   */
  const clearStepResult = (key: TestKey) => {
    setResults((prev) => {
      if (!(key in prev)) return prev; // nothing recorded — no state change
      const next = { ...prev };
      delete next[key];
      resultsRef.current = next;
      return next;
    });
  };

  const persistOnFinish = (currentResults: Record<string, TestResultItem>) => {
    const finalStatus = calculateReportStatus(suite.steps, currentResults);
    const saveRun = ++saveRunRef.current;
    if (savedIdRef.current) {
      // This run already saved once (user went back and re-finished):
      // update the SAME history entry instead of duplicating it. Notes may
      // have changed since the first save — sync them too.
      const updated = updateLocalInspectionNotes(savedIdRef.current, notes);
      if (!updated && saveRun === saveRunRef.current) {
        setSaveError(
          'The re-finished report could NOT be refreshed in your browser history. Local storage is unavailable or full — use Print / Save as PDF or Export JSON to keep a copy.'
        );
      }
      return;
    }
    const savedItem = saveLocalInspection({
      locale: 'en',
      deviceLabel: deviceLabel || 'Device',
      operatorName: operatorName || 'Visitor',
      summaryStatus: finalStatus,
      testsResults: currentResults,
      notes,
    });
    if (savedItem.saved) {
      savedIdRef.current = savedItem.id;
    }
    // saveLocalInspection returns saved:false when localStorage rejected the
    // write (quota exceeded, disabled storage). Surface it honestly — never
    // claim the report was stored when it was not.
    if (!savedItem.saved && saveRun === saveRunRef.current) {
      setSaveError(
        'This inspection could NOT be saved to your browser history. Local storage is unavailable or full — use Print / Save as PDF or Export JSON to keep a copy.'
      );
    }
  };

  const nextStep = () => {
    let currentResults = { ...resultsRef.current };

    if (!currentResults[activeStepKey]) {
      // Mark as inconclusive if user advances without testing
      const inconclusiveItem: TestResultItem = {
        status: 'inconclusive',
        classification: 'inconclusive',
        details: 'Inspection step concluded without active device interaction.',
      };
      currentResults = {
        ...currentResults,
        [activeStepKey]: inconclusiveItem,
      };
      setResults(currentResults);
      resultsRef.current = currentResults;
    }

    const nextIdx = activeStepIndex + 1;
    setActiveStepIndex(nextIdx);

    if (nextIdx >= suite.steps.length) {
      // Auto-save to local history on completion with newly updated complete test results
      persistOnFinish(currentResults);
    }
  };

  const skipStep = () => {
    const skippedItem: TestResultItem = {
      status: 'skipped',
      classification: 'skipped',
      details: 'User chose to skip this test during guided inspection.',
    };
    const currentResults = {
      ...resultsRef.current,
      [activeStepKey]: skippedItem,
    };
    setResults(currentResults);
    resultsRef.current = currentResults;

    const nextIdx = activeStepIndex + 1;
    setActiveStepIndex(nextIdx);

    if (nextIdx >= suite.steps.length) {
      persistOnFinish(currentResults);
    }
  };

  const overallStatus = calculateReportStatus(suite.steps, results);

  return (
    <div className="w-full">
      {/* MODE 1: Suite Preset Selection */}
      {activeStepIndex === -1 && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
          <div className="pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
            <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {t.inspection.title}
            </h2>
            <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
              {t.inspection.subtitle}
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-3 uppercase tracking-wider">
                {t.inspection.selectPreset}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(PRESET_SUITES).map(([k, s]) => (
                  <button
                    key={k}
                    onClick={() => setSelectedSuiteKey(k)}
                    className={`p-4 rounded-xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between ${
                      selectedSuiteKey === k
                        ? 'border-[#0F766E] bg-[#E6F4F2]/30 dark:bg-[#133230]/40 ring-1 ring-[#0F766E]'
                        : 'border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-[#142033] dark:text-[#E9EEF4]">
                        {s.title}
                      </h4>
                      <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {s.steps.map((st) => (
                        <span
                          key={st}
                          className="px-2 py-0.5 rounded bg-[#F6F7F9] dark:bg-[#192332] text-[10px] font-mono text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] uppercase"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Inspection Context Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#DFE5EB] dark:border-[#223043]">
              <div>
                <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  {t.report.deviceIdentifier}
                </label>
                <input
                  type="text"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder={t.report.deviceIdentifierPlaceholder}
                  className="w-full text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                  {t.report.testedBy}
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. IT Technician / Staff"
                  className="w-full text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                id="btn-start-inspection-flow"
                onClick={startSuite}
                className="px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                {t.inspection.presetComprehensive}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Active Guided Step */}
      {activeStepIndex >= 0 && !isFinished && (
        <div className="space-y-6">
          {/* Progress Tracker Bar */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-[#0F766E] dark:text-[#14B8A6] uppercase tracking-wider">
                {suite.title}
              </span>
              <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4] mt-0.5">
                {t.inspection.stepCount} ({activeStepIndex + 1} / {suite.steps.length}): {activeStepKey.toUpperCase()}
              </h3>
            </div>

            {/* Stepper Dots — status-aware: a dot's fill reflects the step's
                recorded outcome (completed / skipped / inconclusive), so the
                user can see at a glance which steps still need attention. */}
            <div className="flex items-center gap-2">
              {suite.steps.map((st, i) => {
                const stepResult = results[st];
                const stepCls =
                  i === activeStepIndex
                    ? 'bg-[#0F766E] text-white ring-2 ring-emerald-300'
                    : stepResult?.status === 'passed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : stepResult?.status === 'warning'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : stepResult?.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : stepResult?.status === 'skipped' || stepResult?.status === 'inconclusive'
                            ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 line-through'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                return (
                  <div
                    key={st}
                    title={
                      stepResult
                        ? `${st}: ${stepResult.status}`
                        : `${st}: not evaluated yet`
                    }
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${stepCls}`}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Render Current Tester with pass/fail telemetry hook */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
            {/* Revisit hint: going back to a step that already recorded a
                result makes the rerun outcome explicit — a rerun replaces the
                recorded value; nothing is merged or averaged. */}
            {results[activeStepKey] && (
              <p role="status" className="mb-4 px-3 py-2 rounded-lg bg-[#EEF7F5] dark:bg-[#133230] border border-[#0F766E]/30 text-[11px] font-medium text-[#0F766E] dark:text-[#14B8A6]">
                This step already has a recorded result ({results[activeStepKey].status}). Running it again replaces that result — the report always keeps only the latest observation.
              </p>
            )}
            {activeStepKey === 'mic' && (
              <MicrophoneTester
                t={t}
                onRecordResult={(res) => handleStepResult('mic', res)}
                onResultClear={() => clearStepResult('mic')}
              />
            )}
            {activeStepKey === 'webcam' && (
              <WebcamTester
                t={t}
                onRecordResult={(res) => handleStepResult('webcam', res)}
                onResultClear={() => clearStepResult('webcam')}
              />
            )}
            {activeStepKey === 'speakers' && (
              <SpeakersTester
                t={t}
                onRecordResult={(res) => handleStepResult('speakers', res)}
                onResultClear={() => clearStepResult('speakers')}
              />
            )}
            {activeStepKey === 'keyboard' && (
              <KeyboardTester
                t={t}
                onRecordResult={(res) => handleStepResult('keyboard', res)}
                onResultClear={() => clearStepResult('keyboard')}
              />
            )}
            {activeStepKey === 'mouse' && (
              <MouseTester
                t={t}
                onRecordResult={(res) => handleStepResult('mouse', res)}
                onResultClear={() => clearStepResult('mouse')}
              />
            )}
            {activeStepKey === 'display' && (
              <DisplayTester
                t={t}
                onRecordResult={(res) => handleStepResult('display', res)}
                onResultClear={() => clearStepResult('display')}
              />
            )}
            {activeStepKey === 'gamepad' && (
              <GamepadTester
                t={t}
                onRecordResult={(res) => handleStepResult('gamepad', res)}
                onResultClear={() => clearStepResult('gamepad')}
              />
            )}
            {activeStepKey === 'battery' && (
              <BatteryTester
                t={t}
                onRecordResult={(res) => handleStepResult('battery', res)}
                onResultClear={() => clearStepResult('battery')}
              />
            )}

            {/* Step Advancement Controls */}
            <div className="mt-8 pt-6 border-t border-[#DFE5EB] dark:border-[#223043] flex items-center justify-between">
              <button
                onClick={skipStep}
                className="px-4 py-2 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer"
              >
                {t.inspection.skipTest}
              </button>

              <div className="flex items-center gap-3">
                {activeStepIndex > 0 && (
                  <button
                    onClick={() => setActiveStepIndex((prev) => prev - 1)}
                    className="px-4 py-2 border border-[#DFE5EB] dark:border-[#223043] rounded-lg text-xs font-medium text-[#142033] dark:text-[#E9EEF4] hover:bg-slate-50 dark:hover:bg-[#192332] cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                    Previous
                  </button>
                )}

                <button
                  id="btn-next-inspection-step"
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {activeStepIndex === suite.steps.length - 1
                    ? t.inspection.finishInspection
                    : t.inspection.viewReport}
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: Finished Inspection Report */}
      {isFinished && (
        <div className="space-y-6">
          {/* Action Ribbon (Print / Reset) */}
          <div className="no-print bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-4 flex flex-wrap items-center justify-between gap-4">
            {saveError && (
              <div
                role="alert"
                className="w-full p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                id="btn-print-report"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                {t.report.printReport}
              </button>
            </div>

            <button
              onClick={() => {
                // Invalidate any in-flight save attempt and clear the flow's
                // own state so a new inspection starts clean.
                saveRunRef.current += 1;
                setResults({});
                resultsRef.current = {};
                setSaveError(null);
                setActiveStepIndex(-1);
              }}
              className="px-4 py-2 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Inspection
            </button>
          </div>

          {/* Printable Report Canvas */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#DFE5EB] dark:border-[#223043] gap-4">
              <div>
                <span className="text-xs font-bold text-[#0F766E] dark:text-[#14B8A6] uppercase tracking-widest">
                  {companyName ? `${companyName} • ` : ''}{t.report.title}
                </span>
                <h2 className="text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
                  {deviceLabel || 'Hardware Inspection'}
                </h2>
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 font-mono-num">
                  {t.report.inspectionDate}: {new Date().toLocaleDateString('en', { dateStyle: 'full' })} | {t.report.testedBy}:{' '}
                  {operatorName || 'Anonymous Visitor'}
                </p>
              </div>

              {/* Overall Status Badge */}
              <div>
                <div
                  className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${
                    overallStatus === 'passed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : overallStatus === 'warning'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : overallStatus === 'failed'
                      ? 'bg-red-50 text-red-800 border-red-300'
                      : 'bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                >
                  {overallStatus === 'passed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {overallStatus === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {overallStatus === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                  {overallStatus === 'inconclusive' && <HelpCircle className="w-5 h-5 text-slate-600" />}
                  <span className="uppercase">{overallStatus}</span>
                </div>
              </div>
            </div>

            {/* Test Results Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8]">
                    <th className="py-2.5 font-semibold">Test Module</th>
                    <th className="py-2.5 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Classification</th>
                    <th className="py-2.5 font-semibold">Observations & Technical Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                  {suite.steps.map((key) => {
                    const res = results[key] || {
                      status: 'skipped',
                      classification: 'skipped',
                      details: 'Not evaluated',
                    };

                    return (
                      <tr key={key} className="text-[#142033] dark:text-[#E9EEF4]">
                        <td className="py-3 font-medium capitalize">{key}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              res.status === 'passed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : res.status === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : res.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {res.status}
                          </span>
                        </td>
                        <td className="py-3 text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] capitalize">
                          {res.classification === 'browser'
                            ? t.report.classificationBrowser
                            : res.classification === 'user'
                            ? t.report.classificationUser
                            : res.classification}
                        </td>
                        <td className="py-3 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
                          {res.details || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            <div className="mt-8 pt-6 border-t border-[#DFE5EB] dark:border-[#223043]">
              <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                {t.inspection.notesPrompt}
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  // Keep the saved local history entry in sync with what the
                  // user sees and prints. Best-effort: if storage fails, the
                  // printed copy is still authoritative.
                  if (savedIdRef.current) {
                    updateLocalInspectionNotes(savedIdRef.current, e.target.value);
                  }
                }}
                placeholder="Add physical condition notes (e.g., cosmetic scratches, hinge firmness, missing accessories)..."
                rows={3}
                className="w-full text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            {/* Scope notice */}
            <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
              <strong>{t.report.disclaimerTitle}:</strong> {t.report.disclaimerText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
