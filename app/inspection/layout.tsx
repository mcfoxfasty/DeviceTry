import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * The inspection page is a client component, so it cannot export metadata.
 * This server layout supplies the route's own canonical and og:url, replacing
 * the site-root values it would otherwise inherit.
 */
export const metadata: Metadata = {
  title: 'Guided Device Inspection — DeviceTry',
  description:
    'Run a guided inspection of your devices: test the microphone, webcam, speakers, keyboard, mouse, screen, and more in one ordered pass, with the results kept on this device.',
  alternates: { canonical: '/inspection' },
  openGraph: {
    title: 'Guided Device Inspection — DeviceTry',
    description:
      'Run a guided inspection of your devices: test the microphone, webcam, speakers, keyboard, mouse, screen, and more in one ordered pass, with the results kept on this device.',
    type: 'website',
    url: `${SITE_URL}/inspection`,
    siteName: 'DeviceTry',
  },
};

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
