'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, Menu, X, ClipboardCheck, Sparkles, Wrench } from 'lucide-react';
import { Translations, Locale, LOCALES } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';

interface NavbarProps {
  t: Translations;
  currentLocale: Locale;
}

function setLocaleCookie(newLocale: Locale) {
  if (typeof document !== 'undefined') {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function Navbar({ t, currentLocale }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const router = useRouter();

  const changeLocale = (newLocale: Locale) => {
    setLangMenuOpen(false);
    setLocaleCookie(newLocale);
    router.push(`/?lang=${newLocale}`);
    router.refresh();
  };

  return (
    <header className="no-print sticky top-0 z-40 w-full bg-white/95 dark:bg-[#101722]/95 backdrop-blur-md border-b border-[#DFE5EB] dark:border-[#223043]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tag */}
        <div className="flex items-center gap-6">
          <Link href={`/?lang=${currentLocale}`} className="flex items-center gap-2 group">
            <DeviceTryLogo size={36} />
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]">
              38 Diagnostics
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            <Link
              href={`/?tab=inspection&lang=${currentLocale}`}
              className="px-3 py-1.5 rounded-md hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
              {t.nav.guidedInspection}
            </Link>

            <Link
              href={`/?tab=tests&lang=${currentLocale}`}
              className="px-3 py-1.5 rounded-md hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
              {t.nav.tools} (38)
            </Link>

            <Link
              href={`/about?lang=${currentLocale}`}
              className="px-3 py-1.5 rounded-md hover:text-[#142033] dark:hover:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors"
            >
              {t.nav.about}
            </Link>
          </nav>
        </div>

        {/* Right side controls: Language Switcher */}
        <div className="flex items-center gap-3">
          {/* Multilingual Selector */}
          <div className="relative">
            <button
              id="btn-language-selector"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] rounded-md hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label="Select Language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="uppercase">{currentLocale}</span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-36 bg-white dark:bg-[#192332] rounded-lg shadow-lg border border-[#DFE5EB] dark:border-[#223043] py-1 z-50 text-xs">
                {(['en', 'fr', 'ar'] as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => changeLocale(loc)}
                    className={`w-full text-left rtl:text-right px-3 py-2 hover:bg-[#F6F7F9] dark:hover:bg-[#223043] transition-colors cursor-pointer ${
                      currentLocale === loc
                        ? 'font-bold text-[#0F766E] dark:text-[#14B8A6]'
                        : 'text-[#142033] dark:text-[#E9EEF4]'
                    }`}
                  >
                    {LOCALES[loc].name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 border-t border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#101722] space-y-2 text-sm">
          <Link
            href={`/?tab=inspection&lang=${currentLocale}`}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#142033] dark:text-[#E9EEF4] font-medium"
          >
            {t.nav.guidedInspection}
          </Link>
          <Link
            href={`/?tab=tests&lang=${currentLocale}`}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#5F6B7A] dark:text-[#9AA6B8]"
          >
            {t.nav.tools} (38)
          </Link>
          <Link
            href={`/about?lang=${currentLocale}`}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#5F6B7A] dark:text-[#9AA6B8]"
          >
            {t.nav.about}
          </Link>
        </div>
      )}
    </header>
  );
}
