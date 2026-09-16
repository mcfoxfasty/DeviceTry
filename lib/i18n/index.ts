import { Locale, DEFAULT_LOCALE, LOCALES, Translations } from './types';
import { enTranslations } from './dictionaries/en';
import { frTranslations } from './dictionaries/fr';
import { arTranslations } from './dictionaries/ar';

export { DEFAULT_LOCALE, LOCALES };
export type { Locale, Translations };

const dictionaries: Record<Locale, Translations> = {
  en: enTranslations,
  fr: frTranslations,
  ar: arTranslations,
};

export function isValidLocale(locale: string): locale is Locale {
  return locale in LOCALES;
}

export function getDictionary(locale?: string): Translations {
  if (locale && isValidLocale(locale)) {
    return dictionaries[locale];
  }
  return dictionaries[DEFAULT_LOCALE];
}

export function getLocaleConfig(locale?: string) {
  if (locale && isValidLocale(locale)) {
    return LOCALES[locale];
  }
  return LOCALES[DEFAULT_LOCALE];
}

/**
 * Format timestamp according to locale
 */
export function formatLocalizedDate(date: Date | string | number, locale: Locale): string {
  const d = typeof date === 'object' ? date : new Date(date);
  const localeStr = LOCALES[locale]?.localeString || 'en-US';
  return new Intl.DateTimeFormat(localeStr, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Format numbers according to locale with proper digits
 */
export function formatLocalizedNumber(num: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  const localeStr = LOCALES[locale]?.localeString || 'en-US';
  return new Intl.NumberFormat(localeStr, options).format(num);
}

/**
 * Automated parity check to verify all keys exist across all languages
 */
export function verifyTranslationParity(): { valid: boolean; missingKeys: string[] } {
  const missingKeys: string[] = [];
  const locales: Locale[] = ['fr', 'ar'];

  function checkKeys(baseObj: Record<string, unknown>, targetObj: Record<string, unknown>, prefix = '', targetLocale: string) {
    for (const key of Object.keys(baseObj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (!(key in targetObj)) {
        missingKeys.push(`[${targetLocale}] Missing key: ${fullPath}`);
      } else if (
        typeof baseObj[key] === 'object' &&
        baseObj[key] !== null &&
        !Array.isArray(baseObj[key])
      ) {
        checkKeys(
          baseObj[key] as Record<string, unknown>,
          targetObj[key] as Record<string, unknown>,
          fullPath,
          targetLocale
        );
      }
    }
  }

  for (const loc of locales) {
    checkKeys(
      enTranslations as unknown as Record<string, unknown>,
      dictionaries[loc] as unknown as Record<string, unknown>,
      '',
      loc
    );
  }

  return {
    valid: missingKeys.length === 0,
    missingKeys,
  };
}
