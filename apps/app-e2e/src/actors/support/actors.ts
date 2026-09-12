/**
 * Registry of the e2e actors (readme.md, sections 1–3) and the fixture
 * data they act on (section 4). One place for «who signs in as what», so
 * a spec names the actor (`A01`) and never a demo account.
 *
 * Accounts: every synthetic identity is read from the environment first
 * (`E2E_<ID>_USER` / `E2E_<ID>_PASSWORD`, the test-secret mechanism) and
 * falls back to the demo dataset of the API (`apps/api/src/mocks/tenant/
 * tenant.mock.json`, password `1234`). Identities the dataset does not
 * provision yet (`demo: null`) fail loudly in `credentialsOf()` — a test
 * that needs them stays `fixme` until the seed or the secret exists.
 */
import type { Credentials } from '../../support/credentials';

/** B1 role keys (`app_role.settings.key`, docs/architecture/berechtigungen.md). */
export type RoleKey =
  | 'admin'
  | 'slim_specialist'
  | 'slim_range_owner'
  | 'slim_interested'
  | 'slim_admin'
  | 'none';

export type ActorId =
  // 1. Fachliche Akteure
  | 'A01' | 'A02' | 'A03' | 'A04' | 'A05'
  // 2. Externe Systeme / technische Akteure
  | 'S01' | 'S02' | 'S03'
  // 3. Zusätzliche Testidentitäten
  | 'T01' | 'T02' | 'T03' | 'T04' | 'T05' | 'T06' | 'T07';

export interface Actor {
  id: ActorId;
  /** Name as in readme.md. */
  label: string;
  /** Role of the identity in SLIM; `none` = no SLIM login exists / is allowed. */
  role: RoleKey;
  /** Demo account of tenant.mock.json, `null` = not provisioned (yet). */
  demo: Credentials | null;
  /** Schiessplätze the identity is assigned to (W/R-O); `null` = unrestricted. */
  areas: string[] | null;
  /** Why the identity exists / what its tests must respect. */
  note: string;
}

const DEMO_PASSWORD = '1234';
const demo = (email: string): Credentials => ({ email, password: DEMO_PASSWORD });

export const ACTORS: Record<ActorId, Actor> = {
  A01: {
    id: 'A01',
    label: 'Fachspezialist KOMZ Lärm',
    role: 'slim_specialist',
    demo: demo('fachspezialist@demo.ch'),
    areas: null,
    note: 'B1 4.2.1; Matrix 8.1.2: R/W überall ausser Administration (X).',
  },
  A02: {
    id: 'A02',
    label: 'Schiessplatz-Verantwortlicher',
    role: 'slim_range_owner',
    demo: demo('schiessplatz@demo.ch'),
    areas: ['Geissalp', 'Thun'],
    note: 'B1 4.2.4; W/R-O auf Nutzungen, Simulation, Zuordnung Waffen, Benutzer; X auf Berechnungen.',
  },
  A03: {
    id: 'A03',
    label: 'Interessent Schiessplatznutzung und Lärmentwicklung',
    role: 'slim_interested',
    demo: demo('interessent@demo.ch'),
    areas: null,
    note: 'B1 4.2.2; R auf Nutzungen und Datenverwaltung, X auf Simulation, Berechnungen, Zuordnung Waffen, Benutzer.',
  },
  A04: {
    id: 'A04',
    label: 'Schiessplatz-Nutzer',
    role: 'none',
    demo: null,
    areas: null,
    note: 'B1 4.2.3; erfasst über ELO (S01). Kein SLIM-Konto ableiten; Option B1 Kap. 11 separat.',
  },
  A05: {
    id: 'A05',
    label: 'Applikationsadministrator',
    role: 'slim_admin',
    demo: demo('appadmin@demo.ch'),
    areas: null,
    note: 'B1 8.1.1; R/W Administration (5.28), sonst R. Keine vollständigen Fachrechte unterstellen.',
  },

  S01: {
    id: 'S01',
    label: 'ELO / Schusszahlenerfassung (Maschinenidentität)',
    role: 'none',
    demo: null,
    areas: null,
    note: 'B1 4.2.5, Kap. 6; API-Token statt Benutzerkonto (E2E_S01_TOKEN). Stub-Läufe als solche ausweisen.',
  },
  S02: {
    id: 'S02',
    label: 'Bundesinterner Datenempfänger (MGDM / ImmoGIS)',
    role: 'none',
    demo: null,
    areas: null,
    note: 'B1 9.4 (slm 38): Views auf die Datenbank, nur lesend; Empfänger und Vertrag aus den Unterlagen.',
  },
  S03: {
    id: 'S03',
    label: 'Swisstopo-Kartendienste',
    role: 'none',
    demo: null,
    areas: null,
    note: 'B1 5.4; kein SLIM-Konto, Verhalten bei Fehler/Timeout/Ausfall (Route-Mocking).',
  },

  T01: {
    id: 'T01',
    label: 'Nicht angemeldet',
    role: 'none',
    demo: null,
    areas: null,
    note: 'Leerer storageState; geschützte Seiten, API und Downloads ohne Sitzung.',
  },
  T02: {
    id: 'T02',
    label: 'Angemeldet, ohne SLIM-Fachberechtigung',
    role: 'none',
    demo: null,
    areas: null,
    note: 'Konto ohne Rolle – im Demo-Seed noch nicht vorhanden (E2E_T02_*).',
  },
  T03: {
    id: 'T03',
    label: 'Gesperrtes Konto / abgelaufene Sitzung',
    role: 'none',
    demo: null,
    areas: null,
    note: 'Sperre nach Fehlversuchen (galaxy) bzw. abgelaufener JWT; Sitzungs-/Sperrkonzept als Quelle.',
  },
  T04: {
    id: 'T04',
    label: 'Benutzer mit MFA noch nicht abgeschlossen',
    role: 'none',
    demo: null,
    areas: null,
    note: '2FA-Konto (auth.spec.ts, braucht MAIL_HOST); vor Code-Eingabe keine Fach-API.',
  },
  T05: {
    id: 'T05',
    label: 'Verantwortlicher für Platz A, nicht B',
    role: 'slim_range_owner',
    demo: demo('schiessplatz@demo.ch'),
    areas: ['Geissalp', 'Thun'],
    note: 'Heute identisch mit A02 (Geissalp/Thun = A, Bière = B). Objektrecht getrennt vom Rollenrecht prüfen.',
  },
  T06: {
    id: 'T06',
    label: 'Notfalladministrator / Break-Glass',
    role: 'admin',
    demo: null,
    areas: null,
    note: 'Nur über den freigegebenen Prozess (docs Si001); nie als gewöhnliches Admin-Konto benutzen.',
  },
  T07: {
    id: 'T07',
    label: 'Identität eines anderen Mandanten',
    role: 'none',
    demo: null,
    areas: null,
    note: 'Zweiter Mandant im Seed nötig (E2E_T07_*); mandantenübergreifender Zugriff → 403/404.',
  },
};

/**
 * Credentials of an actor: `E2E_<ID>_USER` / `E2E_<ID>_PASSWORD` win, the
 * demo account is the fallback. Throws for identities nobody provisioned —
 * that is the signal to keep the case `fixme`, not to invent a login.
 */
export function credentialsOf(id: ActorId): Credentials {
  const actor = ACTORS[id];
  const email = process.env[`E2E_${id}_USER`];
  const password = process.env[`E2E_${id}_PASSWORD`];
  if (email && password) return { email, password };
  if (actor.demo) return actor.demo;
  throw new Error(
    `${id} (${actor.label}) has no credentials: set E2E_${id}_USER / E2E_${id}_PASSWORD or seed the identity`,
  );
}

/**
 * Fixture Schiessplätze (readme.md, section 4) as they exist in the demo
 * dataset. Named by role in the tests (A / B / C), resolved by name here,
 * so a change of the seed touches one line.
 */
export const FIXTURE_AREAS = {
  /** Platz A: 2 Berechnungsstände, 14 Stellungsräume, 16 Quellen, 6 Empfangspunkte, A02 zugeordnet. */
  A: {
    name: 'Geissalp',
    coordinationSectionNo: '1104.020',
    sectoralPlanNo: 'SP-BE-11',
    rooms: 14,
    calculations: 2,
    states: ['Initiale Aufnahme Areal Geissalp', 'Sanierter Zustand SPM Geissalp'],
  },
  /** Platz B: nicht A02 zugeordnet → Negativfälle «fremdes Objekt». */
  B: {
    name: 'Bière',
    coordinationSectionNo: '2201.010',
    sectoralPlanNo: 'SP-VD-03',
    rooms: 2,
    calculations: 0,
    states: [] as string[],
  },
  /** Platz C: ohne Berechnungsgrundlage und ohne Nutzungen → keine erfundene Ampel. */
  C: {
    name: 'Hinterrhein',
    coordinationSectionNo: '7102.010',
    sectoralPlanNo: null,
    rooms: 2,
    calculations: 0,
    states: [] as string[],
  },
  /**
   * Platz S: synthetischer Testplatz mit handgerechneten Soll-Werten
   * (`../fixtures/platz-s.md`, Dataset `../fixtures/platz-s.dataset.json`).
   * 1 Stellungsraum, 2 Berechnungen / 3 Zustände, 6 Nutzungen. Nicht im Demo-Seed.
   */
  S: {
    name: 'Testplatz S',
    coordinationSectionNo: '9999.001',
    sectoralPlanNo: null,
    rooms: 1,
    calculations: 2,
    states: ['Z1 Ist 2020', 'Z2 Sanierung 2024', 'Z3 Sanierung ohne Gewichte'],
  },
} as const;

export type FixtureArea = keyof typeof FIXTURE_AREAS;

/**
 * Playwright annotations, so the HTML report (= Abnahmeprotokoll) can be
 * filtered by actor, use case (B1 4.x), requirement (`slm`) and the
 * cell of the role matrix (B1 8.1.2) the case proves.
 *
 *   test('…', { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [16], matrix: '5.16 R/W' }) }, …)
 */
export function tags(opts: {
  actor: ActorId;
  useCase?: string;
  slm?: (number | string)[];
  /** «<Kapitel> <Recht>» as in the matrix, e.g. `5.17 W/R-O`, `5.28 X`. */
  matrix?: string | string[];
  /** Priority of the Fachablauf (readme.md, section 7). */
  prio?: 1 | 2 | 3;
}) {
  const one = (type: string, description: string) => ({ type, description });
  return [
    one('actor', `${opts.actor} ${ACTORS[opts.actor].label}`),
    ...(opts.prio ? [one('prio', String(opts.prio))] : []),
    ...(opts.useCase ? [one('use-case', `B1 ${opts.useCase}`)] : []),
    ...(opts.slm ?? []).map((id) => one('slm', String(id))),
    ...([opts.matrix ?? []].flat()).map((cell) => one('matrix', cell)),
  ];
}
