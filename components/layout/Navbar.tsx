'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, ClipboardCheck, ChevronRight } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';
import { CATEGORY_META } from '@/lib/tools/categories';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';

interface NavbarProps {
  t: Translations;
}

/**
 * Phase 10 compact white sticky header — iLovePDF-style structure with an
 * original DeviceTry identity:
 *   logo left · Tests / Guides / Guided Checkup right (+ hamburger on mobile)
 *
 * Mobile drawer accessibility contract:
 *  - closed content cannot be focused (inert + visibility hidden),
 *  - Escape closes (category panel first),
 *  - focus returns to the hamburger trigger after closing.
 */
export function Navbar({ t }: NavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [panel, setPanel] = useState<'main' | 'category'>('main');
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setPanel('main');
    setOpenCategory(null);
  };

  // Escape closes the drawer (category panel first); focus returns to trigger.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (panel === 'category') {
          setPanel('main');
          setOpenCategory(null);
        } else {
          closeDrawer();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, panel]);

  // Move focus into the drawer when it opens; return focus to the trigger
  // when it closes.
  useEffect(() => {
    if (drawerOpen) {
      drawerRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      document.body.dataset.drawerWasOpen = '1';
    } else if (document.body.dataset.drawerWasOpen === '1') {
      triggerRef.current?.focus();
      document.body.dataset.drawerWasOpen = '0';
    }
  }, [drawerOpen]);

  // Close if the viewport grows to desktop where the drawer isn't used.
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeDrawer();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [drawerOpen]);

  const navigate = (href: string) => {
    closeDrawer();
    router.push(href);
  };

  const toolsByCategory = (key: string) =>
    TOOLS_REGISTRY.filter((tool) => tool.category === key);

  const desktopLinks = [
    { href: '/tests', label: t.nav.tools },
    { href: '/guides', label: t.nav.guides ?? 'Guides' },
    { href: '/inspection', label: t.nav.guidedInspection },
  ];

  return (
    <header className="no-print sticky top-0 z-40 w-full bg-white/95 dark:bg-[#101722]/95 backdrop-blur border-b border-[#E8E3F2] dark:border-[#223043]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="DeviceTry home">
          <DeviceTryLogo size={30} />
        </Link>

        {/* Desktop links */}
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
          <Link
            href="/inspection"
            className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            {t.nav.guidedInspection}
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          ref={triggerRef}
          onClick={() => setDrawerOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="mobile-menu"
        >
          {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ============ Mobile drawer ============ */}
      <div
        id="mobile-menu"
        className={`md:hidden fixed inset-0 z-50 ${
          drawerOpen ? '' : 'pointer-events-none'
        }`}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-[#0B111A]/50 transition-opacity duration-300 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeDrawer}
          aria-hidden="true"
        />

        {/* Panel — inert + visibility hidden when closed so nothing inside
            can receive focus. */}
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          inert={!drawerOpen}
          className={`absolute top-0 right-0 h-full w-[86%] max-w-sm bg-white dark:bg-[#101722] border-l border-[#E8E3F2] dark:border-[#223043] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full invisible'
          }`}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-[#E8E3F2] dark:border-[#223043] shrink-0">
            {panel === 'category' ? (
              <button
                data-autofocus
                onClick={() => {
                  setPanel('main');
                  setOpenCategory(null);
                }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
            ) : (
              <DeviceTryLogo size={26} />
            )}
            <button
              onClick={closeDrawer}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto">
            {panel === 'main' ? (
              <div className="px-4 py-4">
                <div className="space-y-1.5">
                  <button
                    data-autofocus
                    onClick={() => navigate('/tests')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[#E8E3F2] dark:border-[#223043] text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
                  >
                    {t.nav.tools}
                  </button>
                  <button
                    onClick={() => navigate('/guides')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[#E8E3F2] dark:border-[#223043] text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
                  >
                    {t.nav.guides ?? 'Guides'}
                  </button>
                  <button
                    onClick={() => navigate('/inspection')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-[#0B111A] text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    {t.nav.guidedInspection}
                  </button>
                </div>

                <p className="mt-6 mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8996A6]">
                  Browse by category
                </p>
                <div className="space-y-1">
                  {CATEGORY_META.map((cat) => {
                    const count = toolsByCategory(cat.key).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => {
                          setOpenCategory(cat.key);
                          setPanel('category');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
                            {cat.label}
                          </span>
                          <span className="block text-[11px] text-[#8996A6] truncate">
                            {count} tools
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#8996A6]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-4 py-4">
                {(() => {
                  const cat = CATEGORY_META.find((c) => c.key === openCategory);
                  if (!cat) return null;
                  const tools = toolsByCategory(cat.key);
                  return (
                    <div>
                      <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] px-1 mb-3">
                        {cat.label}
                      </h2>
                      <div className="space-y-1">
                        {tools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => navigate(`/test/${tool.slug}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
                                {tool.title}
                              </span>
                              <span className="block text-[11px] text-[#8996A6] truncate">
                                {tool.shortDesc}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
