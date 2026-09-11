import { criteria, test } from './support/criteria';

/**
 * Login-Logging, Sperren, Logbuch (B1 12.x Sicherheit) — slm 56, 57.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c09-logging-security', () => {
  test.fixme(
    "writes AUTH_LOGIN and AUTH_LOGIN_FAILED entries with method, reason and origin",
    { annotation: criteria({"slm":[56]}) },
    async () => {
      // Wrong password then right password; Logbuch page filtered by section AUTH_LOGIN_FAILED shows the reason invalid-credentials, AUTH_LOGIN the method password.
    },
  );
  test.fixme(
    "locks the account after the configured failed attempts and logs account-locked",
    { annotation: criteria({"slm":[56]}) },
    async () => {
      // Needs API_AUTH_LOGIN_LOCKOUT_ENABLED=1 in the e2e API (tools/serve-api-e2e.js); expect the lock banner and the log entry; unlock via user administration.
    },
  );
  test.fixme(
    "logs password reset requests and changes, logout and e-mail verification",
    { annotation: criteria({"slm":[56]}) },
    async () => {
      // Recover-password flow (mail host) → AUTH_PASSWORD_RESET_REQUESTED, AUTH_PASSWORD_CHANGED; logout → AUTH_LOGOUT.
    },
  );
  test.fixme(
    "exports the logbook as XLSX and logs the export itself",
    { annotation: criteria({"slm":[56]}) },
    async () => {
      // Logs page: export button → download with .xlsx; a new entry with action EXPORT appears.
    },
  );
  test.fixme(
    "break-glass account and backup monitoring are documented processes",
    { annotation: criteria({"slm":[56,57]}) },
    async () => {
      // No UI: point the report to docs/architecture/berechtigungen.md and deployment-sicherheit.md.
    },
  );
});
