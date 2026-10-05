/**
 * Guide article content schema (Phase 9, item I).
 * One file per article in content/guides/ conforms to this schema; the
 * central index aggregates them for the registry.
 */

export type GuideCategory = 'audio' | 'video' | 'input-gaming' | 'display' | 'network';
export type GuideType = 'troubleshooting' | 'how-to' | 'buying';

/**
 * A figure owned by an article.
 *
 * Images are original explanatory DIAGRAMS, never screenshots: a fabricated
 * browser window, a fabricated level-meter reading or a named device model
 * would be a false claim about what the reader saw. Everything a figure
 * asserts is something the article itself says in words.
 *
 * `src` is the BASE path inside /public with no size suffix and no
 * extension — the renderer appends `-{width}.webp` to build a srcset, so each
 * figure ships as a set of pre-optimised WebP files rather than one scaled
 * bitmap. `width`/`height` are the figure's INTRINSIC logical size, used to
 * reserve the box before the bytes arrive and so keep CLS at zero.
 */
export interface GuideImage {
  /** Base path in /public, e.g. `/guides/microphone-not-working-signal-path`. */
  src: string;
  /** Intrinsic logical width, in px. */
  width: number;
  /** Intrinsic logical height, in px. */
  height: number;
  /**
   * What the figure shows, for someone who cannot see it. It must carry the
   * figure's actual content — the labels and the conclusion — rather than
   * naming the file or the subject area.
   */
  alt: string;
  /** Visible caption. Add one when the image needs framing the alt cannot. */
  caption?: string;
  /**
   * What KIND of image this is, so a drawn diagram is never mistaken for a
   * photograph of the reader's own setup.
   *
   * This matters most once a real photograph sits at the top of an article:
   * beside it, an unlabelled illustration reads as "a picture of my machine".
   * A `diagram` ships a light and a dark raster so its own background matches
   * the page; a `photo` ships one set. Omitted means `diagram`, which is the
   * honest default — a figure is assumed to be drawn artwork unless an author
   * says otherwise.
   *
   * Nothing is ever drawn on top of a figure; see GuideFigure for why a badge
   * was removed from it.
   */
  kind?: 'diagram' | 'photo';
}

/**
 * A link placed INSIDE a sentence, as a phrase the renderer wraps in an anchor.
 *
 * This replaces the old per-section `references` list, which rendered a
 * standalone "Sources" block under the section. A block of links is a
 * bibliography, and a bibliography is read once or not at all: by the time a
 * reader reaches the foot of a section they have already decided the advice
 * sounded reasonable, and a link next to the claim is the only version that
 * gets followed. It also made the sourcing look like decoration — a list at the
 * end of a section reads as "these links apply to everything above", which is
 * exactly the vagueness that lets a claim drift away from its evidence.
 *
 * The phrase is matched, not parsed: the paragraph is still a plain string, and
 * the link is declared as the exact substring it wraps. That keeps the content
 * files readable and diffable (no JSX, no nested arrays of nodes in the prose)
 * while still guaranteeing the anchor sits in the sentence it supports. The
 * renderer ignores a phrase that is missing or ambiguous rather than guessing,
 * and tests/proseLinks.test.ts fails the build on both, so a link can never
 * silently vanish or swallow the wrong words.
 */
export interface GuideProseLink {
  /** Which list inside the owning section the phrase lives in. */
  field: 'paragraph' | 'bullet' | 'step';
  /** Index into that list — `paragraphs`, `bullets`, or `steps` respectively. */
  index: number;
  /**
   * The exact text to wrap. Must occur exactly once in the target string, and
   * must be a phrase that still reads naturally without the link applied:
   * `Microsoft's Bluetooth Classic audio documentation` links well,
   * `this` does not.
   */
  text: string;
  /**
   * Destination. A site-relative path renders through next/link; anything else
   * is external and opens in a new tab with the site's existing
   * `target="_blank" rel="noopener noreferrer"` convention.
   */
  href: string;
}

/**
 * A contextual link attached to one numbered step.
 *
 * The related-tool cards at the foot of an article are a directory: they tell a
 * reader what else exists. They do not put a tool in front of someone at the
 * moment the tool would help, which is where a troubleshooting article is
 * actually read. These render directly beneath the step that calls for them.
 */
export interface GuideStepLink {
  /** Index into the owning section's `steps`. */
  stepIndex: number;
  /** Descriptive anchor text naming the action the link supports. */
  label: string;
  /** Site-relative path or absolute URL. */
  href: string;
  /** One line on why this link is relevant HERE, not in general. */
  note?: string;
}

/** A selected product reference — resolved centrally at render time. */
export interface ProductReference {
  productId: string;
  /** Editorial note specific to THIS article's context (optional). */
  note?: string;
}

export interface GuideSection {
  h2: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Ordered step list for how-to/troubleshooting flows. */
  steps?: string[];
  /** Comparison table rendered only when both rows and columns exist. */
  table?: {
    columns: string[];
    rows: string[][];
    caption?: string;
  };
  /** Product picks rendered from the central product registry. */
  productIds?: string[];
  productNotes?: Record<string, string>;
  /**
   * Illustration for this section, rendered between the prose and the
   * steps/bullets it explains. One per section at most.
   */
  image?: GuideImage;
  /**
   * Links placed inside this section's prose, bullets, and steps.
   *
   * Sourcing is inline by design, so this is where a citation goes — the
   * phrase is wrapped where the reader meets the claim, not collected into a
   * list underneath it. Optional and additive: a section with no `proseLinks`
   * renders exactly as it did before.
   */
  proseLinks?: GuideProseLink[];
  /**
   * Contextual links pinned to individual steps. See GuideStepLink.
   */
  stepLinks?: GuideStepLink[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideArticle {
  slug: string;
  title: string;
  /**
   * The browser/search title, when it must differ from `title`.
   *
   * `compactTitle()` derives the `<title>` from the H1 and appends the brand
   * suffix, which is right for a headline written for this site but wrong for
   * an article imported with its own SEO pack — where the H1 and the `<title>`
   * were written separately (e.g. "…in 2026" and "…(2026)"). Setting this
   * emits it verbatim, so it must already fit inside 60 characters; the
   * article's own `title` still renders as the H1 and as nothing else.
   *
   * Omit it and every guide behaves exactly as before.
   */
  seoTitle?: string;
  /** Meta description and listing blurb (unique per article). */
  description: string;
  /**
   * The article's own JSON-LD `description`, when it differs from the meta one.
   *
   * An imported SEO pack usually ships two strings: the one the SERP shows,
   * and a shorter one for the structured-data block, because the two are read
   * by different consumers and are free to say the same thing differently.
   * This is the second one. Omit it and the JSON-LD reuses `description`.
   */
  seoDescription?: string;
  /**
   * The article's own social card, for an article that ships one.
   *
   * `featuredImage` builds the card from a guide figure: a base path, three
   * pre-rasterised widths, and a light/dark pair. An imported article arrives
   * with a finished 1200x630 JPEG or PNG instead, which that scheme cannot
   * express — and rendering a guide figure as the card when a real one exists
   * would show a shared link the wrong picture.
   *
   * `url` is a path inside /public and must resolve. Omit it and the article
   * keeps deriving its card from `featuredImage`, or falls back to the site-wide
   * card when it has neither.
   */
  socialImage?: {
    url: string;
    /** Intrinsic size, emitted as og:image:width / og:image:height. */
    width: number;
    height: number;
    /** Card alt text. Defaults to the article's own headline. */
    alt?: string;
  };
  category: GuideCategory;
  type: GuideType;
  /** Tool slugs this guide relates to (validated against the final registry). */
  relatedToolSlugs: string[];
  /** Other guide slugs to cross-link. */
  relatedGuideSlugs?: string[];
  /** Short intro rendered under the H1. */
  intro: string;
  /**
   * Render a linked table of contents from the section headings.
   *
   * Opt-in per article rather than automatic: a buying guide with four
   * sections does not need one, and a long troubleshooting article does. The
   * alternative — switching it on for every guide — would change fifteen pages
   * that were not asked to change.
   */
  showToc?: boolean;
  /** Lead figure, rendered directly under the article header. */
  featuredImage?: GuideImage;
  /**
   * A complete article body supplied as authored HTML, in place of `sections`.
   *
   * This exists for one case: an article imported with its markup intact —
   * its own `<details>` contents list, its own `<h3>` sub-headings, inline
   * `<code>`, and links to vendor documentation that is not Microsoft's. The
   * typed fields cannot express those, and rewriting the prose to fit them
   * would change the words an author chose.
   *
   * TRUST BOUNDARY. This string is rendered with `dangerouslySetInnerHTML`, so
   * it must be repository-authored content and nothing else — never user
   * input, never a CMS field. It is also why `tests/rawGuideBody.test.ts`
   * fails the build on a `<script>`, `<iframe>`, or `on*=` handler anywhere in
   * it: the escape hatch must not become a way to smuggle active content past
   * the Content-Security-Policy that guards every typed article.
   *
   * Rendered after the header and before the FAQs, so `intro`, the editorial
   * dates, the H1, and the generated FAQPage JSON-LD still come from this
   * file's typed fields and cannot drift from the page. An article carrying
   * one keeps its own FAQ section in the markup, so the template's duplicate
   * FAQ block stands down — see GuideArticleView.
   */
  rawBody?: string;
  /**
   * CSS scoped to this article, emitted once as a `<style>` above `rawBody`.
   *
   * Keep every selector anchored to the article's own class. A bare `html {…}`
   * here would change scrolling or typography for every other page on the
   * site, which is a far larger change than adding an article.
   */
  rawStyle?: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  /**
   * True only when the article actually renders affiliate buttons. The
   * affiliate disclosure is displayed exclusively for these articles.
   */
  hasAffiliateLinks: boolean;
  published: boolean;
  /** Truthful editorial dates — not build timestamps. */
  publishedAt: Date;
  updatedAt: Date;
}
