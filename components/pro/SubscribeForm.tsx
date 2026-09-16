'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, User, Building, ArrowRight, Sparkles, CreditCard } from 'lucide-react';
import { Locale, Translations } from '@/lib/i18n/types';
import { CardPaymentBadges } from './CardPaymentBadges';

interface SubscribeFormProps {
  t: Translations;
  currentLocale: Locale;
}

export function SubscribeForm({ t, currentLocale }: SubscribeFormProps) {
  const [isExistingSubscriber, setIsExistingSubscriber] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const endpoint = isExistingSubscriber ? '/api/auth/login' : '/api/auth/register';
    const payload = isExistingSubscriber
      ? { email, password }
      : { email, password, name, companyName };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to proceed with subscription.');
        setLoading(false);
        return;
      }

      // If existing subscriber logging in, and already has Pro, send to workspace
      if (isExistingSubscriber && data.subscriber?.isPro) {
        router.push(`/pro/workspace?lang=${currentLocale}`);
        router.refresh();
        return;
      }

      // Initiate Stripe checkout for subscription
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const checkoutData = await checkoutRes.json();

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else if (checkoutData.error) {
        // If Stripe secret key isn't provided in environment, enter workspace in preview mode
        router.push(`/pro/workspace?lang=${currentLocale}&welcome=new_subscriber`);
        router.refresh();
      } else {
        router.push(`/pro/workspace?lang=${currentLocale}`);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network connection error';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-6 sm:p-8 shadow-sm">
      {/* Subscribing notice */}
      <div className="mb-6 p-4 rounded-xl bg-[#0F766E]/10 dark:bg-[#14B8A6]/15 border border-[#0F766E]/20 text-[#0F766E] dark:text-[#14B8A6] text-xs">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {isExistingSubscriber ? 'Sign in to renew or manage Pro' : 'Step 1 of 2: Create your subscriber profile'}
            </p>
            <p className="text-[11px] opacity-90 mt-1">
              {isExistingSubscriber
                ? 'Access your saved hardware inspection histories and branding.'
                : 'Free testing tools never require an account. Accounts are created exclusively when subscribing to Pro.'}
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubscribe} className="space-y-4">
        {!isExistingSubscriber && (
          <>
            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                {t.auth.fullNameLabel}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                {t.auth.companyLabel}
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
            {t.auth.emailLabel}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
            {t.auth.passwordLabel}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 mt-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            'Preparing Checkout...'
          ) : isExistingSubscriber ? (
            <>
              <span>Sign In & Continue</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>Subscribe & Pay with Card</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </>
          )}
        </button>

        {/* Card badges */}
        <div className="pt-2">
          <CardPaymentBadges
            variant="compact"
            title={t.footer.cardsPaymentTitle}
            subtitle={t.footer.cardsPaymentDesc}
          />
        </div>

        {/* Subtle toggle for existing subscribers only */}
        <div className="pt-4 border-t border-[#DFE5EB] dark:border-[#223043] text-center">
          <button
            type="button"
            onClick={() => {
              setIsExistingSubscriber(!isExistingSubscriber);
              setErrorMsg(null);
            }}
            className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors cursor-pointer"
          >
            {isExistingSubscriber
              ? '← New to Pro? Click here to subscribe'
              : 'Already subscribed? Sign in to restore your session'}
          </button>
        </div>
      </form>
    </div>
  );
}
