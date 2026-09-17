import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F7F9] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <h2 className="text-xl font-semibold">Page Not Found</h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
