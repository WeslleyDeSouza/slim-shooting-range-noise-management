import { criteria, test } from './support/criteria';

/**
 * Datenverwaltung (B1 5.14–5.28) — slm 1, 13–27, 36. Pages are placeholders today (Sprint 1/3).
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c10-data-management', () => {
  test.fixme(
    "Schiessplatz Übersicht / Allgemein / Stammdaten with quotas per weapon",
    { annotation: criteria({"slm":[13,14,15,16]}) },
    async () => {
      // Open.
    },
  );
  test.fixme(
    "Zuordnung Waffen: only allowed combinations are offered to the usage form",
    { annotation: criteria({"slm":[17]}) },
    async () => {
      // Open (data model seeded).
    },
  );
  test.fixme(
    "Berechnungen: states, current / MGDM, import of WLR + operating data, details per room",
    { annotation: criteria({"slm":[18,19,21,45]}) },
    async () => {
      // Open (data model seeded).
    },
  );
  test.fixme(
    "Waffen: caliber, weapon, category with DE/FR/IT fields and Aktiv",
    { annotation: criteria({"slm":[22,23,24,25]}) },
    async () => {
      // Open.
    },
  );
  test.fixme(
    "Erweiterte Konfiguration: Sperrdatum, manual upload, traffic-light thresholds",
    { annotation: criteria({"slm":[27]}) },
    async () => {
      // Open.
    },
  );
  test.fixme(
    "lookup lists are maintainable by the administrator",
    { annotation: criteria({"slm":[1]}) },
    async () => {
      // Open.
    },
  );
});
