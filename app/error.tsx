'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to client console
    console.error('Application runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            An unexpected error occurred while loading this page.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
