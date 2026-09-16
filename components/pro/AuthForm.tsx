'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, User, Building, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Locale, Translations } from '@/lib/i18n/types';

interface AuthFormProps {
  t: Translations;
  currentLocale: Locale;
  redirectTo?: string;
  initialMode?: 'signin' | 'register';
}

export function AuthForm({ t, currentLocale, redirectTo, initialMode }: AuthFormProps) {
  const isSubscribingFlow = redirectTo === 'subscribe';
  const defaultMode = initialMode || (isSubscribingFlow ? 'register' : 'signin');
  const [mode, setMode] = useState<'signin' | 'register'>(defaultMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/register';
    const payload = mode === 'signin' ? { email, password } : { email, password, name, companyName };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed.');
        setLoading(false);
      } else {
        if (isSubscribingFlow) {
          // Initialize Stripe checkout with this authenticated user
          const checkoutRes = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const checkoutData = await checkoutRes.json();
          if (checkoutData.url) {
            window.location.href = checkoutData.url;
            return;
          } else if (checkoutData.error) {
            // If Stripe is in mock/test mode without API keys, guide directly to workspace
            router.push(`/pro/workspace?lang=${currentLocale}&welcome=new_subscriber`);
            return;
          }
        }
        router.push(`/pro/workspace?lang=${currentLocale}`);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-8 shadow-sm">
      {/* First-time subscriber guidance banner */}
      {isSubscribingFlow && mode === 'register' && (
        <div className="mb-6 p-3.5 rounded-xl bg-[#0F766E]/10 dark:bg-[#14B8A6]/15 border border-[#0F766E]/20 text-[#0F766E] dark:text-[#14B8A6] text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t.auth.firstTimeSubscribeNotice}</p>
              <p className="text-[11px] opacity-90 mt-1">
                Your account stores your synchronized inspection history, inventory, and branded reports.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pro Exclusive Notice */}
      <div className="mb-5 flex items-center gap-2 text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] bg-[#F6F7F9] dark:bg-[#192332] p-2.5 rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
        <ShieldCheck className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6] flex-shrink-0" />
        <span>{t.auth.proOnlyNotice}</span>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-[#DFE5EB] dark:border-[#223043] pb-3 mb-6 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg(null);
          }}
          className={`pb-2 border-b-2 cursor-pointer transition-colors ${
            mode === 'register'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.auth.registerTitle}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setErrorMsg(null);
          }}
          className={`pb-2 border-b-2 cursor-pointer transition-colors ${
            mode === 'signin'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.nav.signIn}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
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
                  placeholder="e.g. North IT Solutions Ltd"
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
          className="w-full py-2.5 px-4 mt-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading
            ? 'Processing...'
            : isSubscribingFlow
            ? mode === 'register'
              ? 'Create Account & Continue to Stripe'
              : 'Sign In & Continue to Stripe'
            : mode === 'signin'
            ? t.auth.signInBtn
            : t.auth.registerBtn}
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </form>
    </div>
  );
}
