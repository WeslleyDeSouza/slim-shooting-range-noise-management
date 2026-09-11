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
import { provideStoreDevtools } from '@ngrx/store-devtools';
import {
  LANGUAGES_CONSTANTS,
  provideTranslate,
} from '@app-galaxy/translate-ui';
import { provideDesignSystem } from '@ui-slim/design-system';
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
    provideStoreDevtools({ maxAge: 25, logOnly: environment.production }),
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

    // Design system runtime: theme mode + brand colours (see .claude/styleguide.md).
    // Tenant colours can be passed here or later via SlimThemeService.setColors().
    provideDesignSystem(),
    { provide: 'env', useValue: environment },
    { provide: LOCALE_ID, useValue: 'de-CH' },
  ],
};
