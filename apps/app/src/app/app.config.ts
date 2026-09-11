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
    { provide: 'env', useValue: environment },
    { provide: LOCALE_ID, useValue: 'de-CH' },
  ],
};
