'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import { ToolRenderer, ToolResultPayload, ToolResultStatus } from './ToolRenderer';

interface ToolRendererDeepLinkProps {
  tool: ToolDefinition;
  t: Translations;
  onResultUpdate?: (status: ToolResultStatus, details?: string) => void;
  onRecordResult?: (result: ToolResultPayload) => void;
  onResultClear?: () => void;
}

/**
 * Phase 9 (item E): reads the `tab` search parameter so migrated deep links
 * like /test/screen-test?tab=patterns land directly on the right merged tab.
 *
 * useSearchParams requires a Suspense boundary under static rendering; the
 * fallback renders the renderer with no initial tab, which is exactly the
 * pre-migration default, so there is no loading-only flash of the page.
 */
function TabFromSearchParams(props: ToolRendererDeepLinkProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') ?? undefined;

  return (
    <ToolRenderer
      tool={props.tool}
      t={props.t}
      onResultUpdate={props.onResultUpdate}
      onRecordResult={props.onRecordResult}
      onResultClear={props.onResultClear}
      initialTab={initialTab}
    />
  );
}

export function ToolRendererDeepLink(props: ToolRendererDeepLinkProps) {
  return (
    <Suspense fallback={<ToolRenderer tool={props.tool} t={props.t} />}>
      <TabFromSearchParams {...props} />
    </Suspense>
  );
}

export default ToolRendererDeepLink;
