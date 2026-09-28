import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * The test-history page is a client component (it reads results from local
 * storage), so it cannot export metadata. This server layout supplies the
 * route's own canonical and og:url, replacing the site-root values it would
 * otherwise inherit.
 */
export const metadata: Metadata = {
  title: 'Test History — DeviceTry',
  description:
    'Review the DeviceTry test results saved on this device, including past microphone, webcam, speaker, screen, and network tests. History is stored locally in your browser.',
  alternates: { canonical: '/test-history' },
  openGraph: {
    title: 'Test History — DeviceTry',
    description:
      'Review the DeviceTry test results saved on this device, including past microphone, webcam, speaker, screen, and network tests. History is stored locally in your browser.',
    type: 'website',
    url: `${SITE_URL}/test-history`,
    siteName: 'DeviceTry',
  },
};

export default function TestHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
