import { criteria, test } from './support/criteria';

/**
 * Performance (B1 12.5) — slm 54: Suche Ø 2 s / max 5 s, Filter 0.5 / 1 s, Details 2 / 5 s, Berechnung 5 / 10 s.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c11-performance', () => {
  test.fixme(
    "search on the overview answers within 2 s on average",
    { annotation: criteria({"slm":[54]}) },
    async () => {
      // Measure performance.now() around typing in the search and the table settling; repeat 10×.
    },
  );
  test.fixme(
    "the assessment of Geissalp is served within 5 s",
    { annotation: criteria({"slm":[54]}) },
    async () => {
      // Time GET …/calculation/assessment via page.request; assert < 5000 ms (today ≈ 100 ms).
    },
  );
  test.fixme(
    "a simulation run returns within 10 s",
    { annotation: criteria({"slm":[54]}) },
    async () => {
      // Time POST …/calculation/simulation.
    },
  );
  test.fixme(
    "load: 10 parallel users on the overview (k6 script from ELO)",
    { annotation: criteria({"slm":[54]}) },
    async () => {
      // Reuse ELO tools/k6; document the numbers in docs/anforderungskatalog/umsetzungsstand.md.
    },
  );
});
