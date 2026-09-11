import { test as base } from '@playwright/test';

/**
 * Tags a Playwright test with the tender criteria it proves, so the report
 * can be grouped by `slm` id (Beilage B1) and by the acceptance criteria of
 * docs/projects/prototyp-roadmap.md (section 1, «K1»–«K7»).
 *
 *   test('…', { annotation: slm(10, 37) }, async ({ page }) => { … });
 */
export function slm(...ids: (number | string)[]) {
  return ids.map((id) => ({ type: 'slm', description: String(id) }));
}

export function acceptance(...ids: (number | string)[]) {
  return ids.map((id) => ({ type: 'acceptance', description: `K${id}` }));
}

/** Convenience: both kinds at once. */
export function criteria(opts: { slm?: (number | string)[]; acceptance?: (number | string)[] }) {
  return [...slm(...(opts.slm ?? [])), ...acceptance(...(opts.acceptance ?? []))];
}

/** The demo accounts of the dataset (tenant.mock.json), one per B1 role. */
export const ACCOUNTS = {
  admin: { email: 'slim@demo.ch', password: '1234' },
  specialist: { email: 'fachspezialist@demo.ch', password: '1234' },
  rangeOwner: { email: 'schiessplatz@demo.ch', password: '1234' },
  interested: { email: 'interessent@demo.ch', password: '1234' },
  appAdmin: { email: 'appadmin@demo.ch', password: '1234' },
} as const;

/** Control values of Beilage B1.4 (sonARMS demo project) the engine must reproduce. */
export const B14_CONTROL = {
  annex9: { E1: 60.7, E2: 51.8, E3: 46.6, E4a: 41.8 },
  annex7: { E1: 73.8, E2: 66.3, E3: 60.5, E4a: 53.1 },
} as const;

export const test = base;
export { expect } from '@playwright/test';
