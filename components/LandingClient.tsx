'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ChevronDown, SearchX, X, Lock, CloudOff, UserX } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TOOLS_REGISTRY, ToolDefinition, ToolCategory } from '@/lib/tools/registry';
import { ToolIcon } from '@/components/ui/ToolIcon';
import { CATEGORY_META } from '@/lib/tools/categories';
import { searchTools } from '@/lib/tools/search';

interface LandingClientProps {
  t: Translations;
}

/**
 * Phase 10 homepage — clean iLovePDF-style structure with an original
 * DeviceTry identity:
 *  - centered hero (H1 + supporting text, no large illustration),
 *  - compact search + category filter pills directly below,
 *  - dense 5/3/2/1 responsive tool grid, Popular-first ordering.
 * Content is unchanged: all 15 tools, truthful labels, no fake numbers.
 */

const POPULAR_SLUGS = ['microphone-test', 'webcam-test', 'speakers-test'];

const QUICK_SEARCHES = ['microphone', 'webcam', 'keyboard', 'mouse', 'gamepad'];

/** Per-tool truthful card notes (required permission / hardware). */
const TOOL_NOTES: Record<string, string> = {
  'microphone-test': 'Microphone permission required',
  'webcam-test': 'Camera permission required',
  'voice-recorder': 'Microphone permission required',
  'speakers-test': 'Use headphones for channel checks',
  'tone-generator': 'Start low — audible tones',
  'keyboard-test': 'Physical keyboard required',
  'mouse-test': 'Mouse or touchpad required',
  'gamepad-test': 'Press any button to connect',
  'touchscreen-test': 'Touch-capable display required',
  'click-speed-test': 'Timed 5 / 10 / 30 s runs',
  'reaction-time-test': 'Five attempts per session',
  'screen-test': 'Fullscreen recommended',
  'refresh-rate-test': 'Browser rendering timing',
  'internet-speed-test': 'Transfers real data on start',
  'what-is-my-ip': 'One small lookup request',
};

const POPULAR_SET = new Set(POPULAR_SLUGS);

/** Ordered: the three popular tools first, then the rest of the catalog. */
const ORDERED_TOOLS: ToolDefinition[] = (() => {
  const popular = POPULAR_SLUGS.map((slug) =>
    TOOLS_REGISTRY.find((tool) => tool.slug === slug)
  ).filter((tool): tool is ToolDefinition => Boolean(tool));
  const rest = TOOLS_REGISTRY.filter((tool) => !POPULAR_SET.has(tool.slug));
  return [...popular, ...rest];
})();

/** Homepage FAQ — kept accurate to the final 15-tool catalog. */
const faqs = [
  {
    q: 'How do browser-based device tests work?',
    a: 'Modern browsers provide secure, standardized APIs (WebRTC getUserMedia, Web Audio, Gamepad API, KeyboardEvent, and more). DeviceTry queries these direct browser interfaces to measure live signals, verify permissions, and surface hardware issues — without installing desktop drivers or software.',
  },
  {
    q: 'Does DeviceTry record or store my video or audio streams?',
    a: 'No. Video feeds, microphone waveforms, keystrokes, and audio playback are processed in your local browser memory and are never streamed to our servers. Optional recordings you create (voice memos, snapshots) are processed locally and can be downloaded to your device — nothing is kept unless you save it yourself. Inspection history is stored in this browser’s local storage and never leaves your machine.',
  },
  {
    q: 'Why should I run tests before a Zoom, Google Meet, or Microsoft Teams call?',
    a: 'Most video-meeting problems come from blocked browser permissions, the wrong default microphone or camera, or unplugged devices. A quick three-minute check — microphone level, camera stream, and speaker channels — catches those before you join.',
  },
  {
    q: 'How many diagnostic tools are available on DeviceTry?',
    a: 'DeviceTry offers 15 focused tools covering microphone, webcam, speakers, voice recording, tones, keyboard, mouse, gamepad, touchscreen, click speed, reaction time, screen, refresh rate, internet speed, and IP lookup. A few advanced browser diagnostics are also linked from the relevant help sections.',
  },
  {
    q: 'My browser asked for permission and I clicked Block. What now?',
    a: 'Permissions can be changed at any time. Click the lock (or tune) icon at the left of the address bar, set Microphone or Camera access back to “Allow”, then reload the page. Each tool page also links to detailed permission help in case access was blocked at the operating-system level.',
  },
  {
    q: 'Do the testers work on phones and tablets, or only laptops?',
    a: 'Both. Every tester runs in any modern mobile browser — touchscreen coverage, multi-touch, microphone, webcam, and display tools included. A few need specific hardware: the keyboard and mouse testers need physical peripherals, and the internet speed test transfers real data when started.',
  },
  {
    q: 'What do the pass, warning, and failed results actually mean?',
    a: 'Passed means the browser observed a healthy, responsive signal from your hardware. Warning means the device works but shows a caveat — for example elevated latency or minor stick drift. Failed means the browser could not get a usable signal at all. Results are explained in plain language and can be included in a printable report.',
  },
  {
    q: 'Can I trust the results when buying or selling used hardware?',
    a: 'A structured pre-purchase check catches dead or stuck pixels, chattering mouse switches, unresponsive keyboard keys, and degraded microphone input before money changes hands. The guided inspection builds a single printable report you can attach to a marketplace listing or keep as a handover record.',
  },
  {
    q: 'Which browser gives the most accurate results?',
    a: 'Chrome, Edge, Firefox, and Safari all work. For the fullest API coverage we recommend a current version of Chrome or Edge. Some diagnostics are limited on certain engines, and the tools tell you honestly when a measurement is not possible on your browser.',
  },
  {
    q: 'Is it really free, and do I need to create an account?',
    a: 'Every tester and the guided inspection are completely free with no account, email, or credit card required — and there is no paid tier. Nothing is time-limited or feature-locked.',
  },
];

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
        ? ORDERED_TOOLS
        : ORDERED_TOOLS.filter((tool) => tool.category === selectedCategory);

    if (!searchQuery.trim()) return inCategory;

    return searchTools(searchQuery, inCategory).map((hit) => hit.tool);
  }, [selectedCategory, searchQuery]);

  // Top 5 suggestions for the autocomplete panel.
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchTools(searchQuery, TOOLS_REGISTRY).slice(0, 5);
  }, [searchQuery]);

  const toolCount = TOOLS_REGISTRY.length;
  const isFiltering = Boolean(searchQuery.trim()) || selectedCategory !== 'all';

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
    requestAnimationFrame(() => {
      searchBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const openSuggestion = (tool: ToolDefinition) => {
    setSuggestionsOpen(false);
    router.push(`/test/${tool.slug}`);
  };

  const scrollToTools = () => {
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
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
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (chosen) {
        openSuggestion(chosen.tool);
      } else {
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
    <div className="pb-4">
      {/* ================= Hero ================= */}
      <section className="pt-12 sm:pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="fade-up text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4] leading-[1.12] max-w-3xl mx-auto">
            {t.hero.title}
          </h1>
          <p className="fade-up mt-4 text-sm sm:text-base text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed max-w-2xl mx-auto" style={{ animationDelay: '0.08s' }}>
            {t.hero.subtitle}
          </p>

          {/* Compact search (accessible combobox) */}
          <div className="fade-up mt-7 max-w-xl mx-auto" ref={searchBoxRef} style={{ animationDelay: '0.16s' }}>
            <div className="relative group">
              <Search className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0F766E] dark:group-focus-within:text-[#14B8A6] transition-colors" />
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
                className="w-full pl-11 pr-11 py-3 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-sm text-[#142033] dark:text-[#E9EEF4] placeholder-slate-400 shadow-sm focus:outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/15 dark:focus:border-[#14B8A6] dark:focus:ring-[#14B8A6]/15 transition-all"
              />
              {inputValue && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#192332] transition-colors cursor-pointer"
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
                  className="absolute z-30 left-0 right-0 top-full mt-2 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xl shadow-slate-900/10 overflow-hidden text-left"
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
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            idx === activeIndex
                              ? 'bg-[#EEF7F5] dark:bg-[#133230]'
                              : 'bg-white dark:bg-[#131B27]'
                          }`}
                        >
                          <ToolIcon name={hit.tool.iconType as never} size={28} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
                              {hit.tool.title}
                            </span>
                            <span className="block text-[11px] text-[#8996A6] truncate">
                              {meta?.label ?? hit.tool.categoryLabel}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  <li role="presentation">
                    <button
                      onClick={() => {
                        setSuggestionsOpen(false);
                        scrollToTools();
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-[#0F766E] dark:text-[#14B8A6] bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#EEF7F5] dark:hover:bg-[#133230] transition-colors cursor-pointer text-left"
                    >
                      View all {filteredTools.length} result{filteredTools.length === 1 ? '' : 's'}
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {/* Quick search chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 justify-center">
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

          {/* Trust line */}
          <div className="fade-up mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" style={{ animationDelay: '0.24s' }}>
            {[
              { icon: CloudOff, label: t.hero.featureLocal },
              { icon: Lock, label: t.hero.featurePrivacy },
              { icon: UserX, label: t.hero.featureNoSignup },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
                <Icon className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Tools grid ================= */}
      <section id="tools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20 pb-6">
        {/* Category filter pills */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-6" role="group" aria-label="Filter tools by category">
          <button
            onClick={() => handleCategoryChange('all')}
            aria-pressed={selectedCategory === 'all'}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] ${
              selectedCategory === 'all'
                ? 'bg-[#0F766E] text-white shadow-sm dark:bg-[#14B8A6] dark:text-[#0B111A]'
                : 'bg-white dark:bg-[#131B27] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6] hover:text-[#0F766E] dark:hover:text-[#14B8A6]'
            }`}
          >
            All ({toolCount})
          </button>
          {CATEGORY_META.map((c) =>
            ORDERED_TOOLS.some((tool) => tool.category === c.key) ? (
              <button
                key={c.key}
                onClick={() => handleCategoryChange(c.key)}
                aria-pressed={selectedCategory === c.key}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] ${
                  selectedCategory === c.key
                    ? 'bg-[#0F766E] text-white shadow-sm dark:bg-[#14B8A6] dark:text-[#0B111A]'
                    : 'bg-white dark:bg-[#131B27] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6] hover:text-[#0F766E] dark:hover:text-[#14B8A6]'
                }`}
              >
                {c.label}
              </button>
            ) : null
          )}
        </div>

        {/* Active filter summary */}
        {isFiltering && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {searchQuery.trim() && (
              <button
                onClick={clearSearch}
                aria-label={`Clear search query “${searchQuery.trim()}”`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EEF7F5] dark:bg-[#132E2E] text-[#0F766E] dark:text-[#14B8A6] border border-[#0F766E]/30 hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EEF7F5] dark:bg-[#132E2E] text-[#0F766E] dark:text-[#14B8A6] border border-[#0F766E]/30 hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer"
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
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {filteredTools.map((tool, idx) => {
              const popular = POPULAR_SET.has(tool.slug);
              const note = TOOL_NOTES[tool.slug];
              return (
                <Link
                  key={tool.id}
                  href={`/test/${tool.slug}`}
                  className="tool-card group relative flex flex-col p-4 rounded-xl bg-white dark:bg-[#131B27] border border-[#E2E8F0] dark:border-[#223043] hover:border-[#0F766E]/50 dark:hover:border-[#14B8A6]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] transition-all"
                  style={idx < 10 ? { animationDelay: `${Math.min(idx * 0.04, 0.3)}s` } : undefined}
                >
                  {popular && (
                    <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-[#FEF3C7] dark:bg-[#451A03] text-[#B45309] dark:text-[#FBBF24]">
                      Popular
                    </span>
                  )}
                  <div className="mb-3 group-hover:scale-105 transition-transform duration-200">
                    <ToolIcon name={tool.iconType as never} size={44} className="w-11 h-11 sm:w-10 sm:h-10" />
                  </div>
                  <h2 className="text-[13px] font-bold text-[#142033] dark:text-[#E9EEF4] leading-snug group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] transition-colors">
                    {tool.title}
                  </h2>
                  <p className="text-xs mt-1 text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed line-clamp-2 flex-1">
                    {tool.shortDesc}
                  </p>
                  {note && (
                    <p className="mt-2.5 text-[10px] font-medium text-[#8996A6] dark:text-[#677589] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] shrink-0" aria-hidden="true" />
                      {note}
                    </p>
                  )}
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

      {/* ================= Guided Inspection strip ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#131B27] border border-[#E2E8F0] dark:border-[#223043] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="text-left">
            <h2 className="text-lg sm:text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
              {t.landing.inspectionTitle}
            </h2>
            <p className="text-sm mt-1.5 text-[#5F6B7A] dark:text-[#9AA6B8] max-w-2xl leading-relaxed">
              {t.landing.inspectionSubtitle}
            </p>
          </div>
          <Link
            href="/inspection"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] text-sm font-bold transition-colors"
          >
            {t.landing.inspectionCta}
          </Link>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <h2 className="text-xl sm:text-2xl font-bold text-[#142033] dark:text-[#E9EEF4] text-center mb-6 tracking-tight">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2.5">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#E2E8F0] dark:border-[#223043] bg-white dark:bg-[#131B27] overflow-hidden transition-colors hover:border-[#0F766E]/40 dark:hover:border-[#14B8A6]/40"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                aria-expanded={expandedFaq === idx}
                className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#142033] dark:text-[#E9EEF4] cursor-pointer min-h-[44px]"
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
                <div className="px-4 pb-4 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
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
