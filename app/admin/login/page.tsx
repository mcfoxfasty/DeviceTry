import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAuthenticated, usingDefaultPassword } from '@/lib/admin/session';

/**
 * The sign-in form.
 *
 * A server component with a plain `<form method="post">` — no client JavaScript at
 * all. That is what makes it reliable on a phone: iOS Safari and every in-app
 * browser submit a native form without a hydration step, without a popup and
 * without a redirect to a third party, and the password manager can fill it in.
 *
 * The password field carries `autocomplete="current-password"` for exactly that
 * reason. The error is a query flag rather than a message from the server, so a
 * failed attempt reveals nothing beyond "that was not it".
 */

export const metadata: Metadata = {
  title: 'Sign in — DeviceTry Admin',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated(await cookies())) redirect('/admin');
  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">DeviceTry Admin</h1>
          <p className="mt-1.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
            Sign in to write and publish an article.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-sm text-[#DC2626] dark:text-[#EF4444]"
            >
              That password was not accepted. Try again.
            </p>
          ) : null}

          <form method="post" action="/api/admin/login" className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#F7F6FB] dark:bg-[#192332] px-3 py-3 text-base outline-none focus:border-[#0F766E] dark:focus:border-[#14B8A6] focus:ring-2 focus:ring-[#E6F4F2] dark:focus:ring-[#132E2E]"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-4 py-3 text-base font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] active:scale-[0.99] transition"
            >
              Sign in
            </button>
          </form>

          {usingDefaultPassword() ? (
            <p className="mt-5 rounded-lg border border-[#FEF3C7] dark:border-[#451A03] bg-[#FEF3C7] dark:bg-[#451A03] px-3 py-2 text-xs leading-relaxed text-[#B45309] dark:text-[#F59E0B]">
              This deployment is using the documented default password. Set{' '}
              <code className="font-mono">ADMIN_PASSWORD</code> in the environment to replace it.
            </p>
          ) : null}
        </div>

        <p className="mt-4 text-center text-xs text-[#8996A6]">
          <Link href="/" className="underline hover:text-[#0F766E] dark:hover:text-[#14B8A6]">
            Back to DeviceTry
          </Link>
        </p>
      </div>
    </main>
  );
}
