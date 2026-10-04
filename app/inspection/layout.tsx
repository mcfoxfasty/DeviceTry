import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

/**
 * The inspection page is a client component, so it cannot export metadata.
 * This server layout supplies the route's own canonical and og:url, replacing
 * the site-root values it would otherwise inherit.
 */
export const metadata: Metadata = {
  title: 'Guided Device Inspection — DeviceTry',
  description:
    'Run a guided inspection: test microphone, webcam, speakers, keyboard, mouse and screen in one ordered pass. Results stay on this device.',
  alternates: { canonical: '/inspection' },
  openGraph: siteOpenGraph({
    title: 'Guided Device Inspection — DeviceTry',
    description:
      'Run a guided inspection: test microphone, webcam, speakers, keyboard, mouse and screen in one ordered pass. Results stay on this device.',
    type: 'website',
    url: `${SITE_URL}/inspection`,
  }),
};

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
