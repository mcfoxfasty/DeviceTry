'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Info, AlertTriangle, HelpCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import { ToolIcon } from '@/components/ui/ToolIcon';
import { ToolRendererDeepLink } from '@/components/ToolRendererDeepLink';
import { PermissionPromptCard } from '@/components/PermissionPromptCard';

interface ToolDetailViewProps {
  tool: ToolDefinition;
  t: Translations;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Compact chrome for embedding. */
  compact?: boolean;
  /** Heading level for the tool title (h1 on dedicated pages, h2 elsewhere). */
  titleHeading?: 'h1' | 'h2';
}

/**
 * Phase 10 tool page layout:
 *  breadcrumbs → H1 + short description → white workspace card with the live
 *  tester (controls immediately visible) → instructions / limitations /
 *  troubleshooting sections below.
 */
export function ToolDetailView({ tool, t, onResultUpdate, compact = false, titleHeading: TitleTag = 'h2' }: ToolDetailViewProps) {
  const needsPermission =
    tool.supportHint.toLowerCase().includes('permission') ||
    tool.requiredApis.includes('navigator.mediaDevices.getUserMedia');

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {!compact && (
        <nav aria-label="Breadcrumb" className="text-xs text-[#8996A6] dark:text-[#677589]">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li>
              <Link href="/" className="hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="w-3 h-3" />
            </li>
            <li>
              <Link href="/tests" className="hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors">
                {t.nav.tools}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="w-3 h-3" />
            </li>
            <li aria-current="page" className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {tool.title}
            </li>
          </ol>
        </nav>
      )}

      {/* Title block: H1 + description + truthful permission note */}
      <div className={!compact ? 'flex items-start gap-4' : 'flex items-start gap-3'}>
        <div className="hidden sm:block shrink-0 mt-0.5">
          <ToolIcon name={tool.iconType as never} size={44} />
        </div>
        <div className="min-w-0">
          <TitleTag className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#142033] dark:text-[#E9EEF4] leading-tight">
            {tool.title}
          </TitleTag>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 leading-relaxed">
            {tool.shortDesc}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-[#8996A6] dark:text-[#677589] uppercase tracking-wide">
            {tool.supportHint}
          </p>
        </div>
      </div>

      {/* Permission encouragement only for permission-gated tools */}
      {needsPermission && <PermissionPromptCard t={t} />}

      {/* Live tester — one clear white workspace card. Result banner is
          rendered INSIDE each tester card. DeepLink wrapper reads ?tab= for
          migrated route deep links. */}
      <ToolRendererDeepLink tool={tool} t={t} onResultUpdate={onResultUpdate} />

      {/* Instructions, limitations, troubleshooting */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${compact ? '' : 'pt-2'}`}>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131B27] border border-[#E2E8F0] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            How to Test
          </h2>
          <ul className="space-y-1.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            {tool.instructions.map((inst, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-[#0F766E] dark:text-[#14B8A6] shrink-0">•</span>
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131B27] border border-[#E2E8F0] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Browser Limitations
          </h2>
          <ul className="space-y-1.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            {tool.limitations.map((lim, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-amber-500 shrink-0">•</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131B27] border border-[#E2E8F0] dark:border-[#223043] space-y-3">
          <h2 className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-1.5 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            Troubleshooting Tips
          </h2>
          <ul className="space-y-1.5 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            {tool.troubleshooting.map((tb, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-blue-500 shrink-0">•</span>
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
