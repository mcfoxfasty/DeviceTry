import React from 'react';
import Link from 'next/link';
import { Lock, HardDrive, Cpu } from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';

interface FooterProps {
  t: Translations;
  currentLocale: Locale;
}

export function Footer({ t, currentLocale }: FooterProps) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="mb-3">
            <DeviceTryLogo size={28} />
          </div>
          <p className="text-[11px] leading-relaxed">
            38 professional browser-native device testing and guided hardware inspection tools for video meetings, used computer verification, and hardware troubleshooting.
          </p>
          <p className="text-[11px] mt-3 font-mono-num text-[#8996A6]">
            © {new Date().getFullYear()} DeviceTry. 100% Client-side.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-xs uppercase tracking-wider mb-3">
            Popular Tests
          </h4>
          <ul className="grid grid-cols-2 gap-2 text-[11px]">
            <li><Link href={`/?test=microphone-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.micTest.title}</Link></li>
            <li><Link href={`/?test=webcam-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.webcamTest.title}</Link></li>
            <li><Link href={`/?test=keyboard-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.keyboardTest.title}</Link></li>
            <li><Link href={`/?test=mouse-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.mouseTest.title}</Link></li>
            <li><Link href={`/?test=speakers-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.speakersTest.title}</Link></li>
            <li><Link href={`/?test=dead-pixel-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">Dead Pixel Test</Link></li>
            <li><Link href={`/?test=gamepad-test&lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.gamepadTest.title}</Link></li>
            <li><Link href={`/test/battery-monitor?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.batteryTest.title}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-xs uppercase tracking-wider mb-3">
            Legal & Info
          </h4>
          <ul className="space-y-2 text-[11px]">
            <li><Link href={`/about?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.nav.about}</Link></li>
            <li><Link href={`/privacy?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.nav.privacy}</Link></li>
            <li><Link href={`/terms?lang=${currentLocale}`} className="hover:text-[#0F766E] dark:hover:text-[#14B8A6]">{t.nav.terms}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
