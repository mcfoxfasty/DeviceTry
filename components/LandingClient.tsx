'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  ShieldCheck,
  ClipboardCheck,
  ChevronDown,
  SearchX,
  ArrowRight,
  CloudOff,
  Lock,
  UserX,
  MousePointerClick,
  BellRing,
  FileCheck2,
  X,
} from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TOOLS_REGISTRY, ToolDefinition, ToolCategory } from '@/lib/tools/registry';
import { DeviceIllustration } from '@/components/ui/DeviceIllustration';
import { CATEGORY_META } from '@/lib/tools/categories';
import { searchTools } from '@/lib/tools/search';

interface LandingClientProps {
  t: Translations;
}
const POPULAR_SLUGS = [
  'microphone-test',
  'webcam-test',
  'keyboard-test',
  'mouse-test',
  'dead-pixel-test',
  'gamepad-test',
];

const QUICK_SEARCHES = ['microphone', 'webcam', 'keyboard', 'dead pixel', 'gamepad'];

const HOW_IT_WORKS = [
  {
    icon: MousePointerClick,
    title: 'Pick a tester',
    description: 'Choose from 38 focused tools — every tester lives on its own page.',
  },
  {
    icon: BellRing,
    title: 'Allow permission',
    description: 'Your browser asks once. Click “Allow” — nothing leaves your device.',
  },
  {
    icon: FileCheck2,
    title: 'Get your result',
    description: 'Instant pass/warn/fail verdict with a printable summary report.',
  },
];

const TRUST_FEATURES = [
  { icon: CloudOff, label: 'featureLocal' },
  { icon: Lock, label: 'featurePrivacy' },
  { icon: UserX, label: 'featureNoSignup' },
] as const;

const faqs = [
  {
    q: 'How do browser-based device tests work?',
    a: 'Modern browsers provide secure, standardized APIs (WebRTC getUserMedia, Web Audio Analyser, Gamepad API, KeyboardEvent, and Battery Status). DeviceTry queries these direct browser interfaces to measure live signals, verify permissions, and detect hardware issues without installing desktop drivers or software.',
  },
  {
    q: 'Does DeviceTry record or store my video or audio streams?',
    a: 'Never. All video feeds, microphone waveforms, key strokes, and audio playback are executed completely in your local browser client memory. Streams are never transmitted to our servers or any third-party cloud. Optional recordings you create (mic samples, snapshots) are processed locally and can be downloaded to your device — nothing is kept unless you save it yourself. Inspection history is stored in this browser\'s local storage and never leaves your machine.',
  },
  {
    q: 'Why should I run tests before a Zoom, Google Meet, or Microsoft Teams call?',
    a: 'Over 80% of video meeting failures stem from blocked browser permissions, wrong default microphone inputs, or unplugged USB devices. Running a quick 3-minute check ensures your camera delivers full HD resolution and your microphone registers clear vocal levels before joining.',
  },
  {
    q: 'How many diagnostic tools are available on DeviceTry?',
    a: 'DeviceTry features 38 specialized client-side diagnostic tools covering microphones, webcams, stereo audio, displays, keyboards, mice, gaming controllers, touchscreens, and acoustic instruments.',
  },
  {
    q: 'My browser asked for permission and I clicked Block. What now?',
    a: 'No problem — permissions can be changed at any time. Click the lock (or tune) icon on the left of the address bar, set Microphone or Camera access back to “Allow”, then reload the page. The tester will detect the new permission immediately. Each tool page also links straight to your Windows or Mac system privacy settings in case access was blocked at the operating-system level.',
  },
  {
    q: 'Do the testers work on phones and tablets, or only laptops?',
    a: 'Both. Every tester runs in any modern mobile browser, and most work great on phones — touchscreen coverage, multi-touch, accelerometer, gyroscope, microphone, webcam, and display tools included. A few are hardware-dependent: the keyboard and mouse testers need physical peripherals, the battery monitor requires a Chromium browser, and vibration testing is Android-only.',
  },
  {
    q: 'What do the pass, warning, and failed results actually mean?',
    a: 'Passed means the browser observed a healthy, responsive signal from your hardware. Warning means the device works but shows a caveat — for example elevated latency, a lower-than-expected sample rate, or minor stick drift. Failed means the browser could not get a usable signal at all. Every result is explained in plain language and can be included in a printable report.',
  },
  {
    q: 'Can I trust the results when buying or selling used hardware?',
    a: 'Yes — that is one of the most common uses. A structured pre-purchase check catches dead or stuck pixels, chattering mouse switches, unresponsive keyboard keys, degraded microphone input, and weak batteries before money changes hands. The guided inspection builds a single printable report you can attach to a marketplace listing or keep as a handover record.',
  },
  {
    q: 'Which browser gives the most accurate results?',
    a: 'Chrome, Edge, Firefox, and Safari all work. For the fullest API coverage we recommend a current version of Chrome or Edge, which expose the complete WebRTC, Web Audio, Gamepad, and Battery Status interfaces. Some diagnostics are inherently limited on certain engines — battery reporting, for instance, was removed from Safari and Firefox for privacy reasons, and those testers will tell you when a measurement is not possible.',
  },
  {
    q: 'Is it really free, and do I need to create an account?',
    a: 'Every tester and the guided inspection are completely free with no account, email, or credit card required — and there is no paid tier. Nothing is time-limited or feature-locked.',
  },
];

const floatDelays = ['0s', '1.2s', '2.1s', '0.7s', '1.6s'];

const VALID_CATEGORIES = new Set<string>(CATEGORY_META.map((c) => c.key));

export function LandingClient({ t }: LandingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query + category are URL-driven so browser Back/Forward restores them.
  const urlQuery = searchParams.get('q') ?? '';
  const urlCategory = searchParams.get('category') ?? 'all';
  const selectedCategory = (VALID_CATEGORIES.has(urlCategory) ? urlCategory : 'all') as ToolCategory | 'all';

  const [inputValue, setInputValue] = useState<string>(urlQuery);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Autocomplete state: open, highlighted suggestion index (-1 = none).
  const [suggestionsOpen, setSuggestionsOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Track the URL value the input was last synced from, so we can adopt
  // external URL changes (browser Back) during render instead of via an
  // effect that calls setState (react-hooks/set-state-in-effect).
  const [lastUrlQuery, setLastUrlQuery] = useState<string>(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setInputValue(urlQuery);
  }

  /** Push query + category to the URL without re-scrolling. */
  const syncUrl = useCallback(
    (query: string, category: ToolCategory | 'all') => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'all') params.set('category', category);
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [router]
  );

  const handleQueryChange = (value: string) => {
    setInputValue(value);
    syncUrl(value, selectedCategory);
    setSuggestionsOpen(Boolean(value.trim()));
    setActiveIndex(-1);
  };

  const handleCategoryChange = (key: ToolCategory | 'all') => {
    syncUrl(inputValue, key);
  };

  const searchQuery = urlQuery;

  // Lenient search: word-order independent, filler words tolerated, typos
  // forgiven. Filtered by category first, then scored + ranked.
  const filteredTools = useMemo(() => {
    const inCategory =
      selectedCategory === 'all'
        ? TOOLS_REGISTRY
        : TOOLS_REGISTRY.filter((tool) => tool.category === selectedCategory);

    if (!searchQuery.trim()) return inCategory;

    return searchTools(searchQuery, inCategory).map((hit) => hit.tool);
  }, [selectedCategory, searchQuery]);

  // Top 5 suggestions for the autocomplete panel.
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const inCategory =
      selectedCategory === 'all'
        ? TOOLS_REGISTRY
        : TOOLS_REGISTRY.filter((tool) => tool.category === selectedCategory);
    return searchTools(searchQuery, inCategory).slice(0, 5);
  }, [selectedCategory, searchQuery]);

  const popularTools = POPULAR_SLUGS.map((slug) =>
    TOOLS_REGISTRY.find((tool) => tool.slug === slug)
  ).filter((tool): tool is ToolDefinition => Boolean(tool));

  const toolCount = TOOLS_REGISTRY.length;
  const isFiltering = Boolean(searchQuery.trim()) || selectedCategory !== 'all';

  const categoryCount = (key: ToolCategory) =>
    TOOLS_REGISTRY.filter((tool) => tool.category === key).length;

  const selectCategoryAndScroll = (key: ToolCategory) => {
    handleCategoryChange(key);
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTools = () => {
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
  };

  /** Clear Search: reset query, close suggestions, restore tools, refocus. */
  const clearSearch = () => {
    setInputValue('');
    syncUrl('', selectedCategory);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  /** Quick-search chip: focus input, apply term, show suggestions. */
  const applyQuickSearch = (term: string) => {
    setInputValue(term);
    syncUrl(term, selectedCategory);
    setSuggestionsOpen(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
    // Ensure the search box + suggestions are visible.
    requestAnimationFrame(() => {
      searchBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const openSuggestion = (tool: ToolDefinition) => {
    setSuggestionsOpen(false);
    router.push(`/test/${tool.slug}`);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestionsOpen || suggestions.length === 0) {
        setSuggestionsOpen(Boolean(searchQuery.trim()));
        return;
      }
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (chosen) {
        openSuggestion(chosen.tool);
      } else {
        // No suggestions: jump to the full results grid.
        setSuggestionsOpen(false);
        scrollToTools();
      }
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
  };

  // Close suggestions on outside click.
  useEffect(() => {
    if (!suggestionsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setSuggestionsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [suggestionsOpen]);

  return (
    <div className="space-y-20 pb-4">
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden">
        {/* Backdrop: dot grid + soft glows */}
        <div className="absolute inset-0 dot-grid [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]" aria-hidden="true" />
        <div className="absolute -top-24 right-[8%] w-80 h-80 rounded-full bg-teal-400/15 blur-3xl" aria-hidden="true" />
        <div className="absolute top-40 -left-24 w-72 h-72 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-10">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
            {/* Hero copy */}
            <div className="fade-up text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#0F766E] dark:text-[#14B8A6] shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.hero.badge}
              </span>

              <h1 className="mt-5 text-4xl sm:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4] leading-[1.08] whitespace-pre-line">
                {t.hero.title}
              </h1>
              <p className="mt-5 text-sm sm:text-base text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed max-w-xl mx-auto lg:mx-0">
                {t.hero.subtitle}
              </p>

              {/* Search bar (accessible combobox) */}
              <div className="mt-8 max-w-xl mx-auto lg:mx-0" ref={searchBoxRef}>
                <div className="relative group">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0F766E] dark:group-focus-within:text-[#14B8A6] transition-colors" />
                  <label htmlFor="tool-search" className="sr-only">
                    Search hardware testers — try “camera”, “mic”, or “keyboard”
                  </label>
                  <input
                    ref={inputRef}
                    id="tool-search"
                    type="text"
                    role="combobox"
                    aria-expanded={suggestionsOpen && suggestions.length > 0}
                    aria-controls="tool-search-suggestions"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      suggestionsOpen && activeIndex >= 0
                        ? `tool-search-option-${activeIndex}`
                        : undefined
                    }
                    autoComplete="off"
                    placeholder={t.landing.searchPlaceholder}
                    value={inputValue}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    onFocus={() => {
                      if (searchQuery.trim()) setSuggestionsOpen(true);
                    }}
                    className="w-full pl-12 pr-11 py-4 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-sm text-[#142033] dark:text-[#E9EEF4] placeholder-slate-400 shadow-lg shadow-slate-900/5 focus:outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/15 dark:focus:border-[#14B8A6] dark:focus:ring-[#14B8A6]/15 transition-all"
                  />
                  {inputValue && (
                    <button
                      onClick={clearSearch}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#192332] transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Autocomplete suggestions (top 5) */}
                  {suggestionsOpen && suggestions.length > 0 && (
                    <ul
                      id="tool-search-suggestions"
                      role="listbox"
                      aria-label="Search suggestions"
                      className="absolute z-30 left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-2xl shadow-slate-900/10 overflow-hidden"
                    >
                      {suggestions.map((hit, idx) => {
                        const meta = CATEGORY_META.find((c) => c.key === hit.tool.category);
                        return (
                          <li
                            key={hit.tool.id}
                            id={`tool-search-option-${idx}`}
                            role="option"
                            aria-selected={idx === activeIndex}
                          >
                            <Link
                              href={`/test/${hit.tool.slug}`}
                              onClick={(e) => {
                                e.preventDefault();
                                openSuggestion(hit.tool);
                              }}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                idx === activeIndex
                                  ? 'bg-[#E6F4F2] dark:bg-[#133230]'
                                  : 'bg-white dark:bg-[#131B27]'
                              }`}
                            >
                              <DeviceIllustration type={hit.tool.iconType} size={34} />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-[#142033] dark:text-[#E9EEF4] truncate">
                                  {hit.tool.title}
                                </span>
                                <span className="block text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] truncate">
                                  {meta?.label ?? hit.tool.categoryLabel}
                                </span>
                              </span>
                              <ArrowRight className="w-4 h-4 shrink-0 text-[#0F766E] dark:text-[#14B8A6]" />
                            </Link>
                          </li>
                        );
                      })}
                      {suggestions.length > 0 && (
                        <li role="presentation">
                          <button
                            onClick={() => {
                              setSuggestionsOpen(false);
                              scrollToTools();
                            }}
                            className="w-full px-4 py-2.5 text-xs font-bold text-[#0F766E] dark:text-[#14B8A6] bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] dark:hover:bg-[#133230] transition-colors cursor-pointer text-left"
                          >
                            View all {filteredTools.length} result{filteredTools.length === 1 ? '' : 's'}
                            <ArrowRight className="w-3 h-3 inline ml-1" />
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Quick search chips */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 justify-center lg:justify-start">
                  <span className="text-[11px] font-medium text-[#8996A6] mr-0.5">Popular:</span>
                  {QUICK_SEARCHES.map((term) => (
                    <button
                      key={term}
                      onClick={() => applyQuickSearch(term)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                        searchQuery === term
                          ? 'bg-[#0F766E] text-white border-[#0F766E] dark:bg-[#14B8A6] dark:border-[#14B8A6] dark:text-[#0B111A]'
                          : 'bg-white dark:bg-[#131B27] border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] hover:border-[#0F766E] dark:hover:border-[#14B8A6] hover:text-[#0F766E] dark:hover:text-[#14B8A6]'
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTAs + trust */}
              <div className="mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <Link
                  href="/inspection"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white text-sm font-bold shadow-lg shadow-teal-900/20 hover:shadow-teal-900/30 hover:-translate-y-0.5 transition-all"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  {t.hero.ctaPrimary}
                </Link>
                <a
                  href="#tools"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-sm font-bold text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors"
                >
                  {t.hero.ctaSecondary}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start">
                {TRUST_FEATURES.map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
                    <Icon className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
                    {t.hero[label]}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero visual — floating device illustrations */}
            <div className="relative hidden lg:block h-[440px]" aria-hidden="true">
              <div className="absolute inset-8 rounded-[2.5rem] bg-gradient-to-br from-[#0F766E]/8 via-transparent to-sky-400/10 dark:from-[#14B8A6]/10 dark:to-sky-500/5 blur-sm" />

              <div className="absolute top-2 left-10 animate-float" style={{ animationDelay: floatDelays[0] }}>
                <div className="p-4 rounded-3xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xl shadow-slate-900/8">
                  <DeviceIllustration type="microphone" size={84} />
                </div>
              </div>

              <div className="absolute top-16 right-6 animate-float-slow" style={{ animationDelay: floatDelays[1] }}>
                <div className="p-4 rounded-3xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xl shadow-slate-900/8">
                  <DeviceIllustration type="webcam" size={76} />
                </div>
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float" style={{ animationDelay: floatDelays[2] }}>
                <div className="p-5 rounded-[1.75rem] bg-white dark:bg-[#131B27] border-2 border-[#0F766E]/25 dark:border-[#14B8A6]/30 shadow-2xl shadow-teal-900/15">
                  <DeviceIllustration type="gamepad" size={104} />
                </div>
              </div>

              <div className="absolute bottom-10 left-16 animate-float-slow" style={{ animationDelay: floatDelays[3] }}>
                <div className="p-4 rounded-3xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xl shadow-slate-900/8">
                  <DeviceIllustration type="keyboard" size={72} />
                </div>
              </div>

              <div className="absolute bottom-2 right-16 animate-float" style={{ animationDelay: floatDelays[4] }}>
                <div className="p-3.5 rounded-3xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xl shadow-slate-900/8">
                  <DeviceIllustration type="battery" size={64} />
                </div>
              </div>

              {/* Live status pill */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold text-[#142033] dark:text-[#E9EEF4]">
                  {toolCount} testers ready · 0 uploads
                </span>
              </div>
            </div>

            {/* Mobile icon strip */}
            <div className="lg:hidden flex justify-center gap-3" aria-hidden="true">
              {['microphone', 'webcam', 'gamepad', 'keyboard'].map((type, i) => (
                <div
                  key={type}
                  className="p-2.5 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-md animate-float"
                  style={{ animationDelay: `${i * 0.6}s` }}
                >
                  <DeviceIllustration type={type} size={44} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((step, idx) => (
            <div
              key={step.title}
              className="fade-up relative p-6 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]/50 dark:hover:border-[#14B8A6]/50 transition-colors"
              style={{ animationDelay: `${idx * 0.12}s` }}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-[#E6F4F2] dark:bg-[#132E2E]">
                  <step.icon className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-[#0B111A] text-[10px] font-extrabold">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">{step.title}</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Popular tools ================= */}
      {!isFiltering && (
        <section id="popular" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] tracking-tight">
                {t.landing.popularTitle}
              </h2>
              <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                The checks most people run before a call or a purchase.
              </p>
            </div>
            <a
              href="#tools"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-[#14B8A6] hover:gap-2.5 transition-all"
            >
              View all {toolCount}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {popularTools.map((tool, idx) => (
              <Link
                key={tool.id}
                href={`/test/${tool.slug}`}
                className="group fade-up p-4 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col items-center text-center"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="mb-2 group-hover:scale-110 transition-transform duration-300">
                  <DeviceIllustration type={tool.iconType} size={52} />
                </div>
                <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] transition-colors leading-snug">
                  {tool.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ================= Category showcase ================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#142033] dark:text-[#E9EEF4] tracking-tight">
            {t.landing.toolsTitle}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-2 max-w-2xl mx-auto">
            {t.landing.toolsSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {CATEGORY_META.map((cat, idx) => (
            <button
              key={cat.key}
              onClick={() => selectCategoryAndScroll(cat.key)}
              className={`group fade-up text-left p-5 rounded-2xl bg-white dark:bg-[#131B27] border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
                selectedCategory === cat.key
                  ? 'border-[#0F766E] dark:border-[#14B8A6] ring-2 ring-[#0F766E]/15 dark:ring-[#14B8A6]/15'
                  : 'border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]/50 dark:hover:border-[#14B8A6]/50'
              }`}
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`p-2.5 rounded-xl transition-colors ${cat.tile}`}>
                  <cat.icon className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8996A6]">
                  {categoryCount(cat.key)} testers
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">{cat.label}</h3>
              <p className="mt-1 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">{cat.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ================= All tools (searchable) ================= */}
      <section id="tools" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20">
        {/* Category filter chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-6">
          <button
            onClick={() => handleCategoryChange('all')}
            aria-pressed={selectedCategory === 'all'}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0F766E] text-white shadow-sm dark:bg-[#14B8A6] dark:text-[#0B111A]'
                : 'bg-white dark:bg-[#131B27] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6]'
            }`}
          >
            All Tools ({toolCount})
          </button>
          {CATEGORY_META.map((c) => (
            <button
              key={c.key}
              onClick={() => handleCategoryChange(c.key)}
              aria-pressed={selectedCategory === c.key}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === c.key
                  ? 'bg-[#0F766E] text-white shadow-sm dark:bg-[#14B8A6] dark:text-[#0B111A]'
                  : 'bg-white dark:bg-[#131B27] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Active filter summary: query + category, each clearly clearable */}
        {isFiltering && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {searchQuery.trim() && (
              <button
                onClick={clearSearch}
                aria-label={`Clear search query “${searchQuery.trim()}”`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#132E2E] text-[#0F766E] dark:text-[#14B8A6] border border-[#0F766E]/30 hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer"
              >
                “{searchQuery.trim()}”
                <X className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Clear search query</span>
              </button>
            )}
            {selectedCategory !== 'all' && (
              <button
                onClick={() => handleCategoryChange('all')}
                aria-label={`Clear category filter ${CATEGORY_META.find((c) => c.key === selectedCategory)?.label ?? selectedCategory}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E6F4F2] dark:bg-[#132E2E] text-[#0F766E] dark:text-[#14B8A6] border border-[#0F766E]/30 hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer"
              >
                {CATEGORY_META.find((c) => c.key === selectedCategory)?.label ?? selectedCategory}
                <X className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Clear category filter</span>
              </button>
            )}
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]" role="status" aria-live="polite">
              {filteredTools.length === 1 ? '1 tester found' : `${filteredTools.length} testers found`}
            </p>
          </div>
        )}

        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const meta = CATEGORY_META.find((c) => c.key === tool.category);
              return (
                <Link
                  key={tool.id}
                  href={`/test/${tool.slug}`}
                  className="group relative p-5 rounded-2xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="group-hover:scale-110 transition-transform duration-300">
                      <DeviceIllustration type={tool.iconType} size={46} />
                    </div>
                    {meta && (
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${meta.chip}`}>
                        {tool.categoryLabel}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] mt-3.5 group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs mt-1.5 text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed line-clamp-2 flex-1">
                    {tool.shortDesc}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#8996A6] font-medium truncate">{tool.supportHint}</span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-[#E6F4F2] dark:bg-[#132E2E] text-[#0F766E] dark:text-[#14B8A6] group-hover:bg-[#0F766E] group-hover:text-white dark:group-hover:bg-[#14B8A6] dark:group-hover:text-[#0B111A] transition-colors">
                      Open Tool
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <SearchX className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">{t.landing.searchNoResults}</p>
          </div>
        )}
      </section>

      {/* ================= Guided Inspection CTA ================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#0F766E] via-[#115E56] to-[#134E4A] text-white shadow-2xl shadow-teal-900/25">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden="true"
          />
          <div className="relative grid lg:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <div className="hidden lg:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <div className="text-center lg:text-left">
              <h2 className="text-xl sm:text-2xl font-bold">{t.landing.inspectionTitle}</h2>
              <p className="text-sm mt-2 opacity-85 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {t.landing.inspectionSubtitle}
              </p>
            </div>
            <div className="flex justify-center">
              <Link
                href="/inspection"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#0F766E] text-sm font-bold hover:bg-teal-50 hover:-translate-y-0.5 shadow-lg transition-all"
              >
                {t.landing.inspectionCta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
        <h2 className="text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] text-center mb-6 tracking-tight">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] overflow-hidden transition-colors hover:border-[#0F766E]/40 dark:hover:border-[#14B8A6]/40"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#142033] dark:text-[#E9EEF4] cursor-pointer"
              >
                <span>{faq.q}</span>
                <span
                  className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#F1F4F7] dark:bg-[#192332] transition-transform duration-300 ${
                    expandedFaq === idx ? 'rotate-180' : ''
                  }`}
                >
                  <ChevronDown className="w-4 h-4 text-[#5F6B7A] dark:text-[#9AA6B8]" />
                </span>
              </button>
              {expandedFaq === idx && (
                <div className="px-4 sm:px-5 pb-5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
