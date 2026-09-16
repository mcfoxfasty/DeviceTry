import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isValidLocale } from '@/lib/i18n';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const langParam = typeof params.lang === 'string' ? params.lang : DEFAULT_LOCALE;
  const locale = isValidLocale(langParam) ? langParam : DEFAULT_LOCALE;

  redirect(`/pro/subscribe?lang=${locale}`);
}
