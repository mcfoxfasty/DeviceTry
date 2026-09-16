import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, HardDrive, Cpu } from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { CardPaymentBadges } from '@/components/pro/CardPaymentBadges';
import { isProEnabled } from '@/lib/config/mode';

interface FooterProps {
  t: Translations;
  currentLocale: Locale;
}

export function Footer({ t, currentLocale }: FooterProps) {
  const proMode = isProEnabled();

  return (
    <footer className="no-print w-full bg-[#F6F7F9] dark:bg-[#0B111A] border-t border-[#DFE5EB] dark:border-[#223043] mt-20 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
      {/* Privacy & Architecture Guarantee Strip */}
      <div className="border-b border-[#DFE5EB] dark:border-[#223043] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">Zero Cloud Audio/Video</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Mic and camera feeds are evaluated locally in your browser memory and never streamed to any remote server.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <HardDrive className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">No Anonymous Tracking</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Free tests perform zero database writes. Local history is stored strictly in your browser’s local storage.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Cpu className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">Honest Technical Scope</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                We clearly separate browser-observed stream properties from physical hardware measurements.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 ${proMode ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-8`}>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-[#0F766E] flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-[#142033] dark:text-[#E9EEF4]">DeviceTry</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Professional browser-based device testing and guided hardware inspection tools for video meetings, used computer sales, and IT troubleshooting.
          </p>
          <p className="text-[11px] mt-3 font-mono-num text-[#8996A6]">
            © {new Date().getFullYear()} DeviceTry. All rights reserved.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-xs uppercase tracking-wider mb-3">
            Device Tests
          </h4>
          <ul className="space-y-2 text-[11px]">
            <li><Link href={`/?test=mic&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.micTest.title}</Link></li>
            <li><Link href={`/?test=webcam&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.webcamTest.title}</Link></li>
            <li><Link href={`/?test=keyboard&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.keyboardTest.title}</Link></li>
            <li><Link href={`/?test=mouse&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.mouseTest.title}</Link></li>
            <li><Link href={`/?test=speakers&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.speakersTest.title}</Link></li>
            <li><Link href={`/?test=display&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.displayTest.title}</Link></li>
            <li><Link href={`/?test=gamepad&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.gamepadTest.title}</Link></li>
            <li><Link href={`/?test=battery&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.batteryTest.title}</Link></li>
          </ul>
        </div>

        {proMode && (
          <div>
            <h4 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-xs uppercase tracking-wider mb-3">
              DeviceTry Pro
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link href={`/pro?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.pricing.proTitle}</Link></li>
              <li><Link href={`/pro?lang=${currentLocale}#custom-branding`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">Custom Branding</Link></li>
              <li><Link href={`/pro?lang=${currentLocale}#cloud-history`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">Cloud History</Link></li>
              <li><Link href={`/pro?lang=${currentLocale}#device-inventory`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.proDashboard.deviceInventory}</Link></li>
              <li><Link href={`/pro/subscribe?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.pricing.proCta}</Link></li>
            </ul>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-xs uppercase tracking-wider mb-3">
            Legal & Trust
          </h4>
          <ul className="space-y-2 text-[11px]">
            <li><Link href={`/privacy?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.nav.privacy}</Link></li>
            <li><Link href={`/terms?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.nav.terms}</Link></li>
            <li><Link href={`/about?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">About & Methodology</Link></li>
            <li><Link href={`/contact?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">Contact & Support</Link></li>
          </ul>

          {proMode && (
            <CardPaymentBadges
              variant="compact"
              title={t.footer.cardsPaymentTitle}
              subtitle={t.footer.cardsPaymentDesc}
            />
          )}
        </div>
      </div>
    </footer>
  );
}
