'use client';

import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface CardPaymentBadgesProps {
  variant?: 'compact' | 'full';
  title?: string;
  subtitle?: string;
}

export function CardPaymentBadges({
  variant = 'compact',
  title = 'Card Payments Powered by Stripe',
  subtitle = 'All major cards accepted with 256-bit SSL encryption.',
}: CardPaymentBadgesProps) {
  if (variant === 'compact') {
    return (
      <div className="mt-4 p-3 rounded-lg bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] text-[11px]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#0F766E] dark:text-[#14B8A6]" />
            <span>{title}</span>
          </p>
        </div>

        {/* Card Logos / Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {/* VISA */}
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#1A1F71] text-white font-extrabold text-[10px] tracking-wider italic select-none shadow-2xs"
            title="Visa"
          >
            VISA
          </span>

          {/* Mastercard */}
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#252525] text-white font-bold text-[10px] select-none shadow-2xs"
            title="Mastercard"
          >
            <span className="flex -space-x-1 items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EB001B] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] inline-block opacity-90" />
            </span>
            <span className="text-[8px] font-sans font-medium tracking-tight ml-0.5">mc</span>
          </span>

          {/* AMEX */}
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#006FCF] text-white font-black text-[9px] tracking-wider select-none shadow-2xs"
            title="American Express"
          >
            AMEX
          </span>

          {/* Discover */}
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#FF6000] text-white font-bold text-[9px] tracking-tight select-none shadow-2xs"
            title="Discover"
          >
            DISCOVER
          </span>

          {/* Digital Wallets */}
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#000000] text-white font-medium text-[9px] tracking-tight select-none border border-slate-700 shadow-2xs"
            title="Apple Pay & Google Pay"
          >
            Pay / GPay
          </span>
        </div>

        <p className="text-[#8996A6] text-[10px] leading-relaxed">
          {subtitle}
        </p>
      </div>
    );
  }

  // Full / expanded variant for Pro pricing page
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0F766E]/10 dark:bg-[#14B8A6]/20 flex items-center justify-center text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
              {title}
            </h4>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
              Encrypted 256-bit SSL payments processed directly via Stripe with PCI-DSS Level 1 compliance.
            </p>
          </div>
        </div>

        {/* Card Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* VISA */}
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-[#1A1F71] text-white font-black text-xs tracking-wider italic shadow-xs">
            VISA
          </span>

          {/* Mastercard */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#222222] text-white font-bold text-xs shadow-xs">
            <span className="flex -space-x-1.5 items-center">
              <span className="w-3.5 h-3.5 rounded-full bg-[#EB001B] inline-block" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#F79E1B] inline-block opacity-90" />
            </span>
            <span className="text-[10px] tracking-tight font-sans">mastercard</span>
          </span>

          {/* AMEX */}
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#006FCF] text-white font-black text-[10px] tracking-wider shadow-xs">
            AMEX
          </span>

          {/* Discover */}
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#FF6000] text-white font-bold text-[10px] tracking-tight shadow-xs">
            DISCOVER
          </span>

          {/* Wallets */}
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#111827] text-white font-medium text-[10px] border border-slate-700 shadow-xs">
             Apple Pay
          </span>

          <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#111827] text-white font-medium text-[10px] border border-slate-700 shadow-xs">
            Google Pay
          </span>
        </div>
      </div>

      <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-3 leading-relaxed">
        We do not store full credit card numbers or security codes on our servers. All transactions are handled securely by Stripe. Subscriptions renew automatically each month and can be canceled anytime with a single click in your workspace customer portal.
      </p>
    </div>
  );
}
