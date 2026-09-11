import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  { ignores: ['src/core/**'] },
  {
    files: ['src/index.ts'],
    rules: {
      // The barrel re-exports generated code; @ts-nocheck keeps type noise of
      // the generator out of the app build (same as the ELO / alco-map client lib).
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];
