import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDeCH from '@angular/common/locales/de-CH';
import { provideStore } from '@ngrx/store';

import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeDeCH);

appConfig.providers = [
  appConfig.providers,
  // Root store; feature slices are registered by their lazy routes.
  provideStore({}),
].flat(2);

bootstrapApplication(App, appConfig).catch((err: unknown) =>
  console.error(err),
);
