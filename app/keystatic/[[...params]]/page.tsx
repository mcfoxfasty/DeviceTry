import type { Metadata } from 'next';
import { makePage } from '@keystatic/next/ui/app';
import keystaticConfig from '../../../keystatic.config';

/**
 * The CMS itself, served at /keystatic.
 *
 * `makePage` renders Keystatic's admin shell, which is a client-side application:
 * it authenticates against GitHub through the API route in
 * app/api/keystatic/[...params]/route.ts and then reads and writes this
 * repository. Everything it needs is in keystatic.config.ts.
 *
 * NOT FOR SEARCH ENGINES. An admin dashboard has nothing to offer a crawler, and
 * its login screen would compete with real pages in results. `robots` is set here
 * as well as in app/robots.ts so the rule travels with the route rather than
 * depending on a crawler honouring one file.
 */
export const metadata: Metadata = {
  title: 'DeviceTry CMS',
  robots: { index: false, follow: false, nocache: true },
};

export default makePage(keystaticConfig);
