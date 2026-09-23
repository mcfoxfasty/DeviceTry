'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  X,
  ClipboardCheck,
  ChevronRight,
  Grip,
  Sun,
  Moon,
  Home,
  LayoutGrid,
  BookOpen,
  Info,
  ShieldCheck,
  Mail,
  History,
} from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';
import { CATEGORY_META } from '@/lib/tools/categories';
import { TOOLS_REGISTRY, ToolDefinition } from '@/lib/tools/registry';
import { ToolIcon, toolSlugToIconName } from '@/components/ui/ToolIcon';
import { uiToolSearch } from '@/lib/tools/search';
import { ThemeProvider, useTheme } from '@/lib/theme';

interface NavbarProps {
  t: Translations;
}

/** Links rendered inside the LEFT navigation drawer. */
const DRAWER_LINKS: Array<{
  href: string;
  labelKey: 'home' | 'tools' | 'guides' | 'guidedInspection' | 'testHistory' | 'about' | 'privacy' | 'contact';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/tests', labelKey: 'tools', icon: LayoutGrid },
  { href: '/guides', labelKey: 'guides', icon: BookOpen },
  { href: '/inspection', labelKey: 'guidedInspection', icon: ClipboardCheck },
  { href: '/test-history', labelKey: 'testHistory', icon: History },
  { href: '/about', labelKey: 'about', icon: Info },
  { href: '/privacy', labelKey: 'privacy', icon: ShieldCheck },
  { href: '/contact', labelKey: 'contact', icon: Mail },
];

type DrawerId = 'nav' | 'tools' | null;

/**
 * Shared drawer chrome: a full-viewport overlay (backdrop + sliding panel).
 * Both instances are rendered as SIBLINGS of the sticky header — never
 * nested inside it — so `fixed inset-0` resolves against the real viewport
 * instead of the header's backdrop-filter stacking context (the defect that
 * previously produced an empty drawer).
 *
 * Accessibility contract (both drawers):
 *  - closed: inert + visibility hidden (unfocusable, hidden from AT),
 *  - open:   role=dialog aria-modal, focus moved to the panel,
 *            Tab/Shift+Tab cycled inside, Escape closes, backdrop closes,
 *            focus restored to the trigger that opened it,
 *  - body scroll locked while open; only one drawer open at a time.
 */
function DrawerOverlay({
  id,
  open,
  side,
  label,
  onClose,
  children,
}: {
  id: string;
  open: boolean;
  side: 'left' | 'right';
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus management: into the panel on open, back to the trigger on close.
  // The effect runs ONLY on the closed -> open transition (and on unmount):
  // `open` is the sole dependency, so typing in the tools-drawer search input
  // never re-runs focus logic or steals focus back to the first focusable —
  // the iOS keyboard used to dismiss after every character for exactly this
  // reason. `onClose` is read through a ref so it is never a dependency.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    // Edge-to-edge transitions (e.g. switching which drawer is open) must not
    // re-run initial focus — only a genuine closed -> open transition does.
    if (!open || wasOpenRef.current) {
      wasOpenRef.current = open;
      return;
    }
    wasOpenRef.current = true;
    const panel = panelRef.current;
    if (!panel) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const raf = requestAnimationFrame(() => focusables()[0]?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      panel.removeEventListener('keydown', onKey);
      // Restore focus to whichever trigger opened this drawer. The drawer
      // stays open while the user types, so this runs once per open session —
      // not after every keystroke.
      previousActive?.focus?.();
    };
  }, [open]);

  return (
    <div
      id={id}
      className={`no-print fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      // Keep the closed drawer out of the accessibility tree. `inert` already
      // implies hiding for supporting browsers; explicit `aria-hidden` covers
      // AT that queries aria-hidden directly. It must never be set on the OPEN
      // drawer (that would hide the open dialog from assistive technology).
      aria-hidden={!open || undefined}
    >
      {/* Shared backdrop */}
      <div
        className={`absolute inset-0 bg-[#0B111A]/55 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // `inert` blocks focus, pointer events, and AT exposure while closed.
        // (React types this as boolean; browsers that predate inert ignore it,
        // where aria-hidden above plus `invisible` below cover the gap.)
        inert={!open}
        className={`glass-overlay no-print absolute top-0 ${side}-0 h-full w-[86%] max-w-sm border-${
          side === 'left' ? 'r' : 'l'
        } border-[#E8E3F2] dark:border-[#223043] flex flex-col transition-transform duration-300 ease-out safe-b ${
          open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'
        } ${open ? '' : 'invisible'}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Light/Dark theme control backed by the shared theme system.
 *  - drawer variant: labelled segmented control inside the left navigation
 *    drawer (mobile primary control),
 *  - desktop variant: compact icon-only radiogroup in the sticky header, so
 *    theme switching is never mobile-only.
 */
function ThemeControl({ t, variant = 'drawer' }: { t: Translations; variant?: 'drawer' | 'desktop' }) {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: 'light' | 'dark'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'light', label: t.nav.themeLight, icon: Sun },
    { value: 'dark', label: t.nav.themeDark, icon: Moon },
  ];
  const compact = variant === 'desktop';
  return (
    <div
      role="radiogroup"
      aria-label={t.nav.themeToggle}
      className={`flex items-center gap-1 p-1 rounded-xl bg-[#F4F2FA] dark:bg-[#192332] ${
        compact ? '' : 'w-full'
      }`}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              compact
                ? `w-8 h-8 ${active ? '' : 'hover:bg-white/60 dark:hover:bg-white/10'}`
                : 'flex-1 gap-1.5 px-3 py-2'
            } ${
              active
                ? 'bg-white dark:bg-[#131B27] text-[#0F766E] dark:text-[#14B8A6] shadow-sm'
                : 'text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4]'
            }`}
          >
            <Icon className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            {!compact && label}
            {compact && <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function NavbarInner({ t }: NavbarProps) {
  const [openDrawer, setOpenDrawer] = useState<DrawerId>(null);
  const [toolsQuery, setToolsQuery] = useState<string>('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const router = useRouter();

  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement>(null);

  // Stable identity across renders: passed as DrawerOverlay's `onClose`, it
  // must not change when the user types (a new callback identity used to
  // re-trigger the overlay's focus effect and blur the search input).
  const closeDrawers = useCallback(() => {
    setOpenDrawer(null);
    setOpenCategory(null);
  }, []);

  // Body scroll lock while any drawer is open.
  useEffect(() => {
    document.body.style.overflow = openDrawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openDrawer]);

  // Close if the viewport grows to desktop where drawers aren't used.
  useEffect(() => {
    if (!openDrawer) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeDrawers();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [openDrawer, closeDrawers]);

  const navigate = (href: string) => {
    closeDrawers();
    router.push(href);
  };

  const toolsByCategory = (key: string) => TOOLS_REGISTRY.filter((tool) => tool.category === key);

  // Tools-launcher search: THE shared UI adapter — identical ranking to the
  // homepage search by construction (one implementation, one registry).
  const toolHits = useMemo(() => {
    if (!toolsQuery.trim()) return null;
    return uiToolSearch(toolsQuery, 8);
  }, [toolsQuery]);

  const popularTools = useMemo(
    () =>
      ['microphone-test', 'webcam-test', 'speakers-test']
        .map((slug) => TOOLS_REGISTRY.find((tool) => tool.slug === slug))
        .filter((tool): tool is ToolDefinition => Boolean(tool)),
    []
  );

  // Desktop navigation is compact: Tests, Guides — Guided Checkup exists once
  // as the CTA button (no duplicated normal link + CTA).
  const desktopLinks = [
    { href: '/tests', label: t.nav.tools },
    { href: '/guides', label: t.nav.guides ?? 'Guides' },
  ];

  return (
    <>
      {/* ============ Sticky glass header ============ */}
      <header className="no-print sticky top-0 z-40 w-full glass-strong border-b border-[#E8E3F2] dark:border-[#223043]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Left: hamburger (mobile) */}
          <div className="flex justify-start md:hidden">
            <button
              ref={navTriggerRef}
              onClick={() => setOpenDrawer(openDrawer === 'nav' ? null : 'nav')}
              className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label={t.nav.openMenu}
              aria-expanded={openDrawer === 'nav'}
              aria-controls="site-nav-drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Centre: logo (independently centred on mobile via grid columns) */}
          <Link href="/" className="flex items-center justify-center gap-2 shrink-0" aria-label="DeviceTry home">
            <DeviceTryLogo size={30} />
          </Link>

          {/* Right: dots grid (mobile) / links (desktop) */}
          <div className="flex justify-end items-center">
            <button
              ref={toolsTriggerRef}
              onClick={() => setOpenDrawer(openDrawer === 'tools' ? null : 'tools')}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label={t.nav.openTools}
              aria-expanded={openDrawer === 'tools'}
              aria-controls="tools-drawer"
            >
              <Grip className="w-5 h-5" />
            </button>

            <nav
              className="hidden md:flex items-center gap-1 text-[13px] font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]"
              aria-label="Main navigation"
            >
              {desktopLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-lg hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {/* Single Guided Checkup CTA (desktop) — no duplicate link. */}
              <Link
                href="/inspection"
                className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                {t.nav.guidedInspection}
              </Link>
            </nav>

            {/* Compact desktop Light/Dark control — theme switching is not
                mobile-only. Mobile keeps the labelled control in the left
                drawer; this icon pair shares the same theme system. */}
            <div className="hidden md:flex items-center ml-3 pl-3 border-l border-[#E8E3F2] dark:border-[#223043]">
              <ThemeControl t={t} variant="desktop" />
            </div>
          </div>
        </div>
      </header>

      {/* ============ LEFT navigation drawer (sibling of header) ============ */}
      <DrawerOverlay
        id="site-nav-drawer"
        open={openDrawer === 'nav'}
        side="left"
        label="Site menu"
        onClose={closeDrawers}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#E8E3F2] dark:border-[#223043] shrink-0">
          <DeviceTryLogo size={26} />
          <button
            onClick={closeDrawers}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
            aria-label={t.nav.closeMenu}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-1">
            {DRAWER_LINKS.map(({ href, labelKey, icon: Icon }) => (
              <button
                key={href}
                onClick={() => navigate(href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
                {t.nav[labelKey]}
              </button>
            ))}
          </div>

          {/* Theme control — Light/Dark persisted locally. */}
          <div className="mt-6">
            <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8996A6]">
              {t.nav.themeToggle}
            </p>
            <ThemeControl t={t} />
          </div>
        </div>
      </DrawerOverlay>

      {/* ============ RIGHT tools-launcher drawer (sibling of header) ============ */}
      <DrawerOverlay
        id="tools-drawer"
        open={openDrawer === 'tools'}
        side="right"
        label={t.nav.toolsDrawerTitle}
        onClose={closeDrawers}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#E8E3F2] dark:border-[#223043] shrink-0">
          <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">{t.nav.toolsDrawerTitle}</h2>
          <button
            onClick={closeDrawers}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
            aria-label={t.nav.closeMenu}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={toolsQuery}
              onChange={(e) => setToolsQuery(e.target.value)}
              placeholder={t.nav.toolsDrawerSearch}
              aria-label={t.nav.toolsDrawerSearch}
              className="w-full pl-3 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] placeholder-[#8996A6] focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 dark:focus:border-[#14B8A6] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {toolHits ? (
            toolHits.length > 0 ? (
              <ToolList tools={toolHits} t={t} onNavigate={navigate} />
            ) : (
              <p className="px-1 py-6 text-xs text-[#8996A6]">{t.nav.toolsDrawerNoResults}</p>
            )
          ) : (
            <>
              <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8996A6]">
                {t.nav.popularTools}
              </p>
              <ToolList tools={popularTools} t={t} onNavigate={navigate} popular />

              <p className="mt-5 mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8996A6]">
                {t.nav.browseByCategory}
              </p>
              {openCategory === null ? (
                <div className="space-y-1">
                  {CATEGORY_META.map((cat) => {
                    const count = toolsByCategory(cat.key).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setOpenCategory(cat.key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
                            {cat.label}
                          </span>
                          <span className="block text-[11px] text-[#8996A6] truncate">{count} tools</span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#8996A6]" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                (() => {
                  const cat = CATEGORY_META.find((c) => c.key === openCategory);
                  if (!cat) return null;
                  return (
                    <div>
                      <button
                        onClick={() => setOpenCategory(null)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] mb-3 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back
                      </button>
                      <h3 className="sr-only">{cat.label}</h3>
                      <ToolList tools={toolsByCategory(cat.key)} t={t} onNavigate={navigate} />
                    </div>
                  );
                })()
              )}
            </>
          )}
        </div>
      </DrawerOverlay>
    </>
  );
}

/** Tool row used by the right drawer (icons + title, tap target ≥44px). */
function ToolList({
  tools,
  t,
  onNavigate,
  popular = false,
}: {
  tools: ToolDefinition[];
  t: Translations;
  onNavigate: (href: string) => void;
  popular?: boolean;
}) {
  if (tools.length === 0) return null;
  return (
    <div className="space-y-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onNavigate(`/test/${tool.slug}`)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
        >
          <span className="shrink-0">
            <ToolIcon name={toolSlugToIconName(tool.slug)} size={30} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
              {tool.title}
            </span>
            {popular && (
              <span className="block text-[11px] text-[#8996A6] truncate">{tool.shortDesc}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Navbar({ t }: NavbarProps) {
  return (
    <ThemeProvider>
      <NavbarInner t={t} />
    </ThemeProvider>
  );
}
