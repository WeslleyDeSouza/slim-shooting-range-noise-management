import { criteria, test } from './support/criteria';

/**
 * Simulation (B1 5.13) — slm 12.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c04-simulation', () => {
  test.fixme(
    "starts from the military shots of the year per room × weapon (7.4.5)",
    { annotation: criteria({"slm":[12,31]}) },
    async () => {
      // Covered by area-simulation.spec.ts «starts from the Ist with the run disabled».
    },
  );
  test.fixme(
    "×10 raises every level by 10 dB, moving shots to the evening adds 5 dB",
    { annotation: criteria({"slm":[12,33]}) },
    async () => {
      // API: POST simulation with all rows ×10 → delta ≈ +10.0 for every assessed receiver (Vitest covers it; add the UI check).
    },
  );
  test.fixme(
    "never persists anything and resets to the Ist",
    { annotation: criteria({"slm":[12]}) },
    async () => {
      // Run a simulation, reload the page: values are back to the Ist, the assessment on Details is unchanged.
    },
  );
});
