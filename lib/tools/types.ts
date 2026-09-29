export type ToolCategory =
  | 'audio-video'
  | 'input-devices'
  | 'display'
  | 'network'
  | 'supporting';

export interface ToolComponentProps {
  t?: import('@/lib/i18n/types').Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

/** Contextual link to a supporting page or guide, rendered on the tool page. */
export interface ToolSupportLink {
  label: string;
  href: string;
}

export interface ToolDefinition {
  id: string;
  slug: string; // URL-friendly slug
  category: ToolCategory;
  categoryLabel: string;
  title: string;
  shortDesc: string;
  supportHint: string;
  keywords: string[];
  iconType: string;
  requiredApis: string[];
  componentName: string;
  relatedToolIds: string[];
  instructions: string[];
  limitations: string[];
  troubleshooting: string[];
  /**
   * Hide `shortDesc` from the tool page header. The registry string is still
   * the page's meta description and its catalog/related-tool card text; some
   * tools only omit it from the header, where the widget below already says
   * the same thing in the user's own words.
   */
  hideHeaderDescription?: boolean;
  /** Merged-tool tab addressed by a migration deep link (e.g. ?tab=mirror). */
  tabId?: string;
  /** Contextual links to supporting diagnostics shown on the tool page. */
  supportLinks?: ToolSupportLink[];
}
