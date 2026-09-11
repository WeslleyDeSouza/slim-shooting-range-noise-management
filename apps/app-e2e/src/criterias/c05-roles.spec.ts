import { criteria, test } from './support/criteria';

/**
 * Rollen und Rechte (B1 8.1, docs/architecture/berechtigungen.md) — slm 35, 56, Abnahmekriterium K5.
 * One case per demo account (ACCOUNTS in support/criteria.ts).
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c05-roles', () => {
  test.fixme(
    "Interessent: reads everything, cannot record usages or run a simulation",
    { annotation: criteria({"slm":[35],"acceptance":[5]}) },
    async () => {
      // Sign in as interested; Schusszahlen page has no «Nutzung erfassen»; POST usage → 403; simulation base → 403.
      // Needs CASL in the frontend for the hidden buttons (open) — today the API answers 403.
    },
  );
  test.fixme(
    "Schiessplatz-Verantwortlicher: sees only Geissalp and Thun, edits their usages",
    { annotation: criteria({"slm":[35],"acceptance":[5]}) },
    async () => {
      // Sign in as rangeOwner; overview lists 2 areas; deep link to Bière → 403 (area-scope rule).
    },
  );
  test.fixme(
    "Fachspezialist: everything except administration",
    { annotation: criteria({"slm":[35]}) },
    async () => {
      // Sign in as specialist; roles/apps pages → 403; usages, details, simulation allowed.
    },
  );
  test.fixme(
    "Applikationsadministrator: administration only, read elsewhere",
    { annotation: criteria({"slm":[35]}) },
    async () => {
      // Sign in as appAdmin; roles page editable; Schusszahlen read only.
    },
  );
  test.fixme(
    "authenticates with 2FA or password (MFA «oder» AGOV)",
    { annotation: criteria({"slm":[35,56]}) },
    async () => {
      // Covered by auth.spec.ts (two-fa-login flow with mail host); keep the reference.
    },
  );
});
