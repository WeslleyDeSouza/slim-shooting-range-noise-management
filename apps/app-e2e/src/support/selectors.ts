/** Shared selectors and timeouts of the e2e suite. */
export const ROUTES = {
  login: '/auth/login',
  home: '/admin',
  area: '/admin/area',
} as const;

export const LOGIN = {
  email: '#auth-email',
  password: '#auth-password',
  submit: '.auth-submit',
  tenant: '.auth-tenant',
} as const;

/** localStorage key auth-ui writes once the API accepted the credentials. */
export const SESSION_KEY = 'app.session';

export const SESSION_TIMEOUT_MS = 20_000;
/** First request after `nx serve` may still be compiling. */
export const COLD_START_TIMEOUT_MS = 180_000;
