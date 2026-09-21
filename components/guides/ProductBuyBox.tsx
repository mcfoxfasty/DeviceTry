'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { resolveProducts, getAffiliateUrl, getManufacturerUrl, Market } from '@/lib/products/registry';

interface ProductBuyBoxProps {
  productId: string;
  note?: string;
}

/**
 * One product card resolved from the central registry. The affiliate button
 * renders ONLY when a genuine affiliate URL is configured for the market
 * (never fabricated); the clearly labeled manufacturer-information link is
 * always available. Affiliate links carry rel="sponsored nofollow".
 */
export function ProductBuyBox({ productId, note }: ProductBuyBoxProps) {
  const product = resolveProducts([productId])[0];
  if (!product) return null;
  const affiliateUrl = getAffiliateUrl(product, 'US' as Market);
  const manufacturerUrl = getManufacturerUrl(product);

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
            {product.name}
          </p>
          <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
            {product.manufacturer} · {product.category}
          </p>
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold text-[#59677D] dark:text-[#9AA6B8] bg-[#F6F8FB] dark:bg-[#192332] px-2 py-1 rounded-md shrink-0">
          Spec-based pick
        </span>
      </div>

      {note && <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] leading-relaxed">{note}</p>}

      <ul className="space-y-1 text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
        {product.compatibility.slice(0, 3).map((c, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="text-[#0F766E] dark:text-[#14B8A6] font-bold">•</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {affiliateUrl && (
          <a
            href={affiliateUrl}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Buy from retailer
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <a
          href={manufacturerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] text-xs font-medium rounded-lg transition-colors"
        >
          Manufacturer info
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
