export const APP_ID = 'slim';
export const APP_TITLE = 'SLIM – Schiesslärmimmissions-Management';

/** Supported UI languages (id order matters for the language switch). */
export const APP_LANGUAGES = ['de', 'fr', 'it', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
