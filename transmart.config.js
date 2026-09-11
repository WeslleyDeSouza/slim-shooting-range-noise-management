require('dotenv').config();

/**
 * Transmart: machine translation of the locale files (npm run translate).
 * `de` is the source of truth; the other languages are generated from it and
 * then reviewed by hand. Needs OPEN_API_KEY in .env.
 */
const LANGUAGES = [
  { languageId: 1, name: 'de' },
  { languageId: 2, name: 'en' },
  { languageId: 3, name: 'fr' },
  { languageId: 4, name: 'it' },
];

module.exports = {
  baseLocale: 'de',
  locales: LANGUAGES.map((l) => l.name.toLowerCase()),
  localePath: './apps/app/public/assets/locales',
  openAIApiKey: process.env['OPEN_API_KEY'] || process.env['OPENAI_API_KEY'],
  context:
    'Swiss federal application for managing shooting noise immissions (SLIM). Swiss German spelling: "ss" instead of "ß".',
  overrides: {},
};
