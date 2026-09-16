'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { Locale } from '@/lib/i18n/types';

interface ProCheckoutButtonProps {
  isLoggedIn: boolean;
  isPro?: boolean;
  currentLocale: Locale;
  subscribeText: string;
  workspaceText: string;
}

export function ProCheckoutButton({
  isLoggedIn,
  isPro,
  currentLocale,
  subscribeText,
  workspaceText,
}: ProCheckoutButtonProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      router.push(`/pro/subscribe?lang=${currentLocale}`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        setErrorMsg(data.error || 'Unable to initiate checkout.');
        setLoading(false);
      } else {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  if (isPro) {
    return (
      <button
        id="btn-go-to-workspace"
        onClick={() => router.push(`/pro/workspace?lang=${currentLocale}`)}
        className="w-full py-3 px-6 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
      >
        <Sparkles className="w-4 h-4" />
        {workspaceText}
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        id="btn-subscribe-pro"
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full py-3 px-6 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Opening Checkout...' : subscribeText}
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
      </button>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
