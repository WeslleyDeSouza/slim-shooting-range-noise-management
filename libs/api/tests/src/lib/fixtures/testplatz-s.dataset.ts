/**
 * «Testplatz S» — a synthetic Schiessplatz small enough to compute by hand
 * (apps/app-e2e/src/actors/fixtures/platz-s.md holds the derivation):
 * one Stellungsraum, one source per state, one receiver (a second one only
 * in the later states), six usages. Source weights (Betriebsdaten 7.5) are
 * non-zero for both time groups of the carrying source: with two sources whose
 * weights sum to 0 for a time group the kernel refuses to distribute (O8) —
 * that is what Z3 is for, not Z2. Format: `TenantDataset` of
 * apps/api/src/mocks/tenant/tenant-dataset.ts (12.09.2026); the type is not
 * imported here so the test lib stays free of app code — the seed validates
 * the structure when it writes it (`seedDemoDataset(ds, tenantId, { dataset })`).
 *
 * The dates are literal 2026 dates on purpose (Mo/So/holiday pattern); seed
 * it with `now = new Date(2026, 11, 31)`.
 */
// ---------------------------------------------------------------------------

function plantPart() {
  return { room: 'Stellungsraum S1', coordinationSectionNo: '9999.001.01', name: 'Anlageteil P1', type: 'Schiessanlage (300m)', builtAfter1985: false };
}

const E1 = { sonarmsId: 'E1', code: 'E1', egid: null, address: 'Testweg 1', municipality: 'Testdorf', type: 'facade', sensitivityLevel: 'II', east: 2600000, north: 1200000, mapX: 50, mapY: 50, sortOrder: 0 };
const E2 = { sonarmsId: 'E2', code: 'E2', egid: null, address: 'Testweg 9', municipality: 'Testdorf', type: 'facade', sensitivityLevel: 'III', east: 2600300, north: 1200100, mapX: 70, mapY: 40, sortOrder: 1 };

function wlr(point: string, source: string, lae: number, lafmax: number) {
  return [
    { point, source, timeGroup: 'day', lae, lafmax },
    { point, source, timeGroup: 'eve', lae, lafmax },
  ];
}

function usage(
  label: string,
  date: string,
  from: string,
  to: string,
  usageType: 'military' | 'civil',
  unit: string,
  positions: { combination: string; quantity: number; quantityUnit?: string }[],
  civilUsageKind?: 'field_shooting' | 'other',
) {
  return {
    room: 'Stellungsraum S1',
    unit,
    date,
    from,
    to,
    usageType,
    civilUsageKind: civilUsageKind ?? null,
    personCount: 10,
    recordedBy: `Test ${label}`,
    positions,
  };
}

export const TESTPLATZ_S_DATASET = {
  name: 'SLIM Testplatz S',
  identifier: 'slim-testplatz-s',
  description: 'Synthetischer Schiessplatz mit handgerechneten Soll-Werten (platz-s.md). Daten auf 2026 ausgelegt.',
  version: 1,
  users: [
    { username: 'fachspezialist@demo.ch', password: '1234', firstName: 'Fiona', lastName: 'Meier', role: 'slim_specialist' },
    { username: 'schiessplatz@demo.ch', password: '1234', firstName: 'Beat', lastName: 'Roth', role: 'slim_range_owner', areas: ['Testplatz S'] },
    { username: 'interessent@demo.ch', password: '1234', firstName: 'Nina', lastName: 'Huber', role: 'slim_interested' },
    { username: 'appadmin@demo.ch', password: '1234', firstName: 'Sven', lastName: 'Keller', role: 'slim_admin' },
  ],
  masterData: {
    categories: [
      { code: 'handguns', nameDe: 'Handfeuerwaffen', sortOrder: 0 },
      { code: 'artillery', nameDe: 'Artillerie / Sprengmittel', sortOrder: 1 },
    ],
    weapons: [
      { key: 'stgw90', nameDe: 'Stgw 90', category: 'handguns', annex7Category: 'a' },
      { key: 'pist75', nameDe: 'Pist 75', category: 'handguns', annex7Category: 'b' },
      { key: 'sprengladung', nameDe: 'Sprengladung', category: 'artillery', annex7Category: null },
    ],
    calibers: [
      { key: 'gp90', nameDe: '5.6 mm GP 90', quantityUnit: 'shots' },
      { key: 'pistpat41', nameDe: '9 mm Pist Pat 41', quantityUnit: 'shots' },
      { key: 'sprengstoff', nameDe: 'Sprengstoff', quantityUnit: 'kg' },
    ],
    combinations: [
      { key: 'stgw90', weapon: 'stgw90', caliber: 'gp90', nameDe: 'Stgw 90 – 5.6 mm', sonarmsId: 'Stgw90' },
      { key: 'pist75', weapon: 'pist75', caliber: 'pistpat41', nameDe: 'Pist 75 – 9 mm', sonarmsId: 'Pist75' },
      { key: 'sprengladung', weapon: 'sprengladung', caliber: 'sprengstoff', nameDe: 'Sprengladung', sonarmsId: 'Sprengladung' },
    ],
  },
  holidays: [
    { date: '2026-12-25', name: 'Weihnachten' },
    { date: '2026-12-24', from: '12:00', name: 'Heiligabend (Nachmittag)' },
  ],
  areas: [
    {
      name: 'Testplatz S',
      coordinationSectionNo: '9999.001',
      sectoralPlanNo: null,
      annex7Overall: false,
      rooms: [{ coordinationSectionNo: '9999.001.01', name: 'Stellungsraum S1', groupName: 'Stellungsräume', sortOrder: 0 }],
      roomCombinations: [
        { room: 'Stellungsraum S1', combination: 'stgw90', entryName: 'Stgw 90 – 5.6 mm' },
        { room: 'Stellungsraum S1', combination: 'pist75', entryName: 'Pist 75 – 9 mm' },
        { room: 'Stellungsraum S1', combination: 'sprengladung', entryName: 'Sprengladung (kg)' },
      ],
      quotas: [{ combination: 'stgw90', shotsPerYear: 2000, basis: 'Plangenehmigung Test' }],
      calculations: [
        {
          name: 'Ist-Aufnahme 2020',
          supplier: 'Testbüro',
          deliveredAt: '2020-06-01',
          states: [
            {
              externalId: 'S_Z1',
              name: 'Z1 Ist 2020',
              referenceYear: 2020,
              buildYearClass: 'before1985',
              isCurrent: true,
              isMgdm: true,
              plantParts: [plantPart()],
              sources: [
                { sourceId: 'Q1', plantPart: '9999.001.01', weaponSystem: 'Stgw90', a9: { shotsInside: 1000, shotsOutside: 100, year: 2020 }, a7: { halfDaysWork: 10, halfDaysSunday: 1, shotsWork: 1000, year: 2020 } },
              ],
              immissionPoints: [E1],
              wlr: [...wlr('E1', 'Q1', 80, 70)],
            },
          ],
        },
        {
          name: 'Sanierung 2024',
          supplier: 'Testbüro',
          deliveredAt: '2024-09-01',
          states: [
            {
              externalId: 'S_Z2',
              name: 'Z2 Sanierung 2024',
              referenceYear: 2024,
              buildYearClass: 'before1985',
              isCurrent: false,
              isMgdm: false,
              plantParts: [plantPart()],
              sources: [
                { sourceId: 'Q1a', plantPart: '9999.001.01', weaponSystem: 'Stgw90', a9: { shotsInside: 1000, shotsOutside: 100, year: 2024 }, a7: { halfDaysWork: 10, halfDaysSunday: 1, shotsWork: 1000, year: 2024 } },
                { sourceId: 'Q1b', plantPart: '9999.001.01', weaponSystem: 'Stgw90', a9: { shotsInside: 0, shotsOutside: 0, year: 2024 }, a7: { halfDaysWork: 0, halfDaysSunday: 0, shotsWork: 0, year: 2024 } },
              ],
              immissionPoints: [E1, E2],
              wlr: [...wlr('E1', 'Q1a', 74, 64), ...wlr('E1', 'Q1b', 74, 64), ...wlr('E2', 'Q1a', 80, 70), ...wlr('E2', 'Q1b', 80, 70)],
            },
            {
              externalId: 'S_Z3',
              name: 'Z3 Sanierung ohne Gewichte',
              referenceYear: 2024,
              buildYearClass: 'before1985',
              isCurrent: false,
              isMgdm: false,
              plantParts: [plantPart()],
              sources: [
                { sourceId: 'Q1a', plantPart: '9999.001.01', weaponSystem: 'Stgw90', a9: { shotsInside: 0, shotsOutside: 0, year: 2024 }, a7: null },
                { sourceId: 'Q1b', plantPart: '9999.001.01', weaponSystem: 'Stgw90', a9: { shotsInside: 0, shotsOutside: 0, year: 2024 }, a7: null },
              ],
              immissionPoints: [E1, E2],
              wlr: [...wlr('E1', 'Q1a', 74, 64), ...wlr('E1', 'Q1b', 74, 64), ...wlr('E2', 'Q1a', 80, 70), ...wlr('E2', 'Q1b', 80, 70)],
            },
          ],
        },
      ],
      usages: [
        usage('U1', '2026-03-02', '08:00', '11:00', 'military', 'Inf Kp 1', [{ combination: 'stgw90', quantity: 1200 }]),
        usage('U2', '2026-03-08', '09:00', '12:00', 'civil', 'Schützengesellschaft Testdorf', [{ combination: 'stgw90', quantity: 100 }], 'field_shooting'),
        usage('U3', '2026-03-09', '11:00', '13:00', 'civil', 'Schützengesellschaft Testdorf', [{ combination: 'stgw90', quantity: 10 }], 'other'),
        usage('U4', '2026-12-25', '08:00', '11:00', 'military', 'Inf Kp 1', [{ combination: 'stgw90', quantity: 100 }]),
        usage('U5', '2025-03-03', '08:00', '10:00', 'military', 'MP Kp 2', [{ combination: 'pist75', quantity: 50 }]),
        usage('U6', '2025-03-03', '14:00', '16:00', 'military', 'G Kp 3', [{ combination: 'sprengladung', quantity: 2.5, quantityUnit: 'kg' }]),
      ],
    },
  ],
};

/** Names as they appear after the seed. */
export const TESTPLATZ_S = {
  area: 'Testplatz S',
  coordinationSectionNo: '9999.001',
  room: 'Stellungsraum S1',
  states: { z1: 'Z1 Ist 2020', z2: 'Z2 Sanierung 2024', z3: 'Z3 Sanierung ohne Gewichte' },
  combinations: { stgw90: 'Stgw 90 – 5.6 mm', pist75: 'Pist 75 – 9 mm', sprengladung: 'Sprengladung' },
} as const;

/**
 * Independent reference values (platz-s.md, sections 4–6), full double
 * precision from the Python check of 12.09.2026 — NOT from the application.
 * Constant: 10·log10(52·5·12·3600) = 70.5045709478573.
 */
export const TESTPLATZ_S_REFERENCE = {
  /** Anhang 9, Zeitraum 2026: stgw90 inside 1 210 / outside 200. */
  z1E1: { lae1: 110.82785370316451, lae2: 108.01029995663981, lr9: 57.14939920103325, lr7: 38.1447779687543 },
  /** Same usages, state Z2 (WLR −6 dB, Q1b weight 0 → everything on Q1a). */
  z2E1: { lr9: 51.14939920103325, lr7: 32.1447779687543 },
  /** E2 exists only in Z2/Z3 (WLR 80 / 70, ES III). */
  z2E2: { lr9: 57.14939920103325 },
  /** Fehlerbild: holiday 25.12. not applied (1 310 / 100). */
  z1E1NoHoliday: { lae1: 111.17271295655763, lae2: 105.0, lr9: 56.60724277097697 },
  /** Fehlerbild: half-day boundary at 13:00 (U3 = ½ instead of ½ + ½). */
  z1E1Noon13: { lr7: 37.56485849897743 },
  /** All 2026 quantities ×10. */
  z1E1x10: { lr9: 67.14939920103325, lr7: 41.1447779687543 },
  /** Case 3, Anhang 7 with an extra civil usage on the holiday 2026-12-25 09:00–12:00, 100 shots (Sh = 2, M = 210). */
  case3Civil2512: { lr7: 41.41763828434432, lr7NoHoliday: 39.95635792756194 },
  /** Case 5: single military usage inside the workday, N shots (Lr = 24.4954290521427 + 10·log10(N)). */
  case5: { n3900: 60.406075122407685, n3985: 60.49971230946401, n3990: 60.50515800901018 },
  /** Case 2b: one civil usage of 100 shots alone (no U2/U3): 08:00–10:00 = ½ half-day, 08:00–10:15 = 1. */
  case2b: { lr7HalfDay: 28.989700043360187, lr7FullDay: 32.0 },
  /** Case 7: two civil usages in the same morning, 100 + 50 shots: 60 + 120 min = 1 half-day; 30 + 90 min = ½. */
  case7: { lr7: 32.528273777167044, lr7Half: 29.51797382052723, lr7CategoryAOnly: 28.989700043360187 },
  /**
   * Negative case: Z2 with both sources at weight 0 for the evening group —
   * the 200 shots outside cannot be distributed (O8), what remains is the
   * inside-only partial level (LAE1 − 6 dB), never a valid Ampel.
   */
  z2E1OutsideRefused: { partialLr9: 49.323282755307204 },
  /** Anhang 7 half-days of 2026 (category a): U2 Sunday 3 h = 1, U3 ½ + ½ = 1. */
  halfDays2026: { work: 1, sunday: 1 },
  operating2026: { stgw90: { inside: 1210, outside: 200, civil: 110 } },
} as const;

