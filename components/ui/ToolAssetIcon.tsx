'use client';

import Image from 'next/image';
import { toolIconSrc } from '@/lib/tools/iconAssets';
import { ToolIcon, toolSlugToIconName } from '@/components/ui/ToolIcon';

interface ToolAssetIconProps {
  slug: string;
  size?: number;
  className?: string;
  /** Optional accessible name when the icon is the only label for a control. */
  title?: string;
}

/**
 * Renders the exact supplied PNG for a tool, keyed by slug in
 * lib/tools/iconAssets.ts. A tool with no supplied artwork — Permission
 * Diagnostics — keeps the original SVG so this component never invents a
 * generic PNG substitution.
 */
export function ToolAssetIcon({ slug, size = 40, className = '', title }: ToolAssetIconProps) {
  const src = toolIconSrc(slug);
  if (!src) {
    return <ToolIcon name={toolSlugToIconName(slug)} size={size} className={className} title={title} />;
  }

  return (
    <Image
      src={src}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      draggable={false}
      unoptimized
    />
  );
}
