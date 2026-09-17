import { Locale, DEFAULT_LOCALE, LOCALES, Translations } from './types';
import { enTranslations } from './dictionaries/en';

export { DEFAULT_LOCALE, LOCALES, isValidLocale } from './types';
export type { Locale, Translations } from './types';

const dictionaries: Record<Locale, Translations> = {
  en: enTranslations,
};

export function getDictionary(_locale?: string): Translations {
  return dictionaries[DEFAULT_LOCALE];
}

export function getLocaleConfig(_locale?: string) {
  return LOCALES[DEFAULT_LOCALE];
}

/**
 * Format timestamp according to locale
 */
export function formatLocalizedDate(date: Date | string | number, _locale: Locale): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return new Intl.DateTimeFormat(LOCALES[DEFAULT_LOCALE].localeString, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Format numbers according to locale with proper digits
 */
export function formatLocalizedNumber(num: number, _locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALES[DEFAULT_LOCALE].localeString, options).format(num);
}
