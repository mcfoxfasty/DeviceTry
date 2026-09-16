'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Camera,
  Keyboard,
  Mouse,
  Volume2,
  Monitor,
  Gamepad2,
  Battery,
  ClipboardCheck,
  History,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Trash2,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { MicrophoneTester } from './tests/MicrophoneTester';
import { WebcamTester } from './tests/WebcamTester';
import { KeyboardTester } from './tests/KeyboardTester';
import { MouseTester } from './tests/MouseTester';
import { SpeakersTester } from './tests/SpeakersTester';
import { DisplayTester } from './tests/DisplayTester';
import { GamepadTester } from './tests/GamepadTester';
import { BatteryTester } from './tests/BatteryTester';
import { GuidedInspectionFlow } from './inspection/GuidedInspectionFlow';
import {
  getLocalInspections,
  deleteLocalInspection,
  clearAllLocalInspections,
  LocalInspectionItem,
} from '@/lib/testing/localHistory';

interface HomeClientProps {
  t: Translations;
  locale: Locale;
  initialTab?: string;
  initialTest?: string;
  isPro?: boolean;
  workspaceId?: string;
  companyName?: string;
}

type TestType = 'mic' | 'webcam' | 'keyboard' | 'mouse' | 'speakers' | 'display' | 'gamepad' | 'battery';

export function HomeClient({
  t,
  locale,
  initialTab = 'tests',
  initialTest = 'mic',
  isPro,
  workspaceId,
  companyName,
}: HomeClientProps) {
  const [activeTab, setActiveTab] = useState<'tests' | 'inspection' | 'history'>(
    initialTab === 'inspection' ? 'inspection' : initialTab === 'history' ? 'history' : 'tests'
  );
  const [activeTest, setActiveTest] = useState<TestType>((initialTest as TestType) || 'mic');
  const [localInspections, setLocalInspections] = useState<LocalInspectionItem[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalInspections(getLocalInspections());
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleDeleteLocal = (id: string) => {
    deleteLocalInspection(id);
    setLocalInspections(getLocalInspections());
  };

  const handleClearAllLocal = () => {
    if (confirm('Clear all locally saved inspections from this browser?')) {
      clearAllLocalInspections();
      setLocalInspections([]);
    }
  };

  const testList: { key: TestType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'mic', label: t.micTest.title, icon: <Mic className="w-4 h-4" />, desc: 'Waveform & Levels' },
    { key: 'webcam', label: t.webcamTest.title, icon: <Camera className="w-4 h-4" />, desc: 'Resolution & FPS' },
    { key: 'keyboard', label: t.keyboardTest.title, icon: <Keyboard className="w-4 h-4" />, desc: 'Keys & Codes' },
    { key: 'mouse', label: t.mouseTest.title, icon: <Mouse className="w-4 h-4" />, desc: 'Clicks & Chatter' },
    { key: 'speakers', label: t.speakersTest.title, icon: <Volume2 className="w-4 h-4" />, desc: 'L/R Channels' },
    { key: 'display', label: t.displayTest.title, icon: <Monitor className="w-4 h-4" />, desc: 'Dead Pixels & Hz' },
    { key: 'gamepad', label: t.gamepadTest.title, icon: <Gamepad2 className="w-4 h-4" />, desc: 'Drift & Buttons' },
    { key: 'battery', label: t.batteryTest.title, icon: <Battery className="w-4 h-4" />, desc: 'Charge Status' },
  ];

  const faqs = [
    {
      q: 'How do browser-based device tests work?',
      a: 'Modern browsers provide secure, standardized APIs (WebRTC getUserMedia, Web Audio Analyser, Gamepad API, KeyboardEvent, and Battery Status). DeviceTry queries these direct browser interfaces to measure live signals, verify permissions, and detect hardware issues without installing desktop drivers or software.',
    },
    {
      q: 'Does DeviceTry record or store my video or audio streams?',
      a: 'Never. All video feeds, microphone waveforms, key strokes, and audio playback are executed completely in your local browser client memory. Streams are never transmitted to our servers or any third-party cloud. When you close the browser tab, all media tracks are immediately destroyed.',
    },
    {
      q: 'Why should I run tests before a Zoom, Google Meet, or Microsoft Teams call?',
      a: 'Over 80% of video meeting failures stem from blocked browser permissions, wrong default microphone inputs, or unplugged USB devices. Running a quick 3-minute check ensures your camera delivers full HD resolution and your microphone registers clear vocal levels before joining.',
    },
    {
      q: 'What additional capabilities does DeviceTry Pro provide?',
      a: 'DeviceTry Pro adds cloud persistence, custom PDF report branding with your company logo, an inventory tracker for up to 200 devices, and 25 custom inspection checklist templates. It is designed for IT departments, computer refurbishment shops, and remote teams.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto pt-4 pb-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          100% Client-Side • Zero Audio/Video Uploads
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#142033] dark:text-[#E9EEF4] tracking-tight">
          {t.hero.title}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
          {t.hero.subtitle}
        </p>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex justify-center">
        <div className="bg-[#E9EEF4] dark:bg-[#16202E] p-1 rounded-xl flex items-center gap-1 max-w-md w-full border border-[#DFE5EB] dark:border-[#223043]">
          <button
            id="tab-btn-individual-tests"
            onClick={() => setActiveTab('tests')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'tests'
                ? 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] shadow-xs'
                : 'text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4]'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.nav.tools}
          </button>

          <button
            id="tab-btn-guided-inspection"
            onClick={() => setActiveTab('inspection')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'inspection'
                ? 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] shadow-xs'
                : 'text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4]'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.nav.guidedInspection}
          </button>

          <button
            id="tab-btn-local-history"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] shadow-xs'
                : 'text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            Local History
            {localInspections.length > 0 && (
              <span className="ml-1 bg-[#0F766E] text-white rounded-full px-1.5 py-0.2 text-[10px]">
                {localInspections.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW 1: Individual Tests */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Test Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {testList.map((item) => (
              <button
                key={item.key}
                id={`select-test-${item.key}`}
                onClick={() => setActiveTest(item.key)}
                className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between ${
                  activeTest === item.key
                    ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-sm'
                    : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={activeTest === item.key ? 'text-white' : 'text-[#0F766E] dark:text-[#14B8A6]'}>
                    {item.icon}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-semibold leading-tight">{item.label}</p>
                  <p className={`text-[10px] mt-0.5 ${activeTest === item.key ? 'text-emerald-100' : 'text-[#5F6B7A] dark:text-[#9AA6B8]'}`}>
                    {item.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Active Tester Box */}
          <div>
            {activeTest === 'mic' && <MicrophoneTester t={t} />}
            {activeTest === 'webcam' && <WebcamTester t={t} />}
            {activeTest === 'keyboard' && <KeyboardTester t={t} />}
            {activeTest === 'mouse' && <MouseTester t={t} />}
            {activeTest === 'speakers' && <SpeakersTester t={t} />}
            {activeTest === 'display' && <DisplayTester t={t} />}
            {activeTest === 'gamepad' && <GamepadTester t={t} />}
            {activeTest === 'battery' && <BatteryTester t={t} />}
          </div>
        </div>
      )}

      {/* VIEW 2: Guided Inspection */}
      {activeTab === 'inspection' && (
        <GuidedInspectionFlow
          t={t}
          locale={locale}
          isPro={isPro}
          workspaceId={workspaceId}
          companyName={companyName}
        />
      )}

      {/* VIEW 3: Local Browser History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
            <div>
              <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
                <History className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
                Local Inspection History
              </h2>
              <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                Hardware inspections saved in your browser local storage
              </p>
            </div>

            {localInspections.length > 0 && (
              <button
                onClick={handleClearAllLocal}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
            Notice: Free device test records run 100% in your local browser and persist in your device local storage. Pro subscribers can cloud-sync records.
          </div>

          {localInspections.length > 0 ? (
            <div className="mt-6 space-y-3">
              {localInspections.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
                        {item.deviceLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.summaryStatus === 'passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.summaryStatus === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.summaryStatus}
                      </span>
                    </div>

                    <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                      {new Date(item.createdAt).toLocaleString(locale)} • Inspector: {item.operatorName || 'Anonymous'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md text-xs font-medium hover:border-[#0F766E] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>

                    <button
                      onClick={() => handleDeleteLocal(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 py-12 text-center text-[#5F6B7A] dark:text-[#9AA6B8]">
              <History className="w-10 h-10 mx-auto opacity-40 mb-2" />
              <p className="text-sm font-medium">No Local Inspections Recorded</p>
              <p className="text-xs mt-1">Run an individual test or guided inspection to see your local results history here.</p>
            </div>
          )}
        </div>
      )}

      {/* Informational FAQ Section */}
      <div className="mt-16 pt-10 border-t border-[#DFE5EB] dark:border-[#223043] max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] text-center mb-6">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full p-4 text-left rtl:text-right flex items-center justify-between gap-4 font-semibold text-sm text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#5F6B7A] transition-transform ${
                    expandedFaq === idx ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedFaq === idx && (
                <div className="px-4 pb-4 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed border-t border-[#DFE5EB] dark:border-[#223043] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
