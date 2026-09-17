export type ToolCategory =
  | 'audio-camera'
  | 'keyboard-mouse'
  | 'screen'
  | 'mobile-controllers'
  | 'music'
  | 'browser-performance';

export interface ToolComponentProps {
  t?: import('@/lib/i18n/types').Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
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
}
