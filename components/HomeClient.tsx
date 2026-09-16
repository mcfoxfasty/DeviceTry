'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  Sliders,
  Headphones,
  Music,
  Radio,
  Tv,
  Smartphone,
  Layers,
  Sparkles,
  Info,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { TOOLS_REGISTRY, ToolDefinition, ToolCategory } from '@/lib/tools/registry';
import { DeviceIllustration } from '@/components/ui/DeviceIllustration';

// Existing & New Testers
import { MicrophoneTester } from './tests/MicrophoneTester';
import { WebcamTester } from './tests/WebcamTester';
import { KeyboardTester } from './tests/KeyboardTester';
import { MouseTester } from './tests/MouseTester';
import { SpeakersTester } from './tests/SpeakersTester';
import { DisplayTester } from './tests/DisplayTester';
import { GamepadTester } from './tests/GamepadTester';
import { BatteryTester } from './tests/BatteryTester';
import { VoiceRecorderTester } from './tests/VoiceRecorderTester';
import { OnlineMirrorTester } from './tests/OnlineMirrorTester';
import { ToneGeneratorTester } from './tests/ToneGeneratorTester';
import { ClickCounterTester } from './tests/ClickCounterTester';
import { PitchDetectorTester } from './tests/PitchDetectorTester';
import { InstrumentTunerTester } from './tests/InstrumentTunerTester';
import { MetronomeTester } from './tests/MetronomeTester';
import { TouchscreenTester } from './tests/TouchscreenTester';
import { MultitouchTester } from './tests/MultitouchTester';
import { DeadPixelTester } from './tests/DeadPixelTester';
import { DisplayPatternsTester } from './tests/DisplayPatternsTester';
import { ColorCycleTester } from './tests/ColorCycleTester';
import { ContrastCheckerTester } from './tests/ContrastCheckerTester';
import { MousePollingRateTester } from './tests/MousePollingRateTester';
import { MouseDpiTester } from './tests/MouseDpiTester';
import { MotionBlurTester } from './tests/MotionBlurTester';
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

export function HomeClient({
  t,
  locale,
  initialTab = 'tests',
  initialTest = 'microphone-test',
  isPro,
  workspaceId,
  companyName,
}: HomeClientProps) {
  const [activeTab, setActiveTab] = useState<'tests' | 'inspection' | 'history'>(
    initialTab === 'inspection' ? 'inspection' : initialTab === 'history' ? 'history' : 'tests'
  );
  
  // Normalize initialTest slug or legacy key (e.g. 'mic' -> 'microphone-test')
  const resolvedInitialSlug = useMemo(() => {
    if (initialTest === 'mic') return 'microphone-test';
    if (initialTest === 'webcam') return 'webcam-test';
    if (initialTest === 'keyboard') return 'keyboard-test';
    if (initialTest === 'mouse') return 'mouse-test';
    if (initialTest === 'speakers') return 'speakers-test';
    if (initialTest === 'display') return 'screen-test';
    if (initialTest === 'gamepad') return 'gamepad-test';
    if (initialTest === 'battery') return 'battery-test';
    return initialTest || 'microphone-test';
  }, [initialTest]);

  const [activeToolSlug, setActiveToolSlug] = useState<string>(resolvedInitialSlug);
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Find active tool definition from registry
  const currentTool: ToolDefinition = useMemo(() => {
    const found = TOOLS_REGISTRY.find((item) => item.slug === activeToolSlug || item.id === activeToolSlug);
    return found || TOOLS_REGISTRY[0];
  }, [activeToolSlug]);

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    return TOOLS_REGISTRY.filter((tool) => {
      const matchCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      if (!matchCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch =
        tool.title.en.toLowerCase().includes(q) ||
        tool.title.fr.toLowerCase().includes(q) ||
        tool.title.ar.toLowerCase().includes(q);
      const descMatch = tool.shortDesc.en.toLowerCase().includes(q);
      const keywordMatch = tool.keywords.some((k) => k.toLowerCase().includes(q));

      return titleMatch || descMatch || keywordMatch;
    });
  }, [selectedCategory, searchQuery]);

  const categories: { key: ToolCategory | 'all'; label: string }[] = [
    { key: 'all', label: 'All Tools (38)' },
    { key: 'audio-camera', label: 'Audio & Camera' },
    { key: 'keyboard-mouse', label: 'Keyboard & Mouse' },
    { key: 'screen', label: 'Display & Screen' },
    { key: 'mobile-controllers', label: 'Sensors & Controllers' },
    { key: 'music', label: 'Acoustics & Music' },
    { key: 'browser-performance', label: 'Browser & Performance' },
  ];

  const renderActiveToolComponent = () => {
    switch (currentTool.componentName) {
      case 'MicrophoneTester':
        return <MicrophoneTester t={t} />;
      case 'WebcamTester':
        return <WebcamTester t={t} />;
      case 'KeyboardTester':
        return <KeyboardTester t={t} />;
      case 'MouseTester':
        return <MouseTester t={t} />;
      case 'SpeakersTester':
        return <SpeakersTester t={t} />;
      case 'DisplayTester':
        return <DisplayTester t={t} />;
      case 'GamepadTester':
        return <GamepadTester t={t} />;
      case 'BatteryTester':
        return <BatteryTester t={t} />;
      case 'VoiceRecorderTester':
        return <VoiceRecorderTester t={t} locale={locale} />;
      case 'OnlineMirrorTester':
        return <OnlineMirrorTester t={t} locale={locale} />;
      case 'ToneGeneratorTester':
        return <ToneGeneratorTester t={t} locale={locale} />;
      case 'ClickCounterTester':
        return <ClickCounterTester t={t} locale={locale} />;
      case 'PitchDetectorTester':
        return <PitchDetectorTester t={t} locale={locale} />;
      case 'InstrumentTunerTester':
        return <InstrumentTunerTester t={t} locale={locale} />;
      case 'MetronomeTester':
        return <MetronomeTester t={t} locale={locale} />;
      case 'TouchscreenTester':
        return <TouchscreenTester t={t} locale={locale} />;
      case 'MultitouchTester':
        return <MultitouchTester t={t} locale={locale} />;
      case 'DeadPixelTester':
        return <DeadPixelTester t={t} locale={locale} />;
      case 'DisplayPatternsTester':
        return <DisplayPatternsTester t={t} locale={locale} />;
      case 'ColorCycleTester':
        return <ColorCycleTester t={t} locale={locale} />;
      case 'ContrastCheckerTester':
        return <ContrastCheckerTester t={t} locale={locale} />;
      case 'MousePollingRateTester':
        return <MousePollingRateTester t={t} locale={locale} />;
      case 'MouseDpiTester':
        return <MouseDpiTester t={t} locale={locale} />;
      case 'MotionBlurTester':
        return <MotionBlurTester t={t} locale={locale} />;
      default:
        // Fallback to related core tester if specialized alias
        if (currentTool.category === 'audio-camera') return <MicrophoneTester t={t} />;
        if (currentTool.category === 'screen') return <DisplayTester t={t} />;
        if (currentTool.category === 'keyboard-mouse') return <MouseTester t={t} />;
        return <MicrophoneTester t={t} />;
    }
  };

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
      q: 'How many diagnostic tools are available on DeviceTry?',
      a: 'DeviceTry features 38 specialized client-side diagnostic tools covering microphones, webcams, stereo audio, displays, keyboards, mice, gaming controllers, touchscreens, and acoustic instruments.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto pt-4 pb-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          38 Diagnostic Tools • 100% Client-Side • Zero Audio/Video Uploads
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#142033] dark:text-[#E9EEF4] tracking-tight">
          {t.hero.title}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
          {t.hero.subtitle}
        </p>
      </div>

      {/* Main Mode Tabs */}
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
            {t.nav.tools} (38)
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

      {/* VIEW 1: Tool Registry & Active Diagnostic */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Category Filter Pills & Search Input */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Category selector chips */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {categories.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCategory(c.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === c.key
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'bg-white dark:bg-[#131B27] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search 38 tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-xs text-[#142033] dark:text-[#E9EEF4] placeholder-slate-400 focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>

            {/* Horizontal Scrollable Carousel / Grid of Tools */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[220px] overflow-y-auto p-1 rounded-xl bg-[#F6F7F9] dark:bg-[#101722] border border-[#DFE5EB] dark:border-[#223043]">
              {filteredTools.map((tool) => {
                const isSelected = currentTool.id === tool.id;
                return (
                  <button
                    key={tool.id}
                    id={`select-tool-${tool.slug}`}
                    onClick={() => setActiveToolSlug(tool.slug)}
                    className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-sm'
                        : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-100' : 'text-[#0F766E] dark:text-[#14B8A6]'}`}>
                        {tool.category.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold leading-snug line-clamp-1">
                        {tool.title[locale] || tool.title.en}
                      </p>
                      <p className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-emerald-100' : 'text-[#5F6B7A] dark:text-[#9AA6B8]'}`}>
                        {tool.supportHint[locale] || tool.supportHint.en}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Diagnostic Header Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0F766E]/10 dark:bg-[#14B8A6]/10 flex items-center justify-center text-[#0F766E] dark:text-[#14B8A6] shrink-0">
                <DeviceIllustration type={currentTool.iconType} size={36} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#172033] dark:text-[#E9EEF4]">
                    {currentTool.title[locale] || currentTool.title.en}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[10px] font-bold uppercase">
                    {currentTool.category}
                  </span>
                </div>
                <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-0.5">
                  {currentTool.shortDesc[locale] || currentTool.shortDesc.en}
                </p>
              </div>
            </div>

            <div className="text-xs font-medium text-[#59677D] dark:text-[#9AA6B8] bg-[#F6F8FB] dark:bg-[#192332] px-3 py-1.5 rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
              {currentTool.supportHint[locale] || currentTool.supportHint.en}
            </div>
          </div>

          {/* Active Tester Box */}
          <div>{renderActiveToolComponent()}</div>

          {/* Professional Instructions & Troubleshooting accordion for the active tool */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Step-by-Step Instructions */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
              <h3 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
                How to Test
              </h3>
              <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
                {(currentTool.instructions[locale] || currentTool.instructions.en).map((inst, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-bold text-[#0F766E] dark:text-[#14B8A6]">•</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hardware Limitations */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
              <h3 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Browser Limitations
              </h3>
              <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
                {(currentTool.limitations[locale] || currentTool.limitations.en).map((lim, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-bold text-amber-500">•</span>
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Troubleshooting Solutions */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
              <h3 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                Troubleshooting Tips
              </h3>
              <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
                {(currentTool.troubleshooting[locale] || currentTool.troubleshooting.en).map((tb, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-bold text-blue-500">•</span>
                    <span>{tb}</span>
                  </li>
                ))}
              </ul>
            </div>
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
            Notice: Free device test records run 100% in your local browser and persist in your device local storage.
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
