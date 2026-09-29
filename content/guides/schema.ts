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
   * A `diagram` gets a visible Diagram chip over the image; a `photo` gets
   * none. Omitted means `diagram`, which is the honest default — a figure is
   * assumed to be drawn artwork unless an author says otherwise.
   */
  kind?: 'diagram' | 'photo';
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
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideArticle {
  slug: string;
  title: string;
  /** Meta description and listing blurb (unique per article). */
  description: string;
  category: GuideCategory;
  type: GuideType;
  /** Tool slugs this guide relates to (validated against the final registry). */
  relatedToolSlugs: string[];
  /** Other guide slugs to cross-link. */
  relatedGuideSlugs?: string[];
  /** Short intro rendered under the H1. */
  intro: string;
  /** Lead figure, rendered directly under the article header. */
  featuredImage?: GuideImage;
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
