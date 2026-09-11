import { criteria, test } from './support/criteria';

/**
 * Lärmberechnung (B1 Kapitel 7, Beilage B1.4) — slm 31–34, Abnahmekriterium K2.
 * Die Formeln selbst sind in libs/shared/lsv mit 95 Vitest-Fällen belegt; hier
 * geht es um den Nachweis am laufenden System (Details-Seite, API).
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c01-noise-calculation', () => {
  test.fixme(
    "reproduces the B1.4 control values through the assessment API",
    { annotation: criteria({"slm":[33],"acceptance":[2]}) },
    async () => {
      // Seed a calculation state with the four sonARMS demo sources (fixture of @slim/lsv) for a test area via the API (needs an import endpoint, 5.19 — open).
      // GET admin/area/:id/calculation/assessment and compare Lr per receiver with B14_CONTROL (annex 9 and 7, 1 decimal).
    },
  );
  test.fixme(
    "derives the operating data from the usages (7.4): workday split and half-days",
    { annotation: criteria({"slm":[31]}) },
    async () => {
      // Record two usages on Geissalp: Monday 08:00–11:30 (inside) and Sunday 09:00–11:00 (outside).
      // Read operatingData of the assessment: inside/outside sums of the source changed by exactly those shots.
    },
  );
  test.fixme(
    "shows the assessment per receiver with limit, reserve and delta to the current state (5.12)",
    { annotation: criteria({"slm":[33,34]}) },
    async () => {
      // Open Details of Geissalp, select E1: row Anhang 9 IGW = 60 dB, level 60.8 dB, state over.
      // Switch to «Sanierter Zustand»: 56.4 dB, delta −4.4 dB, state warn.
      // E6 (Reservepunkt) has no level and the state none.
    },
  );
  test.fixme(
    "applies the Planungswert only to plant parts built after 1985 (7.7, mixed state)",
    { annotation: criteria({"slm":[34]}) },
    async () => {
      // For E1 the PW row (55 dB) is lower than the IGW row because only Neuhaus B 3 and Salzmatt C 3 count.
    },
  );
});
