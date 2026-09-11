require('dotenv').config();
const { Transmart } = require('@transmart/core');
const path = require('path');

/**
 * Programmatic Transmart run with progress output (same as ELO's tools/transmart.js).
 * `npx transmart` (npm run translate) uses transmart.config.js instead; this
 * script is for CI or when a specific model is wanted.
 */
const LANGUAGES = [
  { languageId: 1, name: 'de' },
  { languageId: 2, name: 'en' },
  { languageId: 3, name: 'fr' },
  { languageId: 4, name: 'it' },
];

const localePath = path.resolve(__dirname, '../apps/app/public/assets/locales/');

const config = {
  baseLocale: 'de',
  locales: LANGUAGES.map((l) => l.name.toLowerCase()).filter((l) => l !== 'de'),
  localePath,
  openAIApiKey: process.env['OPEN_API_KEY'] || process.env['OPENAI_API_KEY'],
  openAIApiModel: process.env['OPEN_API_MODEL'] || 'gpt-5-nano',
  overrides: {},
  context:
    'Swiss federal application for managing shooting noise immissions (SLIM). Swiss German spelling: "ss" instead of "ß".',
};

(async () => {
  console.log('Starting translation...', localePath);
  const transmart = new Transmart(config);

  const stats = await transmart.run({
    onStart: (work) => console.log(`Starting ${work.locale}/${work.namespace}`),
    onProgress: (current, total, work) =>
      console.log(
        `Progress: ${Math.round((current / total) * 100)}% (${current}/${total}) - ${work.locale}/${work.namespace}`,
      ),
    onResult: (result) => {
      if (result.failed) {
        console.error(
          `Failed ${result.work.locale}/${result.work.namespace}:`,
          result.reason?.message,
        );
      } else {
        console.log(`✓ ${result.work.locale}/${result.work.namespace}`);
      }
    },
  });

  console.log('\nTranslation completed:');
  console.log(`Locales: ${stats.locales?.success}/${stats.locales?.total} successful`);
  console.log(`Namespaces: ${stats.namespaces.success}/${stats.namespaces.total} successful`);
})();
