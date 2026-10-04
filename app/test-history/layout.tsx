import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

/**
 * The test-history page is a client component (it reads results from local
 * storage), so it cannot export metadata. This server layout supplies the
 * route's own canonical and og:url, replacing the site-root values it would
 * otherwise inherit.
 */
export const metadata: Metadata = {
  title: 'Test History — DeviceTry',
  description:
    'Review DeviceTry results saved on this device: past microphone, webcam, speaker, screen, and network tests, stored in your browser.',
  alternates: { canonical: '/test-history' },
  openGraph: siteOpenGraph({
    title: 'Test History — DeviceTry',
    description:
      'Review DeviceTry results saved on this device: past microphone, webcam, speaker, screen, and network tests, stored in your browser.',
    type: 'website',
    url: `${SITE_URL}/test-history`,
  }),
};

export default function TestHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
