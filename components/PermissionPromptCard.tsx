'use client';

import React from 'react';
import { ShieldCheck, Lock, ExternalLink } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface PermissionPromptCardProps {
  t: Translations;
}

/**
 * Encourages granting browser permission for the current tester and links to
 * OS-level privacy settings for users who blocked access at device level.
 */
export function PermissionPromptCard({ t }: PermissionPromptCardProps) {
  return (
    <div className="p-5 rounded-xl bg-[#E6F4F2]/60 dark:bg-[#133230]/50 border border-[#0F766E]/25 dark:border-[#14B8A6]/25">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
            {t.permissionPrompt.title}
          </h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 leading-relaxed">
            {t.permissionPrompt.body}
          </p>

          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#131B27] border border-[#0F766E]/30 dark:border-[#14B8A6]/30 text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6]">
            <Lock className="w-3.5 h-3.5" />
            {t.permissionPrompt.allowButton}
          </div>

          <div className="mt-3 pt-3 border-t border-[#0F766E]/15 dark:border-[#14B8A6]/15">
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
              <strong className="text-[#142033] dark:text-[#E9EEF4]">{t.permissionPrompt.troubleshoot}</strong>{' '}
              {t.permissionPrompt.troubleshootHint}
            </p>
          </div>

          <details className="mt-3 group">
            <summary className="text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] cursor-pointer hover:underline">
              {t.permissionPrompt.why}
            </summary>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1.5 leading-relaxed">
              {t.permissionPrompt.whyBody}
            </p>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
              {t.permissionPrompt.deviceSettings}
            </span>
            <a
              href="https://support.microsoft.com/en-us/windows/windows-privacy-settings-8d6c1b1e-1f4b-4d9c-9d1a-2b4c3d5e6f7a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] hover:border-[#0F766E] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
            >
              {t.permissionPrompt.windowsHelp}
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://support.apple.com/en-us/HT210192"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] hover:border-[#0F766E] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
            >
              {t.permissionPrompt.macHelp}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
