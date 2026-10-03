import { APP_LANGUAGES } from '@slim/shared';

/** B1 12.2: use the first supported browser language until the user makes a choice. */
export function browserLanguage(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): string {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if ((APP_LANGUAGES as readonly string[]).includes(base)) return base;
  }
  return 'de';
}
