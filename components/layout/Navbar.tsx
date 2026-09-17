'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  X,
  ClipboardCheck,
  Info,
  ChevronDown,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';
import { CATEGORY_META } from '@/lib/tools/categories';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';

interface NavbarProps {
  t: Translations;
}

export function Navbar({ t }: NavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [panel, setPanel] = useState<'main' | 'category'>('main');
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panel === 'category') {
          setPanel('main');
        } else {
          setDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, panel]);

  // Close if the viewport grows to desktop where the drawer isn't used
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setPanel('main');
    setOpenCategory(null);
  };

  const openCategoryPanel = (key: string) => {
    setOpenCategory(key);
    setPanel('category');
  };

  const navigate = (href: string) => {
    closeDrawer();
    router.push(href);
  };

  const toolsByCategory = (key: string) =>
    TOOLS_REGISTRY.filter((tool) => tool.category === key);

  const desktopLinks = [
    {
      href: '/inspection',
      label: t.nav.guidedInspection,
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />,
    },
    {
      href: '/#tools',
      label: t.nav.tools,
      icon: null,
    },
    {
      href: '/about',
      label: t.nav.about,
      icon: null,
    },
  ];

  return (
    <header className="no-print sticky top-0 z-40 w-full bg-white dark:bg-[#101722] border-b border-[#DFE5EB] dark:border-[#223043]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tag */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <DeviceTryLogo size={36} />
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]">
              Browser Diagnostics
            </span>
        </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            {desktopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors flex items-center gap-1.5"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: mobile hamburger only */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="md:hidden p-2 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ============ Lateral slide-in drawer (mobile) ============ */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-[#0B111A]/60 backdrop-blur-[2px]"
          onClick={closeDrawer}
        />

        {/* Panel */}
        <div
          ref={drawerRef}
          className={`absolute top-0 right-0 h-full w-[86%] max-w-sm bg-white dark:bg-[#101722] border-l border-[#DFE5EB] dark:border-[#223043] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-[#DFE5EB] dark:border-[#223043] shrink-0">
            {panel === 'category' ? (
              <button
                onClick={() => setPanel('main')}
                className="flex items-center gap-1 text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
              ) : null}
            {panel === 'category' ? null : (
              <div className="flex items-center gap-2">
                <DeviceTryLogo size={28} />
              </div>
            )}
            <button
              onClick={closeDrawer}
              className="p-2 rounded-lg text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto">
            {panel === 'main' ? (
              <div className="px-4 py-4">
                {/* Primary actions */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => navigate('/inspection')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#0F766E] dark:bg-[#14B8A6] text-white dark:text-[#0B111A] text-sm font-bold shadow-md hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <ClipboardCheck className="w-4.5 h-4.5" />
                    {t.nav.guidedInspection}
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </button>
                  <button
                    onClick={() => navigate('/#tools')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[#DFE5EB] dark:border-[#223043] text-sm font-bold text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer"
                  >
                    {t.nav.tools}
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </button>
                </div>

                {/* Categories section */}
                <p className="mt-6 mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8996A6]">
                  Browse by category
                </p>
                <div className="space-y-1">
                  {CATEGORY_META.map((cat) => {
                    const count = toolsByCategory(cat.key).length;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => openCategoryPanel(cat.key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer group"
                      >
                        <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${cat.chip}`}>
                          <cat.icon className="w-4.5 h-4.5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] truncate">
                            {cat.label}
                          </span>
                          <span className="block text-[11px] text-[#8996A6] truncate">
                            {cat.description}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#8996A6] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                </div>

                {/* Secondary links */}
                <div className="mt-6 pt-4 border-t border-[#DFE5EB] dark:border-[#223043] space-y-1">
                  <button
                    onClick={() => navigate('/about')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] hover:text-[#142033] dark:hover:text-[#E9EEF4] transition-colors cursor-pointer"
                  >
                    <Info className="w-4 h-4" />
                    {t.nav.about}
                  </button>
                </div>
              </div>
            ) : (
              /* Category panel */
              <div className="px-4 py-4">
                {(() => {
                  const cat = CATEGORY_META.find((c) => c.key === openCategory);
                  if (!cat) return null;
                  const tools = toolsByCategory(cat.key);
                  return (
                    <div>
                      <div className="flex items-center gap-3 px-1 mb-4">
                        <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${cat.chip}`}>
                          <cat.icon className="w-5 h-5" />
                        </span>
                        <div>
                          <h2 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
                            {cat.label}
                          </h2>
                          <p className="text-[11px] text-[#8996A6]">{cat.description}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {tools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => navigate(`/test/${tool.slug}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer group"
                          >
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#8996A6] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] transition-colors" />
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
