/**
 * Guide article content schema (Phase 9, item I).
 * One file per article in content/guides/ conforms to this schema; the
 * central index aggregates them for the registry.
 */

export type GuideCategory = 'audio' | 'video' | 'input-gaming' | 'display' | 'network';
export type GuideType = 'troubleshooting' | 'how-to' | 'buying';

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
