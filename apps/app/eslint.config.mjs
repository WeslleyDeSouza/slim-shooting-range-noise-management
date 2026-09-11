import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // No NgRx in app code (ELO pattern: facades + own signal store, see
      // core/store/signal-store.ts). @ngrx/store stays installed only because
      // @app-galaxy/auth-ui needs it internally.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ngrx/*', 'ngrx-store-localstorage'],
              message:
                'No NgRx in app code — use a facade + SignalStore (core/store/signal-store.ts).',
            },
          ],
        },
      ],
    },
  },
  {
    // The galaxy auth-ui needs its store registered once; nowhere else.
    files: ['**/bootstrap.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
