/**
 * Which account the suite signs in as: explicit override, else the API's
 * `APP_DEFAULT_USER`, else what `tools/serve-api-e2e.js` seeds.
 */
const E2E_FALLBACK_USER = 'slim@demo.ch';
const E2E_FALLBACK_PASSWORD = '1234';

export interface Credentials {
  email: string;
  password: string;
}

export function credentials(): Credentials {
  return {
    email:
      process.env['E2E_USER'] ??
      process.env['APP_DEFAULT_USER'] ??
      E2E_FALLBACK_USER,
    password:
      process.env['E2E_PASSWORD'] ??
      process.env['APP_DEFAULT_PASSWORD'] ??
      E2E_FALLBACK_PASSWORD,
  };
}
