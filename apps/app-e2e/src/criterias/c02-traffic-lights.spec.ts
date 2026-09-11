import { criteria, test } from './support/criteria';

/**
 * Ampel-Regelwerk (B1 5.10, docs/anforderungskatalog/index.md Abschnitt 3) — slm 4, 8, 9.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c02-traffic-lights', () => {
  test.fixme(
    "colours the noise state red above the limit, orange within 5 dB, green below",
    { annotation: criteria({"slm":[9]}) },
    async () => {
      // Details Geissalp: E1 60.8 > 60 → over; E3 58.6 → warn; E4 52.3 vs 65 → ok.
    },
  );
  test.fixme(
    "colours the quota state by 100 % / 125 % of the Plangenehmigung",
    { annotation: criteria({"slm":[9]}) },
    async () => {
      // Needs 5.10 Schiessplatz-Übersicht with the quota table (open): Soll from area_weapon.quota, Ist from the usages of the year.
    },
  );
  test.fixme(
    "aggregates the area light from its worst element and keeps «none» without a calculation basis",
    { annotation: criteria({"slm":[4,8]}) },
    async () => {
      // Overview: Geissalp shows both pills; Hinterrhein shows none for both; the filter «Handlungsbedarf» lists only warn/over areas.
    },
  );
});
