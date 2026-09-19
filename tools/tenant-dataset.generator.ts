/**
 * Generates `apps/api/src/mocks/tenant/tenant.mock.json`, the «SLIM Demo»
 * dataset (llumi pattern), in the structure of B1 Kapitel 10:
 *
 *  - tenant-wide master data: Waffenkategorien, Waffen, Kaliber and the
 *    permanent Kombinationen Waffe/Kaliber with their sonARMS weapon names;
 *  - the demo Schiessplatz «1104.020 Geissalp» with übergeordneten
 *    Stellungsräumen, zulässigen Kombinationen je Stellungsraum, Kontingenten
 *    and a year of Nutzungen (each with 1..n positions);
 *  - one Immissionsberechnung with two Zustände, each owning its own
 *    Anlageteile, Schusslinien (+ Quelldaten A9/A7 as distribution weights),
 *    Immissionspunkte and WLR-Pegel per Zeitgruppe. The sanitised state
 *    spreads one combination over two Schusslinien (60/40) so the
 *    distribution of B1 7.5 is exercised;
 *  - eight lighter areas for the overview (no states).
 *
 * The sonARMS levels (WLR) are *tuned* so that the Beurteilungspegel the
 * assessment computes from the generated usages lands on the values of the
 * UI mocks (`_mocks/area/detail.index.html`): the per-source pattern is
 * plausible (howitzers louder than rifles), the per-receiver offset is
 * solved with the real `@slim/lsv` formulas. Dates are placeholders
 * (`{{year}}`), so the seed rolls them each year.
 *
 *   npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node10","esModuleInterop":true,"ignoreDeprecations":"6.0"}' tools/tenant-dataset.generator.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Annex7Category,
  Annex7Source,
  Annex9Source,
  annex7HalfDays,
  annex7Level,
  countsForAnnex7,
  annex9Level,
  splitAnnex9,
  UsageCategory,
} from '../libs/shared/lsv/src';

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

const YEAR = 2026; // the year the placeholders resolve to while tuning
const Y = '{{year}}';
const Y1 = '{{year-1}}';
const AREA_NO = '1104.020';
const SPM_NO = '02218';

const CATEGORIES = [
  { code: 'handguns', nameDe: 'Handfeuerwaffen', nameFr: 'Armes légères', nameIt: 'Armi leggere', sortOrder: 0 },
  { code: 'mortar', nameDe: 'Minenwerfer', nameFr: 'Lance-mines', nameIt: 'Lanciamine', sortOrder: 1 },
  { code: 'artillery', nameDe: 'Artillerie', nameFr: 'Artillerie', nameIt: 'Artiglieria', sortOrder: 2 },
  { code: 'air_defence', nameDe: 'Fliegerabwehr', nameFr: 'Défense aérienne', nameIt: 'Difesa aerea', sortOrder: 3 },
];

const CALIBERS = [
  { key: 'gp90', nameDe: '5.6 mm GP 90', nameFr: '5,6 mm cart 90', nameIt: '5,6 mm cart 90', alnNo: '594-7005', sapNo: '2000.7073', quantityUnit: 'shots' },
  { key: 'gp11', nameDe: '7.5 mm GP 11', nameFr: '7,5 mm cart 11', nameIt: '7,5 mm cart 11', alnNo: '550-1100', sapNo: '2410.0011', quantityUnit: 'shots' },
  { key: 'pistpat41', nameDe: '9 mm Pist Pat 41', nameFr: '9 mm cart pist 41', nameIt: '9 mm cart pist 41', alnNo: '511-0041', sapNo: '2400.0041', quantityUnit: 'shots' },
  { key: 'sprgr81', nameDe: '8.1 cm Spr Gr', nameFr: '8,1 cm ob expl', nameIt: '8,1 cm gran espl', alnNo: '681-2001', sapNo: '2530.8101', quantityUnit: 'shots' },
  { key: 'sprgr12', nameDe: '12 cm Spr Gr', nameFr: '12 cm ob expl', nameIt: '12 cm gran espl', alnNo: '712-2001', sapNo: '2530.1201', quantityUnit: 'shots' },
  { key: 'sprgr155', nameDe: '15.5 cm Spr Gr', nameFr: '15,5 cm ob expl', nameIt: '15,5 cm gran espl', alnNo: '755-2001', sapNo: '2530.1551', quantityUnit: 'shots' },
  { key: 'mm35', nameDe: '35 mm', nameFr: '35 mm', nameIt: '35 mm', alnNo: '535-3001', sapNo: '2520.0035', quantityUnit: 'shots' },
  { key: 'upat92', nameDe: 'Upat 92', nameFr: 'Cart ex 92', nameIt: 'Cart es 92', alnNo: '520-9201', sapNo: '2520.0092', quantityUnit: 'shots' },
  { key: 'sprengstoff', nameDe: 'Sprengstoff (kg)', nameFr: 'Explosif (kg)', nameIt: 'Esplosivo (kg)', alnNo: '800-0001', sapNo: '2600.0001', quantityUnit: 'kg' },
] as const;

type Cat = 'artillery' | 'air_defence' | 'handguns' | 'mortar';

/** Weapon types with a plausible single-shot level offset (dB vs. Stgw 90). */
const WEAPON_TYPES: Record<string, { weapon: string; caliber: string; name: string; category: Cat; a7: Annex7Category | null; offset: number; quota: number | null; sonarms: string }> = {
  stgw90: { weapon: 'Stgw 90', caliber: 'gp90', name: 'Stgw 90 · 5.6 mm', category: 'handguns', a7: 'a', offset: 0, quota: 320000, sonarms: 'Stgw90' },
  mg51: { weapon: 'Mg 51', caliber: 'gp11', name: 'Mg 51 · 7.5 mm', category: 'handguns', a7: 'a', offset: 2.5, quota: 60000, sonarms: 'Mg51' },
  pist75: { weapon: 'Pist 75', caliber: 'pistpat41', name: 'Pist 75 · 9 mm', category: 'handguns', a7: 'b', offset: -6, quota: 20000, sonarms: 'Pist75' },
  mw72: { weapon: 'Mw 72', caliber: 'sprgr81', name: '8.1 cm Mw 72', category: 'mortar', a7: null, offset: 16, quota: 1200, sonarms: 'Mw72' },
  mw87: { weapon: 'Mw 87', caliber: 'sprgr81', name: '8.1 cm Mw 87', category: 'mortar', a7: null, offset: 17, quota: 2500, sonarms: 'Mw87' },
  mw12: { weapon: 'Mw 12 cm', caliber: 'sprgr12', name: '12 cm Mw 74', category: 'mortar', a7: null, offset: 22, quota: 1000, sonarms: 'Mw12cm' },
  pzhb74: { weapon: 'Pz Hb 74', caliber: 'sprgr155', name: 'Pz Hb 74 · 15.5 cm', category: 'artillery', a7: null, offset: 28, quota: 1500, sonarms: 'PzHb74' },
  pzhb79: { weapon: 'Pz Hb 79', caliber: 'sprgr155', name: 'Pz Hb 79 · 15.5 cm', category: 'artillery', a7: null, offset: 28, quota: 800, sonarms: 'PzHb79' },
  flab: { weapon: 'Flab Kan 63/90', caliber: 'mm35', name: 'Flab Kan 63/90 · 35 mm', category: 'air_defence', a7: null, offset: 14, quota: 6000, sonarms: 'FlabKan6390' },
  flzkan: { weapon: 'Flz Kan 92', caliber: 'upat92', name: 'Flz Kan 92 (Upat 92)', category: 'air_defence', a7: null, offset: 9, quota: 4000, sonarms: 'FlzKan92' },
  /** Demolition charge: quantity in kg (decimal), one source line like any other weapon. */
  sprengladung: { weapon: 'Sprengladung', caliber: 'sprengstoff', name: 'Sprengladung · kg', category: 'artillery', a7: null, offset: 30, quota: null, sonarms: 'Sprengladung' },
};

/** Feiertage of the demo (B1 7.4): national for every Schiessplatz, one half day, one cantonal for Geissalp (BE). */
const HOLIDAYS = [
  { date: '01-01', name: 'Neujahr' },
  { date: '08-01', name: 'Nationalfeiertag' },
  { date: '12-25', name: 'Weihnachten' },
  { date: '12-26', name: 'Stephanstag' },
  { date: '12-24', from: '12:00', name: 'Heiligabend (Nachmittag)' },
  { area: 'Geissalp', date: '01-02', name: 'Berchtoldstag (BE)' },
];
/** The calendar the tuning uses — the same holidays the seed writes. */
const CALENDAR = { holidays: HOLIDAYS.map((h) => (h.from ? { date: `${YEAR}-${h.date}`, from: h.from } : `${YEAR}-${h.date}`)) };

/**
 * Stellungsräume of Geissalp. Two of them carry no Koordinationsabschnitts-Nr.
 * (`no: null`) — B1 5.15 «In einigen Ausnahmefällen existieren Stellungsräume,
 * die keine Koordinationsabschnitts-Nr. aufweisen»; the Anlageteile of the
 * states keep their own number (`partNo`) and are matched by room name.
 */
const ROOMS = [
  { no: '01', name: 'Zielrm / Stellungsrm Fendershuus, A 1 links', group: 'Zielräume / Stellungsräume', new: false, type: 'Schiessanlage (300m)' },
  { no: '02', name: 'Zielrm / Stellungsrm Fendershuus, A 2 rechts', group: 'Zielräume / Stellungsräume', new: false, type: 'Schiessanlage (300m)' },
  { no: '03', name: 'Zielrm / Stellungsrm Seelihuus, B 1', group: 'Zielräume / Stellungsräume', new: false, type: 'Schiessanlage (300m)' },
  { no: '08', name: 'Zielraum Seeli, C 1', group: 'Zielräume / Stellungsräume', new: false, type: 'Bogenschuss-Schiessanlage (Minenwerfer / Mörser / Panzerhaubize, etc.)' },
  { no: '04', name: 'Stellungsraum A 3 auch Mw', group: 'Stellungsräume', new: false, type: 'Bogenschuss-Schiessanlage (Minenwerfer / Mörser / Panzerhaubize, etc.)' },
  { no: '07', name: 'Stellungsrm B 2', group: 'Stellungsräume', new: false, type: 'Schiessanlage (300m)' },
  { no: '09', name: 'Stellungsrm C 2', group: 'Stellungsräume', new: false, type: 'Gefechtsschiessplatz' },
  { no: '05', name: 'Stellungsrm Mw Neuhaus, B 3', group: 'Stellungsräume', new: true, type: 'Bogenschuss-Schiessanlage (Minenwerfer / Mörser / Panzerhaubize, etc.)' },
  { no: '06', name: 'Stellungsrm Mw Salzmatt, C 3', group: 'Stellungsräume', new: true, type: 'Bogenschuss-Schiessanlage (Minenwerfer / Mörser / Panzerhaubize, etc.)' },
  { no: '10', name: 'Stellungsrm Mw Schönenboden, D', group: 'Stellungsräume', new: false, type: 'Bogenschuss-Schiessanlage (Minenwerfer / Mörser / Panzerhaubize, etc.)', noNumber: true },
  { no: '11', name: 'NGST Seeli C rechts', group: 'NGST', new: false, type: 'Gefechtsschiessplatz' },
  { no: '12', name: 'NGST Seeli C links', group: 'NGST', new: false, type: 'Gefechtsschiessplatz' },
  { no: '13', name: 'NGST Schönenboden D unten', group: 'NGST', new: false, type: 'Gefechtsschiessplatz' },
  { no: '14', name: 'NGST Schönenboden D oben', group: 'NGST', new: false, type: 'Gefechtsschiessplatz', noNumber: true },
];

/** Zulässige Kombinationen (room no → weapon type key). */
const COMBOS: [string, string][] = [
  ['05', 'stgw90'], ['05', 'pzhb74'], ['05', 'flzkan'],
  ['06', 'stgw90'], ['06', 'mw87'], ['06', 'pzhb79'],
  ['07', 'mg51'], ['07', 'stgw90'], ['07', 'pist75'],
  ['08', 'mw12'], ['08', 'mg51'],
  ['04', 'mw72'],
  ['11', 'flab'],
  ['01', 'stgw90'], ['02', 'stgw90'],
  ['10', 'mw72'],
  ['09', 'sprengladung'],
];

const SHORT: Record<string, string> = { '01': 'A1L', '02': 'A2R', '03': 'B1', '04': 'A3', '05': 'B3', '06': 'C3', '07': 'B2', '08': 'C1', '09': 'C2', '10': 'D', '11': 'NGST-CR', '12': 'NGST-CL', '13': 'NGST-DU', '14': 'NGST-DO' };

const roomName = (no: string) => ROOMS.find((r) => r.no === no)!.name;
const roomNo = (no: string) => `${AREA_NO}.${no}`;
/** QuellenID after the B1.2 10.3 convention: Anlageteil_Waffentyp_m_KoordNr_Nr. */
const sourceIdOf = (no: string, type: string, n: number) => `${SHORT[no]}_${WEAPON_TYPES[type].sonarms}_m_${AREA_NO}_${n}`;

/** Immissionspunkte with their mock positions (600 × 520 canvas → percent). */
const RECEIVERS = [
  { code: 'E1', egid: '2314077', address: 'Laberhusstrasse 4, 3654 Gunten', type: 'facade', es: 'II', x: 225, y: 255, dist: 1.0 },
  { code: 'E2', egid: '2314102', address: 'Lattigenweg 12, 3654 Gunten', type: 'facade', es: 'II', x: 430, y: 262, dist: 1.4 },
  { code: 'E3', egid: '2314118', address: 'Lattigen 3, 3654 Gunten', type: 'facade', es: 'II', x: 522, y: 92, dist: 1.2 },
  { code: 'E4', egid: '2314121', address: 'Lattigen 7, 3654 Gunten', type: 'facade', es: 'III', x: 555, y: 70, dist: 1.6 },
  { code: 'E5', egid: '2314060', address: 'Laberhus 1, 3654 Gunten', type: 'facade', es: 'II', x: 130, y: 455, dist: 0.9 },
  { code: 'E6', egid: null, address: 'Unbebaute Parzelle 1187', type: 'reserve', es: 'II', x: 66, y: 225, dist: 1.1 },
] as const;

/** Target Beurteilungspegel per state (from the detail mock), Annex 9 and 7. */
const TARGETS: Record<string, Record<string, { a9: number; a7: number }>> = {
  initial: { E1: { a9: 60.8, a7: 49.1 }, E2: { a9: 54.2, a7: 44.0 }, E3: { a9: 58.6, a7: 47.5 }, E4: { a9: 52.3, a7: 41.8 }, E5: { a9: 61.9, a7: 50.4 } },
  saniert: { E1: { a9: 56.4, a7: 46.6 }, E2: { a9: 51.9, a7: 42.3 }, E3: { a9: 57.2, a7: 45.9 }, E4: { a9: 50.1, a7: 40.2 }, E5: { a9: 60.7, a7: 49.2 } },
};

/** Room-to-receiver geometry factor (dB): which rooms a receiver mainly hears. */
const ROOM_GAIN: Record<string, Record<string, number>> = {
  E1: { '05': 0, '06': -2, '07': -4, '08': -7, '04': -3, '11': -6, '01': -5, '02': -5, '10': -8 },
  E2: { '05': -5, '06': -3, '07': 0, '08': -2, '04': -6, '11': -3, '01': -7, '02': -6, '10': -4 },
  E3: { '05': -6, '06': -4, '07': 0, '08': 0, '04': -8, '11': -1, '01': -9, '02': -8, '10': -2 },
  E4: { '05': -8, '06': -6, '07': -1, '08': -1, '04': -9, '11': -2, '01': -10, '02': -9, '10': -2 },
  E5: { '05': 0, '06': -1, '07': -7, '08': -9, '04': -2, '11': -8, '01': -3, '02': -4, '10': -9 },
};

// ---------------------------------------------------------------------------
// Usages of the year (deterministic pseudo-random)
// ---------------------------------------------------------------------------

let seed = 20260911;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];

const UNITS_MIL = ['K1', 'Art Abt 10', 'Flab Abt 32', 'Inf Bat 12', 'Mech Bat 17', 'Pz Bat 12', 'Geb Inf Bat 29'];
const RECORDERS = ['Lt Meier Fiona', 'Hptm Roth Beat', 'Oblt Keller Sven', 'Wm Huber Nina', 'Four Bühler Marc'];
const SLOTS_MIL = [['08:00', '11:30'], ['13:30', '17:00'], ['08:00', '16:00'], ['09:00', '12:00'], ['14:00', '17:30']];
const SLOTS_NIGHT = [['19:00', '22:00'], ['18:00', '21:30']];

interface Position { combination: string; quantity: number; quantityUnit?: 'shots' | 'kg' }
interface Usage {
  room: string; unit: string; date: string; from: string; to: string; usageType: UsageCategory;
  civilUsageKind?: 'obligatory' | 'field_shooting' | 'other' | null; personCount?: number | null;
  recordedBy: string; source_kind?: 'manual' | 'elo' | 'import'; externalId?: string | null; positions: Position[];
}

function iso(y: number, m: number, d: number) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function dow(y: number, m: number, d: number) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
/** Rounds shot counts to "human" numbers. */
const nice = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

function generateUsages(): { usages: Usage[]; tuning: Usage[] } {
  const usages: Usage[] = [];
  const combos = COMBOS.map(([no, type]) => ({ no, type, t: WEAPON_TYPES[type] }));
  const milCombos = combos.filter((c) => c.type !== 'pist75' && c.type !== 'sprengladung');
  let elo = 0;
  const eloId = () => `ELO-${YEAR}-1104-${String(++elo).padStart(5, '0')}`;

  // Military weeks: Jan–Nov, roughly two shooting days a week, Mon–Fri.
  for (let m = 1; m <= 11; m++) {
    const days = [2, 4, 9, 11, 16, 18, 23, 25];
    for (const d of days) {
      if (rnd() < 0.35) continue;
      if (dow(YEAR, m, d) === 0 || dow(YEAR, m, d) === 6) continue;
      const c = pick(milCombos);
      const night = rnd() < 0.12;
      const [from, to] = night ? pick(SLOTS_NIGHT) : pick(SLOTS_MIL);
      const base = c.t.category === 'handguns' ? 1800 : c.t.category === 'air_defence' ? 320 : c.t.category === 'mortar' ? 60 : 36;
      const shots = nice(base * (0.6 + rnd() * 0.9), c.t.category === 'handguns' ? 50 : 4);
      const positions: Position[] = [{ combination: c.type, quantity: shots }];
      // Every fifth exercise brings a second weapon of the same room (n positions per Nutzung, B1 6.1.3).
      const second = combos.find((x) => x.no === c.no && x.type !== c.type && x.type !== 'pist75' && x.type !== 'sprengladung');
      if (second && rnd() < 0.2) {
        const base2 = second.t.category === 'handguns' ? 900 : second.t.category === 'air_defence' ? 160 : second.t.category === 'mortar' ? 30 : 18;
        positions.push({ combination: second.type, quantity: nice(base2 * (0.6 + rnd() * 0.9), second.t.category === 'handguns' ? 50 : 4) });
      }
      usages.push({ room: roomName(c.no), unit: pick(UNITS_MIL), date: iso(YEAR, m, d), from, to, usageType: 'military', personCount: 20 + Math.floor(rnd() * 80), recordedBy: pick(RECORDERS), positions });
    }
  }
  // Two Saturday exercises and one Sunday (outside the workday).
  usages.push({ room: roomName('05'), unit: 'Inf Bat 12', date: iso(YEAR, 3, 14), from: '08:00', to: '12:00', usageType: 'military', personCount: 120, recordedBy: 'Hptm Roth Beat', positions: [{ combination: 'stgw90', quantity: 2400 }] });
  usages.push({ room: roomName('06'), unit: 'Art Abt 10', date: iso(YEAR, 6, 6), from: '13:00', to: '17:00', usageType: 'military', personCount: 40, recordedBy: 'Hptm Roth Beat', positions: [{ combination: 'mw87', quantity: 96 }] });
  usages.push({ room: roomName('07'), unit: 'Mech Bat 17', date: iso(YEAR, 9, 6), from: '09:00', to: '11:00', usageType: 'military', personCount: 60, recordedBy: 'Wm Huber Nina', positions: [{ combination: 'mg51', quantity: 800 }] });
  // One demolition exercise with explosive in kg (decimal quantity, B1 6.2).
  usages.push({ room: roomName('09'), unit: 'Geb Inf Bat 29', date: iso(YEAR, 5, 20), from: '09:00', to: '11:30', usageType: 'military', personCount: 25, recordedBy: 'Oblt Keller Sven', positions: [{ combination: 'sprengladung', quantity: 12.5, quantityUnit: 'kg' }] });

  // Civil: Schützenverein Geissalp on B 2, Stgw 90 and Pist 75 — Saturdays,
  // Wednesday evenings, reported through ELO.
  for (let m = 3; m <= 10; m++) {
    for (const d of [4, 11, 18, 25]) {
      const day = dow(YEAR, m, d);
      const sat = d + ((6 - day + 7) % 7);
      if (sat > 28) continue;
      if (rnd() < 0.3) continue;
      const pistol = rnd() < 0.35;
      const positions: Position[] = pistol
        ? [{ combination: 'pist75', quantity: nice(600 * (0.7 + rnd() * 0.6), 50) }]
        : [{ combination: 'stgw90', quantity: nice(1800 * (0.7 + rnd() * 0.6), 50) }];
      // Field shooting days: both weapons in one Nutzung.
      if (!pistol && rnd() < 0.3) positions.push({ combination: 'pist75', quantity: nice(400 * (0.7 + rnd() * 0.6), 50) });
      usages.push({
        room: roomName('07'), unit: 'Schützenverein Geissalp',
        date: iso(YEAR, m, sat), from: pistol ? '13:30' : '08:30', to: pistol ? '16:30' : '11:30', usageType: 'civil',
        civilUsageKind: positions.length > 1 ? 'field_shooting' : 'obligatory', personCount: 12 + Math.floor(rnd() * 30),
        recordedBy: 'ELO-Import', source_kind: 'elo', externalId: eloId(), positions,
      });
    }
    // Wednesday evening training
    const wed = 3 + ((3 - dow(YEAR, m, 3) + 7) % 7);
    usages.push({ room: roomName('07'), unit: 'Schützenverein Geissalp', date: iso(YEAR, m, wed), from: '18:00', to: '20:00', usageType: 'civil', civilUsageKind: 'other', personCount: 10, recordedBy: 'ELO-Import', source_kind: 'elo', externalId: eloId(), positions: [{ combination: 'stgw90', quantity: 900 }] });
  }

  // Blaulicht (Kantonspolizei, weekday mornings on B 2 with the Pist 75) and
  // SAT (Jungschützenkurs, Saturday mornings on B 2 with the Stgw 90) — the two
  // further Nutzungskategorien of B1 Tabelle 2 (annex 9: all; annex 7: SAT).
  for (const [m, d] of [[4, 8], [6, 10], [9, 9]] as const) {
    usages.push({ room: roomName('07'), unit: 'Kantonspolizei Freiburg', date: iso(YEAR, m, d), from: '08:00', to: '11:00', usageType: 'blue_light', personCount: 15, recordedBy: 'ELO-Import', source_kind: 'elo', externalId: eloId(), positions: [{ combination: 'pist75', quantity: 750 }] });
  }
  for (const [m, d] of [[5, 9], [8, 22]] as const) {
    usages.push({ room: roomName('07'), unit: 'Jungschützenkurs Sense', date: iso(YEAR, m, d), from: '08:30', to: '11:30', usageType: 'sat', personCount: 18, recordedBy: 'ELO-Import', source_kind: 'elo', externalId: eloId(), positions: [{ combination: 'stgw90', quantity: 1200 }] });
  }

  usages.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
  const tuning = [...usages];

  // Last year, a few rows so the year select has something (not part of tuning).
  const lastYear: Usage[] = [
    { room: roomName('06'), unit: 'Art Abt 10', date: `${Y1}-10-14`, from: '08:00', to: '11:30', usageType: 'military', personCount: 40, recordedBy: 'Hptm Roth Beat', positions: [{ combination: 'pzhb79', quantity: 320 }] },
    { room: roomName('05'), unit: 'K1', date: `${Y1}-11-03`, from: '13:30', to: '17:00', usageType: 'military', personCount: 90, recordedBy: 'Lt Meier Fiona', positions: [{ combination: 'stgw90', quantity: 2200 }] },
    { room: roomName('07'), unit: 'Schützenverein Geissalp', date: `${Y1}-09-20`, from: '08:30', to: '11:30', usageType: 'civil', civilUsageKind: 'obligatory', personCount: 22, recordedBy: 'ELO-Import', source_kind: 'elo', externalId: `ELO-${YEAR - 1}-1104-00001`, positions: [{ combination: 'stgw90', quantity: 1500 }] },
  ];

  const placeholdered = usages.map((u) => ({ ...u, date: u.date.replace(String(YEAR), Y) }));
  return { usages: [...placeholdered, ...lastYear], tuning };
}

// ---------------------------------------------------------------------------
// States: Anlageteile, Schusslinien with weights, points, tuned WLR
// ---------------------------------------------------------------------------

interface SourceDef { sourceId: string; no: string; type: string; weight: number }
interface Wlr { point: string; source: string; timeGroup: 'day' | 'eve'; lae: number; lafmax: number }

/** Sources of a state: one Schusslinie per combination; the sanitised state splits B 3 × Stgw 90 in two (60/40). */
function sourcesOf(stateKey: string): SourceDef[] {
  const out: SourceDef[] = [];
  let n = 0;
  for (const [no, type] of COMBOS) {
    n++;
    if (stateKey === 'saniert' && no === '05' && type === 'stgw90') {
      out.push({ sourceId: sourceIdOf(no, type, n) + 'a', no, type, weight: 0.6 });
      out.push({ sourceId: sourceIdOf(no, type, n) + 'b', no, type, weight: 0.4 });
    } else {
      out.push({ sourceId: sourceIdOf(no, type, n), no, type, weight: 1 });
    }
  }
  return out;
}

/** Operating data per (room, combination) from the tuning usages, exactly as the assessment derives them. */
function operatingData(usages: Usage[]) {
  const a9 = new Map<string, { inside: number; outside: number }>();
  const a7 = new Map<string, number>();
  const cat: { date: string; from: string; to: string; shots: number; category: Annex7Category }[] = [];
  for (const u of usages) {
    for (const p of u.positions) {
      const key = `${u.room}|${p.combination}`;
      const s = splitAnnex9({ date: u.date, from: u.from, to: u.to, shots: p.quantity }, CALENDAR);
      const e = a9.get(key) ?? { inside: 0, outside: 0 };
      e.inside += s.inside; e.outside += s.outside; a9.set(key, e);
      if (countsForAnnex7(u.usageType, false) && WEAPON_TYPES[p.combination].a7) {
        a7.set(key, (a7.get(key) ?? 0) + p.quantity);
        cat.push({ date: u.date, from: u.from, to: u.to, shots: p.quantity, category: WEAPON_TYPES[p.combination].a7 as Annex7Category });
      }
    }
  }
  return { a9, a7, halfDays: annex7HalfDays(cat, CALENDAR) };
}

function buildState(stateKey: string, usages: Usage[]) {
  const sources = sourcesOf(stateKey);
  const { a9, a7, halfDays } = operatingData(usages);
  const sanitised = stateKey === 'saniert';

  // Quelldaten of the model = the operating data it was computed with, per source (weights).
  const sourceRows = sources.map((s) => {
    const key = `${roomName(s.no)}|${s.type}`;
    const op = a9.get(key) ?? { inside: 0, outside: 0 };
    const civil = a7.get(key);
    const t = WEAPON_TYPES[s.type];
    return {
      sourceId: s.sourceId,
      plantPart: roomNo(s.no),
      weaponSystem: t.sonarms,
      a9: { shotsInside: Math.round(op.inside * s.weight), shotsOutside: Math.round(op.outside * s.weight), year: 2019 },
      a7: civil && t.a7
        ? { halfDaysWork: halfDays[t.a7].work, halfDaysSunday: halfDays[t.a7].sunday, shotsWork: Math.round(civil * s.weight), shotsSunday: 0, year: 2019 }
        : null,
    };
  });

  const wlr: Wlr[] = [];
  for (const r of RECEIVERS) {
    const gains = ROOM_GAIN[r.code];
    // Raw levels: 78 dB(A) LAE for a Stgw 90 at ~1 km, corrected by weapon and room.
    const raw = sources.map((s) => {
      const t = WEAPON_TYPES[s.type];
      const gain = gains?.[s.no] ?? -6;
      const barrier = sanitised && ROOMS.find((x) => x.no === s.no)!.new ? -4 : 0;
      const lae = 78 + t.offset + gain + barrier - 6 * Math.log10(r.dist);
      return { s, laeDay: lae, laeEve: lae + 0.2, lafmaxDay: lae + 9 };
    });
    if (r.type === 'reserve') continue; // no assessment for an empty parcel
    const target = TARGETS[stateKey][r.code];

    // Shots per source = shots of the combination × weight (B1 7.5).
    const a9Sources: Annex9Source[] = raw
      .filter((x) => a9.has(`${roomName(x.s.no)}|${x.s.type}`))
      .map((x) => {
        const op = a9.get(`${roomName(x.s.no)}|${x.s.type}`)!;
        return { sourceId: x.s.sourceId, shotsDay: op.inside * x.s.weight, shotsEve: op.outside * x.s.weight, laeDay: x.laeDay, laeEve: x.laeEve };
      });
    const off9 = target.a9 - annex9Level(a9Sources).lr;

    const a7Sources: Annex7Source[] = raw
      .filter((x) => a7.has(`${roomName(x.s.no)}|${x.s.type}`) && WEAPON_TYPES[x.s.type].a7)
      .map((x) => ({ sourceId: x.s.sourceId, category: WEAPON_TYPES[x.s.type].a7 as Annex7Category, shots: a7.get(`${roomName(x.s.no)}|${x.s.type}`)! * x.s.weight, lafmaxDay: x.lafmaxDay }));
    const off7 = target.a7 - annex7Level(a7Sources, halfDays).lr;

    for (const x of raw) {
      wlr.push({ point: r.code, source: x.s.sourceId, timeGroup: 'day', lae: round1(x.laeDay + off9), lafmax: round1(x.lafmaxDay + off7) });
      wlr.push({ point: r.code, source: x.s.sourceId, timeGroup: 'eve', lae: round1(x.laeEve + off9), lafmax: round1(x.lafmaxDay + off7 + 0.2) });
    }

    // Verify with the rounded table.
    const lvl = (src: string, tg: 'day' | 'eve') => wlr.find((w) => w.point === r.code && w.source === src && w.timeGroup === tg)!;
    const check9 = annex9Level(a9Sources.map((s) => ({ ...s, laeDay: lvl(s.sourceId, 'day').lae, laeEve: lvl(s.sourceId, 'eve').lae }))).lr;
    const check7 = annex7Level(a7Sources.map((s) => ({ ...s, lafmaxDay: lvl(s.sourceId, 'day').lafmax })), halfDays).lr;
    console.log(`${stateKey} ${r.code}: A9 ${check9.toFixed(2)} (target ${target.a9})  A7 ${check7.toFixed(2)} (target ${target.a7})`);
  }

  return {
    externalId: `${SPM_NO}_${sanitised ? 2 : 1}`,
    name: sanitised ? 'Sanierter Zustand SPM Geissalp' : 'Initiale Aufnahme Areal Geissalp',
    referenceYear: sanitised ? 2025 : 2019,
    isCurrent: !sanitised,
    isMgdm: !sanitised,
    propagation: { model: 'sonX', modelVersion: sanitised ? 'sonARMS Kernel 4.0.0' : 'sonARMS Kernel 3.2.1', primarySurfaces: 'Vektordaten Kataster 25' },
    perimeter: { name: 'Geissalp', spmNo: SPM_NO, coordinationSectionNo: AREA_NO },
    plantParts: ROOMS.map((r) => ({ room: r.name, coordinationSectionNo: roomNo(r.no), name: r.name, type: r.type, builtAfter1985: r.new })),
    sources: sourceRows,
    immissionPoints: RECEIVERS.map((r, i) => ({
      sonarmsId: r.code, code: r.code, egid: r.egid, egrid: r.egid ? null : 'CH 1187 nicht in eGRIS', address: r.address, municipality: 'Sigriswil', type: r.type,
      sensitivityLevel: r.es, east: 2618420 + Math.round((r.x - 300) * 3.2), north: 1176900 - Math.round((r.y - 260) * 3.2), height: 4,
      mapX: round1((r.x / 600) * 100), mapY: round1((r.y / 520) * 100), sortOrder: i,
    })),
    wlr,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Other areas (overview only, light)
// ---------------------------------------------------------------------------

const OTHER_AREAS = [
  { name: 'Vérolliez', no: '1202.230', sp: 'SP-VS-12', usages: true, master: { classification: 'problematic', recalculationState: 'completed', remediationProjectState: 'design', spmState: 'completed', noiseRemediationState: 'assessed', projectState: 'ongoing', planningApproval: 'Militärische Plangenehmigung vom 04.07.2019' } },
  { name: 'Gehren', no: '2111.030', sp: null, usages: true, master: { classification: 'unproblematic', recalculationState: 'not_required', remediationProjectState: 'not_started', spmState: 'open', noiseRemediationState: 'assessed', projectState: 'not_started', planningApproval: null } },
  { name: 'Bière', no: '2201.010', sp: 'SP-VD-03', usages: true, master: { classification: 'remediation_needed', recalculationState: 'in_progress', remediationProjectState: 'implementation', spmState: 'in_progress', noiseRemediationState: 'reassessment_needed', projectState: 'ongoing', planningApproval: 'Militärische Plangenehmigung vom 21.11.2018' } },
  { name: 'Thun', no: '3101.020', sp: 'SP-BE-07', usages: true, master: { classification: 'problematic', recalculationState: 'completed', remediationProjectState: 'completed', spmState: 'completed', noiseRemediationState: 'remediated', projectState: 'completed', planningApproval: 'Militärische Plangenehmigung vom 15.03.2016' } },
  { name: 'Walenstadt', no: '4102.010', sp: null, usages: true, master: { classification: 'unproblematic', recalculationState: 'not_required', remediationProjectState: 'not_started', spmState: 'open', noiseRemediationState: 'assessed', projectState: 'not_started', planningApproval: 'Sanierungsbericht 2018 (ohne Plangenehmigung)' } },
  { name: 'Isone', no: '5101.040', sp: 'SP-TI-02', usages: true, master: { classification: 'problematic', recalculationState: 'in_progress', remediationProjectState: 'concept', spmState: 'in_progress', noiseRemediationState: 'reassessment_needed', projectState: 'ongoing', planningApproval: 'Militärische Plangenehmigung vom 09.09.2021' } },
  { name: 'Bure', no: '6101.020', sp: null, usages: true, master: { classification: 'unproblematic', recalculationState: 'completed', remediationProjectState: 'not_started', spmState: 'completed', noiseRemediationState: 'assessed', projectState: 'not_started', planningApproval: 'Militärische Plangenehmigung vom 30.01.2020' } },
  { name: 'Hinterrhein', no: '7102.010', sp: null, usages: false, enabled: false, master: { classification: null, recalculationState: null, remediationProjectState: null, spmState: null, noiseRemediationState: null, projectState: null, planningApproval: null } },
] as const;

function lightArea(a: (typeof OTHER_AREAS)[number]) {
  const rooms = [
    { coordinationSectionNo: `${a.no}.01`, name: 'Stellungsraum 1', groupName: 'Stellungsräume' },
    { coordinationSectionNo: `${a.no}.02`, name: 'Stellungsraum 2', groupName: 'Stellungsräume' },
  ];
  const roomCombinations = [
    { room: 'Stellungsraum 1', combination: 'stgw90', entryName: WEAPON_TYPES.stgw90.name },
    { room: 'Stellungsraum 1', combination: 'mg51', entryName: WEAPON_TYPES.mg51.name },
    { room: 'Stellungsraum 2', combination: 'mw87', entryName: WEAPON_TYPES.mw87.name },
  ];
  const quotas = [
    { combination: 'stgw90', shotsPerYear: 120000, basis: 'Plangenehmigung 2018' },
    { combination: 'mg51', shotsPerYear: 20000, basis: 'Plangenehmigung 2018' },
    { combination: 'mw87', shotsPerYear: 800, basis: 'Plangenehmigung 2018' },
  ];
  const usages = a.usages
    ? [
        { room: 'Stellungsraum 1', unit: 'Inf Bat 5', date: `${Y}-04-14`, from: '08:00', to: '11:30', usageType: 'military', personCount: 80, recordedBy: 'Hptm Roth Beat', positions: [{ combination: 'stgw90', quantity: 2400 }] },
        { room: 'Stellungsraum 2', unit: 'Art Abt 4', date: `${Y}-05-19`, from: '13:30', to: '17:00', usageType: 'military', personCount: 30, recordedBy: 'Lt Meier Fiona', positions: [{ combination: 'mw87', quantity: 120 }] },
        { room: 'Stellungsraum 1', unit: 'Mech Bat 3', date: `${Y}-08-25`, from: '19:00', to: '22:00', usageType: 'military', personCount: 45, recordedBy: 'Oblt Keller Sven', positions: [{ combination: 'mg51', quantity: 1500 }] },
      ]
    : [];
  return {
    name: a.name, coordinationSectionNo: a.no, sectoralPlanNo: a.sp, annex7Overall: false,
    enabled: 'enabled' in a ? a.enabled : true,
    ...a.master,
    rooms, roomCombinations, quotas, calculations: [], usages,
  };
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const { usages, tuning } = generateUsages();

const usedTypes = [...new Set(COMBOS.map(([, t]) => t))];

const masterData = {
  categories: CATEGORIES,
  weapons: Object.entries(WEAPON_TYPES).map(([key, t]) => ({ key, nameDe: t.weapon, nameFr: t.weapon, nameIt: t.weapon, category: t.category, annex7Category: t.a7 })),
  calibers: CALIBERS.map((c) => ({ ...c })),
  combinations: Object.entries(WEAPON_TYPES).map(([key, t]) => ({ key, weapon: key, caliber: t.caliber, nameDe: t.name, nameFr: t.name, nameIt: t.name, sonarmsId: t.sonarms })),
};

const geissalp = {
  name: 'Geissalp',
  coordinationSectionNo: AREA_NO,
  sectoralPlanNo: 'SP-BE-11',
  annex7Overall: false,
  // Stammdaten (B1 5.16, Abbildung 26/27)
  classification: 'unproblematic',
  recalculationState: 'in_progress',
  remediationProjectState: 'concept',
  spmState: 'completed',
  noiseRemediationState: 'reassessment_needed',
  projectState: 'not_started',
  planningApproval: 'Militärische Plangenehmigung vom 13.02.2023',
  rooms: ROOMS.map((r, i) => ({ coordinationSectionNo: 'noNumber' in r && r.noNumber ? null : roomNo(r.no), name: r.name, groupName: r.group, sortOrder: i })),
  roomCombinations: COMBOS.map(([no, type]) => ({ room: roomName(no), combination: type, entryName: WEAPON_TYPES[type].name })),
  quotas: usedTypes.filter((t) => WEAPON_TYPES[t].quota).map((t) => ({ combination: t, shotsPerYear: WEAPON_TYPES[t].quota as number, basis: 'Plangenehmigung 2019' })),
  calculations: [
    {
      name: 'Lärmsanierungsprojekt Geissalp (LBK_02218)',
      supplier: 'Empa',
      deliveredAt: '2025-03-25',
      states: [buildState('initial', tuning), buildState('saniert', tuning)],
    },
  ],
  usages,
};

const dataset = {
  'SLIM Demo': {
    name: 'SLIM Demo',
    identifier: 'SLIM_DEMO',
    description: 'Demo-Mandant des Prototyps: Stammdaten Waffen/Kaliber/Kombinationen, neun Schiessplätze, davon 1104.020 Geissalp mit Stellungsräumen, zulässigen Kombinationen, Kontingenten, Immissionspunkten, einer Immissionsberechnung mit zwei Zuständen und den Nutzungen des laufenden Jahres.',
    version: 6,
    // One account per role of B1 8.1.1 (roles.mock-data.ts); slim@demo.ch is the
    // galaxy admin the e2e suite and the setup wizard sign in with.
    users: [
      { username: 'slim@demo.ch', password: '1234', firstName: 'Hans', lastName: 'Muster', role: 'admin' },
      { username: 'fachspezialist@demo.ch', password: '1234', firstName: 'Fiona', lastName: 'Meier', role: 'slim_specialist' },
      { username: 'schiessplatz@demo.ch', password: '1234', firstName: 'Beat', lastName: 'Roth', role: 'slim_range_owner', areas: ['Geissalp', 'Thun'] },
      { username: 'interessent@demo.ch', password: '1234', firstName: 'Nina', lastName: 'Huber', role: 'slim_interested' },
      { username: 'appadmin@demo.ch', password: '1234', firstName: 'Sven', lastName: 'Keller', role: 'slim_admin' },
    ],
    masterData,
    // Feiertage (B1 7.4), the same calendar the WLR tuning used.
    holidays: HOLIDAYS.map((h) => ({ ...h, date: `${Y}-${h.date}` })),
    areas: [geissalp, ...OTHER_AREAS.map(lightArea)],
  },
};

const out = join(__dirname, '..', 'apps', 'api', 'src', 'mocks', 'tenant', 'tenant.mock.json');
writeFileSync(out, JSON.stringify(dataset, null, 2) + '\n');
console.log(`wrote ${out}: ${geissalp.usages.length} usages, ${geissalp.roomCombinations.length} room combinations, ${geissalp.calculations[0].states.map((s) => `${s.sources.length} sources / ${s.wlr.length} WLR rows`).join(' + ')}`);
