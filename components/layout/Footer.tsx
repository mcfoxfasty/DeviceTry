import React from 'react';
import Link from 'next/link';
import { Lock, HardDrive, Cpu, ShieldCheck } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { DeviceTryLogo } from '@/components/ui/DeviceTryLogo';
import { ShareSiteButton } from '@/components/ui/ShareSiteButton';

interface FooterProps {
  t: Translations;
}

const GUARANTEES = [
  {
    icon: Lock,
    title: 'Zero Cloud Audio/Video',
    description: 'Mic and camera feeds are evaluated locally in your browser memory and never streamed to any server.',
  },
  {
    icon: HardDrive,
    title: 'No Anonymous Tracking',
    description: 'Test history is stored strictly in your browser’s local storage — on the Test History page you can view or delete it at any time.',
  },
  {
    icon: Cpu,
    title: 'Honest Technical Scope',
    description: 'We clearly separate browser-observed stream properties from physical hardware measurements.',
  },
];

export function Footer({ t }: FooterProps) {
  const linkClass =
    'hover:text-[#2DD4BF] transition-colors';

  return (
    <footer className="no-print w-full bg-[#0B1E28] dark:bg-[#081519] text-[#9FB3BE] dark:text-[#8CA2AD] mt-20">
      {/* Accent hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#14B8A6]/60 to-transparent" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand + guarantees */}
          <div className="md:col-span-5">
            <DeviceTryLogo size={30} variant="light" />
            <p className="mt-4 text-xs leading-relaxed max-w-sm">
              Professional browser-native device testing and guided hardware inspection for video
              meetings, used-computer verification, and hardware troubleshooting. Media tests run
              locally; the network tools connect to their measurement services only when you start
              them.
            </p>

            <ul className="mt-6 space-y-3.5">
              {GUARANTEES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#E9F2F4]">{title}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular tests */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#E9F2F4] mb-4">
              Popular Tests
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              <li><Link href="/test/microphone-test" className={linkClass}>{t.micTest.title}</Link></li>
              <li><Link href="/test/webcam-test" className={linkClass}>{t.webcamTest.title}</Link></li>
              <li><Link href="/test/keyboard-test" className={linkClass}>{t.keyboardTest.title}</Link></li>
              <li><Link href="/test/mouse-test" className={linkClass}>{t.mouseTest.title}</Link></li>
              <li><Link href="/test/speakers-test" className={linkClass}>{t.speakersTest.title}</Link></li>
              <li><Link href="/test/screen-test" className={linkClass}>Screen Test</Link></li>
              <li><Link href="/test/gamepad-test" className={linkClass}>{t.gamepadTest.title}</Link></li>
              <li><Link href="/test/internet-speed-test" className={linkClass}>Internet Speed Test</Link></li>
            </ul>
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#E9F2F4] mt-6 mb-3">
              <Link href="/guides" className={linkClass}>Guides &amp; Troubleshooting</Link>
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/guides/microphone-not-working" className={linkClass}>Microphone not working</Link></li>
              <li><Link href="/guides/webcam-not-working" className={linkClass}>Webcam not working</Link></li>
              <li><Link href="/guides/controller-stick-drift" className={linkClass}>Controller stick drift</Link></li>
            </ul>
          </div>

          {/* Legal & info */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#E9F2F4] mb-4">
              Legal &amp; Info
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/inspection" className={linkClass}>{t.nav.guidedInspection}</Link></li>
              <li><Link href="/test-history" className={linkClass}>{t.nav.testHistory}</Link></li>
              <li><Link href="/about" className={linkClass}>{t.nav.about}</Link></li>
              <li><Link href="/privacy" className={linkClass}>{t.nav.privacy}</Link></li>
              <li><Link href="/terms" className={linkClass}>{t.nav.terms}</Link></li>
              <li><Link href="/contact" className={linkClass}>{t.nav.contact}</Link></li>
              <li>
                {/* Share DeviceTry — same public-URL-only share as the drawers. */}
                <ShareSiteButton variant="link" label={t.nav.shareSite} />
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#9FB3BE] dark:text-[#8CA2AD]">
            {t.footer.copyright}
          </p>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#7E96A1]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4BF]" />
            Free · no sign-up · media stays on your device
          </p>
        </div>
      </div>
    </footer>
  );
}
