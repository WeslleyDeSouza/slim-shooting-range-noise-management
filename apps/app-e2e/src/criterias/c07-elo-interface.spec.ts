import { criteria, test } from './support/criteria';

/**
 * Schnittstelle ELO ↔ SLIM (B1 Kapitel 6) — slm 28–30, Abnahmekriterium K3. Endpoints are open (Sprint 2).
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c07-elo-interface', () => {
  test.fixme(
    "GET Anlageninformationen lists areas, rooms and allowed weapon categories",
    { annotation: criteria({"slm":[28,29]}) },
    async () => {
      // GET /api/public/elo/areas with an API token: Geissalp → 14 rooms → weapons of each room.
    },
  );
  test.fixme(
    "POST one Schiessplatznutzung with validation (ISO date, quarter hours, end > start, field lengths)",
    { annotation: criteria({"slm":[29,30]}) },
    async () => {
      // Valid body → 201, usage visible on the shots page with the ELO badge; invalid body → 400 with the field errors.
    },
  );
  test.fixme(
    "a usage posted by ELO changes the traffic light of the area",
    { annotation: criteria({"acceptance":[3]}) },
    async () => {
      // Post enough shots on a source of Geissalp → Details E3 turns from warn to over.
    },
  );
});
