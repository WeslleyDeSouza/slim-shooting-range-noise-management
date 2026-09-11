/**
 * Generates `apps/api/src/mocks/tenant/tenant.mock.json`, the «SLIM Demo»
 * dataset (llumi pattern): the demo Schiessplatz «1104.020 Geissalp» with
 * rooms, allowed weapons (= noise sources), receivers, two calculation
 * states and a year of usages, plus eight lighter areas for the overview.
 *
 * The sonARMS levels (WLR) are *tuned* so that the Beurteilungspegel the
 * assessment computes from the generated usages lands on the values of the
 * UI mocks (`_mocks/area/detail.index.html`): the per-source pattern is
 * plausible (howitzers louder than rifles), the per-receiver offset is
 * solved with the real `@slim/lsv` formulas. Dates are placeholders
 * (`{{year}}`), so the seed rolls them each year.
 *
 *   npx ts-node -T -O '{"module":"commonjs"}' tools/tenant-dataset.generator.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Annex7Category,
  Annex7Source,
  Annex9Source,
  annex7HalfDays,
  annex7Level,
  annex9Level,
  splitAnnex9,
} from '../libs/shared/lsv/src';

// ---------------------------------------------------------------------------
// Geissalp master data
// ---------------------------------------------------------------------------

const YEAR = 2026; // the year the placeholders resolve to while tuning
const Y = '{{year}}';
const Y1 = '{{year-1}}';

const ROOMS = [
  { no: '01', name: 'Zielrm / Stellungsrm Fendershuus, A 1 links', group: 'Zielräume / Stellungsräume', new: false },
  { no: '02', name: 'Zielrm / Stellungsrm Fendershuus, A 2 rechts', group: 'Zielräume / Stellungsräume', new: false },
  { no: '03', name: 'Zielrm / Stellungsrm Seelihuus, B 1', group: 'Zielräume / Stellungsräume', new: false },
  { no: '08', name: 'Zielraum Seeli, C 1', group: 'Zielräume / Stellungsräume', new: false },
  { no: '04', name: 'Stellungsraum A 3 auch Mw', group: 'Stellungsräume', new: false },
  { no: '07', name: 'Stellungsrm B 2', group: 'Stellungsräume', new: false },
  { no: '09', name: 'Stellungsrm C 2', group: 'Stellungsräume', new: false },
  { no: '05', name: 'Stellungsrm Mw Neuhaus, B 3', group: 'Stellungsräume', new: true },
  { no: '06', name: 'Stellungsrm Mw Salzmatt, C 3', group: 'Stellungsräume', new: true },
  { no: '10', name: 'Stellungsrm Mw Schönenboden, D', group: 'Stellungsräume', new: false },
  { no: '11', name: 'NGST Seeli C rechts', group: 'NGST', new: false },
  { no: '12', name: 'NGST Seeli C links', group: 'NGST', new: false },
  { no: '13', name: 'NGST Schönenboden D unten', group: 'NGST', new: false },
  { no: '14', name: 'NGST Schönenboden D oben', group: 'NGST', new: false },
];

type Cat = 'artillery' | 'air_defence' | 'handguns' | 'mortar';

/** Weapon types with a plausible single-shot level offset (dB vs. Stgw 90). */
const WEAPON_TYPES: Record<string, { weapon: string; caliber: string; name: string; category: Cat; a7: Annex7Category | null; offset: number; quota: number | null }> = {
  stgw90: { weapon: 'Stgw 90', caliber: '5.6 mm GP 90', name: 'Stgw 90 · 5.6 mm', category: 'handguns', a7: 'a', offset: 0, quota: 320000 },
  mg51: { weapon: 'Mg 51', caliber: '7.5 mm GP 11', name: 'Mg 51 · 7.5 mm', category: 'handguns', a7: 'a', offset: 2.5, quota: 60000 },
  pist75: { weapon: 'Pist 75', caliber: '9 mm Pist Pat 41', name: 'Pist 75 · 9 mm', category: 'handguns', a7: 'b', offset: -6, quota: 20000 },
  mw72: { weapon: 'Mw 72', caliber: '8.1 cm Spr Gr', name: '8.1 cm Mw 72', category: 'mortar', a7: null, offset: 16, quota: 1200 },
  mw87: { weapon: 'Mw 87', caliber: '8.1 cm Spr Gr', name: '8.1 cm Mw 87', category: 'mortar', a7: null, offset: 17, quota: 2500 },
  mw12: { weapon: 'Mw 12 cm', caliber: '12 cm Spr Gr', name: '12 cm Mw 74', category: 'mortar', a7: null, offset: 22, quota: 1000 },
  pzhb74: { weapon: 'Pz Hb 74', caliber: '15.5 cm Spr Gr', name: 'Pz Hb 74 · 15.5 cm', category: 'artillery', a7: null, offset: 28, quota: 1500 },
  pzhb79: { weapon: 'Pz Hb 79', caliber: '15.5 cm Spr Gr', name: 'Pz Hb 79 · 15.5 cm', category: 'artillery', a7: null, offset: 28, quota: 800 },
  flab: { weapon: 'Flab Kan 63/90', caliber: '35 mm', name: 'Flab Kan 63/90 · 35 mm', category: 'air_defence', a7: null, offset: 14, quota: 6000 },
  flzkan: { weapon: 'Flz Kan 92', caliber: 'Upat 92', name: 'Flz Kan 92 (Upat 92)', category: 'air_defence', a7: null, offset: 9, quota: 4000 },
};

/** Sources = allowed combinations (room no → weapon type key). */
const COMBOS: [string, string][] = [
  ['05', 'stgw90'], ['05', 'pzhb74'], ['05', 'flzkan'],
  ['06', 'stgw90'], ['06', 'mw87'], ['06', 'pzhb79'],
  ['07', 'mg51'], ['07', 'stgw90'], ['07', 'pist75'],
  ['08', 'mw12'], ['08', 'mg51'],
  ['04', 'mw72'],
  ['11', 'flab'],
  ['01', 'stgw90'], ['02', 'stgw90'],
  ['10', 'mw72'],
];

const SHORT: Record<string, string> = { '01': 'A1L', '02': 'A2R', '03': 'B1', '04': 'A3', '05': 'B3', '06': 'C3', '07': 'B2', '08': 'C1', '09': 'C2', '10': 'D', '11': 'NGST-CR', '12': 'NGST-CL', '13': 'NGST-DU', '14': 'NGST-DO' };

const sourceId = (no: string, type: string) => `${SHORT[no]}_${WEAPON_TYPES[type].weapon.replace(/[^A-Za-z0-9]/g, '')}`;
const roomName = (no: string) => ROOMS.find((r) => r.no === no)!.name;

/** Receivers with their mock positions (600 × 520 canvas → percent). */
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

interface Usage { room: string; source: string; unit: string; date: string; from: string; to: string; usageType: 'military' | 'civil'; shots: number; recordedBy: string; source_kind?: 'manual' | 'elo' | 'import' }

function iso(y: number, m: number, d: number) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function dow(y: number, m: number, d: number) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
/** Rounds shot counts to "human" numbers. */
const nice = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

function generateUsages(): { usages: Usage[]; tuning: Usage[] } {
  const usages: Usage[] = [];
  const combos = COMBOS.map(([no, type]) => ({ no, type, src: sourceId(no, type), t: WEAPON_TYPES[type] }));
  const milCombos = combos.filter((c) => c.type !== 'pist75');

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
      usages.push({ room: roomName(c.no), source: c.src, unit: pick(UNITS_MIL), date: iso(YEAR, m, d), from, to, usageType: 'military', shots, recordedBy: pick(RECORDERS) });
    }
  }
  // Two Saturday exercises and one Sunday (outside the workday).
  usages.push({ room: roomName('05'), source: sourceId('05', 'stgw90'), unit: 'Inf Bat 12', date: iso(YEAR, 3, 14), from: '08:00', to: '12:00', usageType: 'military', shots: 2400, recordedBy: 'Hptm Roth Beat' });
  usages.push({ room: roomName('06'), source: sourceId('06', 'mw87'), unit: 'Art Abt 10', date: iso(YEAR, 6, 6), from: '13:00', to: '17:00', usageType: 'military', shots: 96, recordedBy: 'Hptm Roth Beat' });
  usages.push({ room: roomName('07'), source: sourceId('07', 'mg51'), unit: 'Mech Bat 17', date: iso(YEAR, 9, 6), from: '09:00', to: '11:00', usageType: 'military', shots: 800, recordedBy: 'Wm Huber Nina' });

  // Civil: Schützenverein Geissalp on B 2, Stgw 90 and Pist 75 — Saturdays,
  // Wednesday evenings, some imported from ELO.
  for (let m = 3; m <= 10; m++) {
    for (const d of [4, 11, 18, 25]) {
      const day = dow(YEAR, m, d);
      // find the Saturday of that week
      const sat = d + ((6 - day + 7) % 7);
      if (sat > 28) continue;
      if (rnd() < 0.3) continue;
      const pistol = rnd() < 0.35;
      usages.push({
        room: roomName('07'), source: sourceId('07', pistol ? 'pist75' : 'stgw90'), unit: 'Schützenverein Geissalp',
        date: iso(YEAR, m, sat), from: pistol ? '13:30' : '08:30', to: pistol ? '16:30' : '11:30', usageType: 'civil',
        shots: nice((pistol ? 600 : 1800) * (0.7 + rnd() * 0.6), 50), recordedBy: 'ELO-Import', source_kind: 'elo',
      });
    }
    // Wednesday evening training
    const wed = 3 + ((3 - dow(YEAR, m, 3) + 7) % 7);
    usages.push({ room: roomName('07'), source: sourceId('07', 'stgw90'), unit: 'Schützenverein Geissalp', date: iso(YEAR, m, wed), from: '18:00', to: '20:00', usageType: 'civil', shots: 900, recordedBy: 'ELO-Import', source_kind: 'elo' });
  }

  usages.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
  const tuning = [...usages];

  // Last year, a few rows so the year select has something (not part of tuning).
  const lastYear: Usage[] = [
    { room: roomName('06'), source: sourceId('06', 'pzhb79'), unit: 'Art Abt 10', date: `${Y1}-10-14`, from: '08:00', to: '11:30', usageType: 'military', shots: 320, recordedBy: 'Hptm Roth Beat' },
    { room: roomName('05'), source: sourceId('05', 'stgw90'), unit: 'K1', date: `${Y1}-11-03`, from: '13:30', to: '17:00', usageType: 'military', shots: 2200, recordedBy: 'Lt Meier Fiona' },
    { room: roomName('07'), source: sourceId('07', 'stgw90'), unit: 'Schützenverein Geissalp', date: `${Y1}-09-20`, from: '08:30', to: '11:30', usageType: 'civil', shots: 1500, recordedBy: 'ELO-Import', source_kind: 'elo' },
  ];

  const placeholdered = usages.map((u) => ({ ...u, date: u.date.replace(String(YEAR), Y) }));
  return { usages: [...placeholdered, ...lastYear], tuning };
}

// ---------------------------------------------------------------------------
// WLR tuning
// ---------------------------------------------------------------------------

interface Wlr { receiver: string; source: string; laeDay: number; laeEve: number; lafmaxDay: number }

function tuneWlr(stateKey: string, usages: Usage[]): Wlr[] {
  const combos = COMBOS.map(([no, type]) => ({ no, type, src: sourceId(no, type), t: WEAPON_TYPES[type], new: ROOMS.find((r) => r.no === no)!.new }));
  const rows: Wlr[] = [];

  // Operating data per source (military → annex 9, civil → annex 7).
  const a9 = new Map<string, { inside: number; outside: number }>();
  const a7 = new Map<string, number>();
  const cat: (Usage & { category: Annex7Category })[] = [];
  for (const u of usages) {
    if (u.usageType === 'military') {
      const s = splitAnnex9({ date: u.date, from: u.from, to: u.to, shots: u.shots });
      const e = a9.get(u.source) ?? { inside: 0, outside: 0 };
      e.inside += s.inside; e.outside += s.outside; a9.set(u.source, e);
    } else {
      a7.set(u.source, (a7.get(u.source) ?? 0) + u.shots);
      const c = combos.find((x) => x.src === u.source)!;
      cat.push({ ...u, category: c.t.a7 as Annex7Category });
    }
  }
  const halfDays = annex7HalfDays(cat);

  // The sanitised state: new noise barriers around the new rooms → lower levels there.
  const sanitised = stateKey === 'saniert';

  for (const r of RECEIVERS) {
    const gains = ROOM_GAIN[r.code];
    // Raw levels: 78 dB(A) LAE for a Stgw 90 at ~1 km, corrected by weapon and room.
    const raw = combos.map((c) => {
      const gain = gains?.[c.no] ?? -6;
      const barrier = sanitised && c.new ? -4 : 0;
      const lae = 78 + c.t.offset + gain + barrier - 6 * Math.log10(r.dist);
      return { c, laeDay: lae, laeEve: lae + 0.2, lafmaxDay: lae + 9 };
    });

    if (r.type === 'reserve') continue; // no assessment for an empty parcel
    const target = TARGETS[stateKey][r.code];

    // Annex 9 offset: Lr is linear in a common offset on all LAE values.
    const a9Sources: Annex9Source[] = raw
      .filter((x) => a9.has(x.c.src))
      .map((x) => ({ sourceId: x.c.src, shotsDay: a9.get(x.c.src)!.inside, shotsEve: a9.get(x.c.src)!.outside, laeDay: x.laeDay, laeEve: x.laeEve }));
    const lr9 = annex9Level(a9Sources).lr;
    const off9 = target.a9 - lr9;

    // Annex 7 offset on LAFmax, independently.
    const a7Sources: Annex7Source[] = raw
      .filter((x) => a7.has(x.c.src) && x.c.t.a7)
      .map((x) => ({ sourceId: x.c.src, category: x.c.t.a7 as Annex7Category, shots: a7.get(x.c.src)!, lafmaxDay: x.lafmaxDay }));
    const lr7 = annex7Level(a7Sources, halfDays).lr;
    const off7 = target.a7 - lr7;

    for (const x of raw) {
      rows.push({
        receiver: r.code,
        source: x.c.src,
        laeDay: round1(x.laeDay + off9),
        laeEve: round1(x.laeEve + off9),
        lafmaxDay: round1(x.lafmaxDay + off7),
      });
    }

    // Verify with the rounded table.
    const check9 = annex9Level(a9Sources.map((s) => { const row = rows.find((w) => w.receiver === r.code && w.source === s.sourceId)!; return { ...s, laeDay: row.laeDay, laeEve: row.laeEve }; })).lr;
    const check7 = annex7Level(a7Sources.map((s) => { const row = rows.find((w) => w.receiver === r.code && w.source === s.sourceId)!; return { ...s, lafmaxDay: row.lafmaxDay }; }), halfDays).lr;
    console.log(`${stateKey} ${r.code}: A9 ${check9.toFixed(2)} (target ${target.a9})  A7 ${check7.toFixed(2)} (target ${target.a7})`);
  }
  return rows;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Other areas (overview only, light)
// ---------------------------------------------------------------------------

const OTHER_AREAS = [
  { name: 'Vérolliez', no: '1202.230', sp: 'SP-VS-12', quota: 'warn', noise: 'ok' },
  { name: 'Gehren', no: '2111.030', sp: null, quota: 'ok', noise: 'ok' },
  { name: 'Bière', no: '2201.010', sp: 'SP-VD-03', quota: 'over', noise: 'warn' },
  { name: 'Thun', no: '3101.020', sp: 'SP-BE-07', quota: 'ok', noise: 'over' },
  { name: 'Walenstadt', no: '4102.010', sp: null, quota: 'ok', noise: 'ok' },
  { name: 'Isone', no: '5101.040', sp: 'SP-TI-02', quota: 'warn', noise: 'ok' },
  { name: 'Bure', no: '6101.020', sp: null, quota: 'ok', noise: 'ok' },
  { name: 'Hinterrhein', no: '7102.010', sp: null, quota: 'none', noise: 'none' },
] as const;

function lightArea(a: (typeof OTHER_AREAS)[number]) {
  const rooms = [
    { coordinationSectionNo: `${a.no}.01`, name: 'Stellungsraum 1', groupName: 'Stellungsräume', builtAfter1985: false },
    { coordinationSectionNo: `${a.no}.02`, name: 'Stellungsraum 2', groupName: 'Stellungsräume', builtAfter1985: true },
  ];
  const weapons = [
    { room: 'Stellungsraum 1', ...pickType('stgw90'), sourceId: 'S1_Stgw90' },
    { room: 'Stellungsraum 1', ...pickType('mg51'), sourceId: 'S1_Mg51' },
    { room: 'Stellungsraum 2', ...pickType('mw87'), sourceId: 'S2_Mw87' },
  ];
  const usages = a.noise === 'none' ? [] : [
    { room: 'Stellungsraum 1', source: 'S1_Stgw90', unit: 'Inf Bat 5', date: `${Y}-04-14`, from: '08:00', to: '11:30', usageType: 'military', shots: 2400, recordedBy: 'Hptm Roth Beat' },
    { room: 'Stellungsraum 2', source: 'S2_Mw87', unit: 'Art Abt 4', date: `${Y}-05-19`, from: '13:30', to: '17:00', usageType: 'military', shots: 120, recordedBy: 'Lt Meier Fiona' },
    { room: 'Stellungsraum 1', source: 'S1_Mg51', unit: 'Mech Bat 3', date: `${Y}-08-25`, from: '19:00', to: '22:00', usageType: 'military', shots: 1500, recordedBy: 'Oblt Keller Sven' },
  ];
  return {
    name: a.name, coordinationSectionNo: a.no, sectoralPlanNo: a.sp, quotaStatus: a.quota, noiseStatus: a.noise, annex7Overall: false,
    rooms, weapons, receivers: [], calculations: [], usages,
  };
}

function pickType(key: string) {
  const t = WEAPON_TYPES[key];
  return { weaponName: t.name, weapon: t.weapon, caliber: t.caliber, category: t.category, annex7Category: t.a7, quota: t.quota };
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const { usages, tuning } = generateUsages();

const geissalp = {
  name: 'Geissalp',
  coordinationSectionNo: '1104.020',
  sectoralPlanNo: 'SP-BE-11',
  quotaStatus: 'warn',
  noiseStatus: 'over',
  annex7Overall: false,
  rooms: ROOMS.map((r, i) => ({ coordinationSectionNo: `1104.020.${r.no}`, name: r.name, groupName: r.group, builtAfter1985: r.new, sortOrder: i })),
  weapons: COMBOS.map(([no, type]) => ({ room: roomName(no), ...pickType(type), sourceId: sourceId(no, type) })),
  receivers: RECEIVERS.map((r, i) => ({
    code: r.code, egid: r.egid, address: r.address, municipality: 'Sigriswil', type: r.type, sensitivityLevel: r.es,
    east: 2618420 + Math.round((r.x - 300) * 3.2), north: 1176900 - Math.round((r.y - 260) * 3.2),
    mapX: round1((r.x / 600) * 100), mapY: round1((r.y / 520) * 100), sortOrder: i,
  })),
  calculations: [
    { name: 'Initiale Aufnahme Areal Geissalp', supplier: 'Empa', deliveredAt: '2019-05-08', referenceYear: 2019, buildYearClass: 'mixed', isCurrent: true, isMgdm: true, wlr: tuneWlr('initial', tuning) },
    { name: 'Sanierter Zustand SPM Geissalp', supplier: 'Empa', deliveredAt: '2025-03-25', referenceYear: 2025, buildYearClass: 'mixed', isCurrent: false, isMgdm: false, wlr: tuneWlr('saniert', tuning) },
  ],
  usages,
};

const dataset = {
  'SLIM Demo': {
    name: 'SLIM Demo',
    identifier: 'SLIM_DEMO',
    description: 'Demo-Mandant des Prototyps: neun Schiessplätze, davon 1104.020 Geissalp mit Stellungsräumen, Waffen, Empfangspunkten, zwei Berechnungszuständen und den Nutzungen des laufenden Jahres.',
    version: 3,
    // One account per role of B1 8.1.1 (roles.mock-data.ts); slim@demo.ch is the
    // galaxy admin the e2e suite and the setup wizard sign in with.
    users: [
      { username: 'slim@demo.ch', password: '1234', firstName: 'Hans', lastName: 'Muster', role: 'admin' },
      { username: 'fachspezialist@demo.ch', password: '1234', firstName: 'Fiona', lastName: 'Meier', role: 'slim_specialist' },
      { username: 'schiessplatz@demo.ch', password: '1234', firstName: 'Beat', lastName: 'Roth', role: 'slim_range_owner', areas: ['Geissalp', 'Thun'] },
      { username: 'interessent@demo.ch', password: '1234', firstName: 'Nina', lastName: 'Huber', role: 'slim_interested' },
      { username: 'appadmin@demo.ch', password: '1234', firstName: 'Sven', lastName: 'Keller', role: 'slim_admin' },
    ],
    areas: [geissalp, ...OTHER_AREAS.map(lightArea)],
  },
};

const out = join(__dirname, '..', 'apps', 'api', 'src', 'mocks', 'tenant', 'tenant.mock.json');
writeFileSync(out, JSON.stringify(dataset, null, 2) + '\n');
console.log(`wrote ${out}: ${geissalp.usages.length} usages, ${geissalp.weapons.length} sources, ${geissalp.calculations.reduce((n, c) => n + c.wlr.length, 0)} WLR rows`);
