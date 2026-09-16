'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Printer,
  Save,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Download,
} from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { MicrophoneTester } from '../tests/MicrophoneTester';
import { WebcamTester } from '../tests/WebcamTester';
import { SpeakersTester } from '../tests/SpeakersTester';
import { KeyboardTester } from '../tests/KeyboardTester';
import { MouseTester } from '../tests/MouseTester';
import { DisplayTester } from '../tests/DisplayTester';
import { GamepadTester } from '../tests/GamepadTester';
import { BatteryTester } from '../tests/BatteryTester';
import { saveLocalInspection } from '@/lib/testing/localHistory';

interface GuidedInspectionFlowProps {
  t: Translations;
  locale: Locale;
  isPro?: boolean;
  workspaceId?: string;
  companyName?: string;
}

type TestKey = 'mic' | 'webcam' | 'speakers' | 'keyboard' | 'mouse' | 'display' | 'gamepad' | 'battery';

interface TestStep {
  key: TestKey;
  title: string;
  category: 'audio' | 'video' | 'input' | 'display' | 'system';
}

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
    title: 'Full Diagnostic Suite (All 8 Tests)',
    desc: 'Complete inspection evaluating all available browser device APIs.',
    steps: ['mic', 'webcam', 'speakers', 'keyboard', 'mouse', 'display', 'gamepad', 'battery'],
  },
};

export function GuidedInspectionFlow({ t, locale, isPro, workspaceId, companyName }: GuidedInspectionFlowProps) {
  const [selectedSuiteKey, setSelectedSuiteKey] = useState<string>('pre_call');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1); // -1 = selection screen
  const [deviceLabel, setDeviceLabel] = useState<string>('Primary Laptop');
  const [operatorName, setOperatorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Results tracker
  const [results, setResults] = useState<
    Record<
      string,
      {
        status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported' | 'skipped';
        classification: 'browser' | 'user' | 'inconclusive' | 'unsupported' | 'skipped';
        details?: string;
        metrics?: Record<string, unknown>;
      }
    >
  >({});

  const [savedToCloud, setSavedToCloud] = useState<boolean>(false);
  const [savingCloud, setSavingCloud] = useState<boolean>(false);
  const [saveCloudError, setSaveCloudError] = useState<string | null>(null);

  const suite = PRESET_SUITES[selectedSuiteKey];
  const activeStepKey = suite.steps[activeStepIndex];
  const isFinished = activeStepIndex >= suite.steps.length;

  const startSuite = () => {
    setActiveStepIndex(0);
    setResults({});
    setSavedToCloud(false);
  };

  const handleStepResult = (
    key: TestKey,
    res: {
      status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported';
      details: string;
      metrics?: Record<string, unknown>;
    }
  ) => {
    setResults((prev) => ({
      ...prev,
      [key]: {
        ...res,
        classification:
          key === 'speakers' || key === 'display' ? 'user' : res.status === 'unsupported' ? 'unsupported' : 'browser',
      },
    }));
  };

  const nextStep = () => {
    if (!results[activeStepKey]) {
      // Mark as inconclusive if user advances without testing
      setResults((prev) => ({
        ...prev,
        [activeStepKey]: {
          status: 'inconclusive',
          classification: 'inconclusive',
          details: 'Inspection step concluded without active device interaction.',
        },
      }));
    }

    const nextIdx = activeStepIndex + 1;
    setActiveStepIndex(nextIdx);

    if (nextIdx >= suite.steps.length) {
      // Auto-save to local storage on finish
      saveLocalInspection({
        locale,
        deviceLabel: deviceLabel || 'Device',
        operatorName: operatorName || 'Visitor',
        summaryStatus: getOverallStatus(),
        testsResults: results,
        notes,
      });
    }
  };

  const skipStep = () => {
    setResults((prev) => ({
      ...prev,
      [activeStepKey]: {
        status: 'skipped',
        classification: 'skipped',
        details: 'User chose to skip this test during guided inspection.',
      },
    }));
    const nextIdx = activeStepIndex + 1;
    setActiveStepIndex(nextIdx);
  };

  const getOverallStatus = (): 'passed' | 'warning' | 'failed' | 'inconclusive' => {
    const statuses = Object.values(results).map((r) => r.status);
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.includes('inconclusive')) return 'inconclusive';
    return 'passed';
  };

  const saveInspectionToCloud = async () => {
    if (!isPro || !workspaceId) return;
    setSavingCloud(true);
    setSaveCloudError(null);

    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceLabel,
          operatorName,
          locale,
          summaryStatus: getOverallStatus(),
          testsResults: results,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveCloudError(data.error || 'Failed to save to cloud.');
      } else {
        setSavedToCloud(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setSaveCloudError(msg);
    } finally {
      setSavingCloud(false);
    }
  };

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

          {/* Preset Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(PRESET_SUITES).map(([key, s]) => (
              <div
                key={key}
                onClick={() => setSelectedSuiteKey(key)}
                className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedSuiteKey === key
                    ? 'border-[#0F766E] bg-[#F0FDF4] dark:bg-[#062420] shadow-sm'
                    : 'border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] hover:border-[#0F766E]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-[#142033] dark:text-[#E9EEF4]">
                      {s.title}
                    </h3>
                    {selectedSuiteKey === key && (
                      <CheckCircle className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
                    )}
                  </div>
                  <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-2 leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#DFE5EB] dark:border-[#223043] flex flex-wrap gap-1.5">
                  {s.steps.map((st) => (
                    <span
                      key={st}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043]"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Metadata: Device Label & Operator */}
          <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                {t.report.deviceIdentifier}
              </label>
              <input
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder={t.report.deviceIdentifierPlaceholder || "e.g. MacBook Air M2 or Dell XPS 15"}
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
                placeholder="e.g. Alex Tech or Buyer"
                className="w-full text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              id="btn-begin-inspection"
              onClick={startSuite}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-sm rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {t.hero.ctaPrimary}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 2: In-Progress Guided Step */}
      {activeStepIndex >= 0 && !isFinished && (
        <div className="space-y-6">
          {/* Step Progress Header */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] uppercase tracking-wider">
                {t.inspection.stepCount} {activeStepIndex + 1} / {suite.steps.length}
              </span>
              <h3 className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4] capitalize">
                {activeStepKey} Test
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={skipStep}
                className="px-3 py-1.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer"
              >
                {t.inspection.skipTest}
              </button>

              <button
                id="btn-next-step"
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                {t.common.next}
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>

          {/* Active Tester Component */}
          {activeStepKey === 'mic' && (
            <MicrophoneTester
              t={t}
              onRecordResult={(r) => handleStepResult('mic', r)}
            />
          )}
          {activeStepKey === 'webcam' && (
            <WebcamTester
              t={t}
              onRecordResult={(r) => handleStepResult('webcam', r)}
            />
          )}
          {activeStepKey === 'speakers' && (
            <SpeakersTester
              t={t}
              onRecordResult={(r) => handleStepResult('speakers', r)}
            />
          )}
          {activeStepKey === 'keyboard' && (
            <KeyboardTester
              t={t}
              onRecordResult={(r) => handleStepResult('keyboard', r)}
            />
          )}
          {activeStepKey === 'mouse' && (
            <MouseTester
              t={t}
              onRecordResult={(r) => handleStepResult('mouse', r)}
            />
          )}
          {activeStepKey === 'display' && (
            <DisplayTester
              t={t}
              onRecordResult={(r) => handleStepResult('display', r)}
            />
          )}
          {activeStepKey === 'gamepad' && (
            <GamepadTester
              t={t}
              onRecordResult={(r) => handleStepResult('gamepad', r)}
            />
          )}
          {activeStepKey === 'battery' && (
            <BatteryTester
              t={t}
              onRecordResult={(r) => handleStepResult('battery', r)}
            />
          )}
        </div>
      )}

      {/* MODE 3: Finished Inspection Summary & Printable Report */}
      {isFinished && (
        <div className="space-y-6">
          {/* Action Bar (Print / Cloud Save / Restart) */}
          <div className="no-print bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                id="btn-print-report"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#142033] dark:bg-[#E9EEF4] text-white dark:text-[#142033] font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {t.report.printReport}
              </button>

              {isPro && !savedToCloud && (
                <button
                  id="btn-cloud-save-report"
                  onClick={saveInspectionToCloud}
                  disabled={savingCloud}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingCloud ? 'Saving to Cloud...' : t.report.saveToProCloud}
                </button>
              )}

              {savedToCloud && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Saved to Cloud Workspace
                </span>
              )}
            </div>

            <button
              onClick={() => setActiveStepIndex(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start New Inspection
            </button>
          </div>

          {saveCloudError && (
            <div className="no-print p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs">
              {saveCloudError}
            </div>
          )}

          {/* Printable Structured Certificate / Report Card */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm print:border-none print:shadow-none print:p-0">
            {/* Header / Pro Branding */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#DFE5EB] dark:border-[#223043] gap-4">
              <div>
                <span className="text-xs font-bold text-[#0F766E] dark:text-[#14B8A6] uppercase tracking-widest">
                  {companyName ? `${companyName} • ` : ''}Hardware Inspection Certificate
                </span>
                <h2 className="text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
                  {deviceLabel || 'Hardware Inspection'}
                </h2>
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 font-mono-num">
                  Date: {new Date().toLocaleDateString(locale, { dateStyle: 'full' })} | Operator: {operatorName || 'Anonymous Visitor'}
                </p>
              </div>

              {/* Overall Status Badge */}
              <div>
                <div
                  className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${
                    getOverallStatus() === 'passed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : getOverallStatus() === 'warning'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-red-50 text-red-800 border-red-300'
                  }`}
                >
                  {getOverallStatus() === 'passed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {getOverallStatus() === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {getOverallStatus() === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="uppercase">{getOverallStatus()}</span>
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
                          {res.classification === 'browser' ? t.report.classificationBrowser : t.report.classificationUser}
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
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add physical condition notes (e.g., cosmetic scratches, hinge firmness, missing accessories)..."
                rows={3}
                className="w-full text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            {/* Honest Hardware Notice */}
            <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
              <strong>Notice of Browser-Based Scope:</strong> This inspection document records observed browser-level media streams, user input events, and confirmed sensory feedback. It does not certify internal hardware manufacturing tolerances, optical lens lab ratings, or battery capacity beyond standard browser APIs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
