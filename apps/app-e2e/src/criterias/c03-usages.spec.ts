import { criteria, test } from './support/criteria';

/**
 * Schiessplatz-Nutzungen (B1 5.11, 9.x) — slm 10, 37, 45.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c03-usages', () => {
  test.fixme(
    "records, edits, deletes and restores a usage",
    { annotation: criteria({"slm":[10]}) },
    async () => {
      // Covered today by area-shots.spec.ts — move that case here or reference it in the report.
    },
  );
  test.fixme(
    "offers only the allowed room × weapon combinations (5.17)",
    { annotation: criteria({"slm":[10,17]}) },
    async () => {
      // Drawer: pick «Stellungsrm B 2» → the weapon select lists Mg 51, Stgw 90, Pist 75 only.
    },
  );
  test.fixme(
    "defaults the filter to the current year and blocks entries after the Sperrdatum",
    { annotation: criteria({"slm":[10,27]}) },
    async () => {
      // Year select = current year; date range 01.01–31.12.
      // Sperrdatum (5.28, open): a usage dated before the lock is rejected by the API with a translated message.
    },
  );
  test.fixme(
    "imports the Excel of Beilage B1.6 with an error report",
    { annotation: criteria({"slm":[37,45]}) },
    async () => {
      // Upload B1.6 «Erfassung» sheet (open): rows with unknown Stellungsraum are reported and the import aborts (slm 45).
    },
  );
});
