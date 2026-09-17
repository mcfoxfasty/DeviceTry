'use client';

import React from 'react';
import { Info, AlertTriangle, HelpCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import { DeviceIllustration } from '@/components/ui/DeviceIllustration';
import { ToolRenderer } from '@/components/ToolRenderer';
import { PermissionPromptCard } from '@/components/PermissionPromptCard';

interface ToolDetailViewProps {
  tool: ToolDefinition;
  t: Translations;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Compact chrome for embedding (used by home page in the past) */
  compact?: boolean;
  /** Heading level for the tool title (h1 on dedicated pages, h2 elsewhere) */
  titleHeading?: 'h1' | 'h2';
}

/**
 * Shared detail view for a registry tool: header card, permission prompt,
 * live tester, and the instructions / limitations / troubleshooting panels.
 */
export function ToolDetailView({ tool, t, onResultUpdate, compact = false, titleHeading: TitleTag = 'h2' }: ToolDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0F766E]/10 dark:bg-[#14B8A6]/10 flex items-center justify-center text-[#0F766E] dark:text-[#14B8A6] shrink-0">
            <DeviceIllustration type={tool.iconType} size={36} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TitleTag className="text-lg font-bold text-[#172033] dark:text-[#E9EEF4]">
                {tool.title}
              </TitleTag>
              <span className="px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6] text-[10px] font-bold uppercase">
                {tool.categoryLabel}
              </span>
            </div>
            <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-0.5">
              {tool.shortDesc}
            </p>
          </div>
        </div>

        <div className="text-xs font-medium text-[#59677D] dark:text-[#9AA6B8] bg-[#F6F8FB] dark:bg-[#192332] px-3 py-1.5 rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
          {tool.supportHint}
        </div>
      </div>

      {/* Permission encouragement card */}
      <PermissionPromptCard t={t} />

      {/* Live tester */}
      <ToolRenderer tool={tool} t={t} />

      {/* Instructions & troubleshooting */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${compact ? '' : 'pt-2'}`}>
        <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            How to Test
          </h2>
          <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
            {tool.instructions.map((inst, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-[#0F766E] dark:text-[#14B8A6]">•</span>
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Browser Limitations
          </h2>
          <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
            {tool.limitations.map((lim, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-amber-500">•</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            Troubleshooting Tips
          </h2>
          <ul className="space-y-1.5 text-xs text-[#59677D] dark:text-[#9AA6B8]">
            {tool.troubleshooting.map((tb, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-blue-500">•</span>
                <span>{tb}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ToolDetailView;
