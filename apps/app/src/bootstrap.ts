import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import {
  authenticationLayoutReducer,
  authenticationReducer,
} from '@app-galaxy/auth-ui';

import { appConfig } from './app/app.config';
import { App } from './app/app';
import { enforceRememberSession } from './app/views/auth/remember-session';
import { PublicAuthErrorInterceptor } from './app/views/auth/public-auth-error.interceptor';

registerLocaleData(localeDeCH);

// Before anything reads the session: a visitor who signed in with
// «Angemeldet bleiben» off gets logged out once that tab is gone.
enforceRememberSession();

appConfig.providers = [
  appConfig.providers,
  // Auth store slices of `@app-galaxy/auth-ui`; provideAuth() is registered
  // once in app.config.ts.
  provideStore({
    authentication: authenticationReducer,
    authenticationLayout: authenticationLayoutReducer,
  }),
  // LAST on purpose: interceptors run in provider order, the last one sits
  // closest to the backend and re-badges 401s of the public auth endpoints
  // so the pages keep their own state instead of a login redirect.
  {
    provide: HTTP_INTERCEPTORS,
    useClass: PublicAuthErrorInterceptor,
    multi: true,
  },
].flat(2);

bootstrapApplication(App, appConfig).catch((err: unknown) =>
  console.error(err),
);
