import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { siteOpenGraph } from '@/lib/seo/metadata';

/**
 * The contact page is a client component ('use client' — it composes a message
 * locally), so it cannot export metadata. A server layout can, and its fields
 * replace the root layout's for this subtree — which is what stops the page
 * from inheriting the site root's canonical and og:url.
 */
export const metadata: Metadata = {
  title: 'Contact DeviceTry — Support & Feedback',
  description:
    'Contact the DeviceTry team for support or feedback. The form composes a message in your browser for you to send — nothing is submitted or stored by the site.',
  alternates: { canonical: '/contact' },
  openGraph: siteOpenGraph({
    title: 'Contact DeviceTry — Support & Feedback',
    description:
      'Contact the DeviceTry team for support or feedback. The form composes a message in your browser for you to send — nothing is submitted or stored by the site.',
    type: 'website',
    url: `${SITE_URL}/contact`,
  }),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
