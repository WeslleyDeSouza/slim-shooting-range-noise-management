import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAuth } from '@app-galaxy/auth-ui';
import {
  LANGUAGES_CONSTANTS,
  provideTranslate,
} from '@app-galaxy/translate-ui';
import { provideDesignSystem } from '@ui-slim/design-system';
import { ApiConfiguration } from '@ui-slim/apiClient';
import { APP_LANGUAGES } from '@slim/shared';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    DecimalPipe,
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.sw,
      registrationStrategy: 'registerWhenStable',
    }),

    // i18n (ELO pattern): sections live in apps/app/public/assets/locales/
    // <lang>/<section>.locale.json. `common` and `forms` are loaded on start,
    // feature sections via `resolve: LocaleResolver.default` + `data.path`.
    // Language choice persists in localStorage `app.lang`, default `de`.
    provideTranslate({
      language: 'de',
      initialLocalesFiles: ['common', 'forms'],
      languages: LANGUAGES_CONSTANTS.LANGUAGE_DEFAULT_IDS_APP.filter((lang) =>
        (APP_LANGUAGES as readonly string[]).includes(lang.name),
      ),
    }),

    // Single provideAuth registration (galaxy auth-ui): session store,
    // interceptors (bearer, tenant token, refresh, replay header) and the
    // tenant flow. Same configuration as ELO / alco-map.
    provideAuth({
      env: environment,
      mock: {
        defaultUser: environment.sampleUser,
      },
      hooks: {
        onLogin: 'api/auth/me/session',
      },
      endpoints: {
        signOut: 'logout',
        encryptCredentials: true,
      },
      tenant: {
        enabled: true,
        effects: true,
      },
      display: {
        sensitiveData: true,
      },
      effects: true,
    }),

    // Generated client (@ui-slim/apiClient): relative root, the dev server
    // proxies /api; in production the API serves the app.
    {
      provide: ApiConfiguration,
      useValue: Object.assign(new ApiConfiguration(), { rootUrl: '' }),
    },

    // Design system runtime: theme mode + brand colours (see .claude/styleguide.md).
    // Tenant colours can be passed here or later via SlimThemeService.setColors().
    provideDesignSystem(),
    { provide: 'env', useValue: environment },
    { provide: LOCALE_ID, useValue: 'de-CH' },
  ],
};
