/**
 * Site-wide SEO defaults that every route inherits.
 *
 * Two rules live here so no page has to remember them:
 *
 * 1. THE DEFAULT SOCIAL CARD. Before this, only the two guides that ship a
 *    featured photo had an og:image; every other route — the homepage, the
 *    tools hub, all fifteen testers, the inspection flow — emitted a link with
 *    no preview image at all. A shared link rendered as a bare title. The
 *    default is a static 1200x630 asset (public/brand/og-default.png) built
 *    from the site's own brand mark and hero copy, so it carries no claim the
 *    site does not already make. A route with its OWN lead image (the guides)
 *    overrides `images` and keeps its article artwork.
 *
 * 2. TITLE LENGTH. Search results and browser tabs truncate a title at roughly
 *    60 characters. `compactTitle` shortens only the browser/search title; the
 *    full headline still renders as the page's H1 and as og:title, so nothing a
 *    reader sees on the page changes.
 */

/** The 1200x630 card every route inherits when it has no image of its own.
 *  Mutable rather than `as const`: Next's OGImage[] type is mutable, and a
 *  readonly literal cannot be assigned to it. */
export const DEFAULT_OG_IMAGE: { url: string; width: number; height: number; alt: string } = {
  url: '/brand/og-default.png',
  width: 1200,
  height: 630,
  alt: 'DeviceTry — free online microphone, webcam, keyboard, screen, and internet speed tests in your browser',
};

/**
 * The Open Graph block for a page that has no image of its own.
 *
 * A page that declares `openGraph` REPLACES the root layout's block rather than
 * merging into it: every field of the child's object wins, and the fields it
 * leaves out are simply gone. Declaring the image once in the root layout
 * therefore did nothing for the eleven routes that declare their own block —
 * they were the routes still emitting no og:image. So every route builds its
 * block through this helper, which always carries the card.
 */
export function siteOpenGraph<T extends 'website' | 'article'>(options: {
  title: string;
  description: string;
  url: string;
  type: T;
  images?: { url: string; width: number; height: number; alt: string }[];
}) {
  return {
    title: options.title,
    description: options.description,
    type: options.type,
    url: options.url,
    siteName: 'DeviceTry',
    images: options.images ?? [DEFAULT_OG_IMAGE],
  };
}

/** The brand suffix appended to page titles that have room for it. */
export const TITLE_SUFFIX = ' | DeviceTry';

/** Longest title a search result shows before it truncates. */
export const MAX_TITLE_LENGTH = 60;

/** The longest meta description a search result shows in full. */
export const MAX_DESCRIPTION_LENGTH = 160;

/**
 * Keep a title inside the 60-character window without touching the page's own
 * headline. Preference order:
 *   1. `headline | DeviceTry` when it fits.
 *   2. the headline on its own when it fits (drops the brand suffix, keeps
 *      every word the author wrote).
 *   3. the part of the headline before a colon or dash, plus the suffix.
 *   4. a word-boundary cut, marked with an ellipsis, for a headline that is
 *      long and has no natural break.
 */
export function compactTitle(headline: string, suffix: string = TITLE_SUFFIX): string {
  const withSuffix = `${headline}${suffix}`;
  if (withSuffix.length <= MAX_TITLE_LENGTH) return withSuffix;
  if (headline.length <= MAX_TITLE_LENGTH) return headline;

  const separator = /[:—–]\s/.exec(headline);
  if (separator) {
    const core = `${headline.slice(0, separator.index).trim()}${suffix}`;
    if (core.length <= MAX_TITLE_LENGTH) return core;
  }

  const room = MAX_TITLE_LENGTH - suffix.length - 1; // -1 for the ellipsis
  const cut = headline.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…${suffix}`;
}