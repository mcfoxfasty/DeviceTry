'use client';

import React from 'react';
import { SITE_URL } from '@/lib/site';
import { ShareButton } from '@/components/ui/ShareButton';

/**
 * Share row for guide articles (correction C): a plain, privacy-safe share
 * of the article URL — no SDKs, no trackers. Reuses the same ShareButton
 * used by tool results with a title-only payload.
 */
export function GuideShareRow({ title, slug }: { title: string; slug: string }) {
  const url = `${SITE_URL}/guides/${slug}`;
  return (
    <div className="mt-4 no-print">
      <ShareButton
        payload={{
          text: `${title} — a practical guide from DeviceTry.`,
          status: 'passed',
          includesScore: false,
        }}
        url={url}
        label="Share this guide"
      />
    </div>
  );
}

export default GuideShareRow;
