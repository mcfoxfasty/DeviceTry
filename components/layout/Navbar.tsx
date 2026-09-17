'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ClipboardCheck, Wrench } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';

interface NavbarProps {
  t: Translations;
}

export function Navbar({ t }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const navLinks = [
    {
      href: '/inspection',
      label: t.nav.guidedInspection,
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />,
    },
    {
      href: '/#tools',
      label: `${t.nav.tools} (38)`,
      icon: <Wrench className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />,
    },
    {
      href: '/about',
      label: t.nav.about,
      icon: null,
    },
  ];

  return (
    <header className="no-print sticky top-0 z-40 w-full bg-white/95 dark:bg-[#101722]/95 backdrop-blur-md border-b border-[#DFE5EB] dark:border-[#223043]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tag */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <DeviceTryLogo size={36} />
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]">
              38 Diagnostics
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            {navLinks.map((link) => (
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-[#142033] dark:text-[#E9EEF4] font-medium"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
