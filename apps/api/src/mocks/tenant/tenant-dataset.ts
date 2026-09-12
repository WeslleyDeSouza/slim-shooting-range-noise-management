/**
 * The demo tenant as a dataset (llumi pattern): `tenant.mock.json` holds
 * the users, the tenant-wide master data (Waffenkategorien, Waffen, Kaliber,
 * Kombinationen), the Schiessplätze with their übergeordneten Stellungsräumen,
 * zulässigen Kombinationen, Kontingenten and Nutzungen (with positions), and
 * the Immissionsberechnungen with their Zustände — each state with its own
 * Anlageteile, Schusslinien (+ Quelldaten A9/A7), Immissionspunkte and
 * WLR-Pegel, exactly as B1 Kap. 10 separates the permanent reference
 * structure from the calculation states.
 *
 * Every date in it is a placeholder the seed rolls to the year it runs in:
 *
 *   {{year}} {{year+1}} {{year-1}}   the calendar year
 *   {{ym-N}}                          "YYYY-MM" of N months before this month
 *
 * Regenerate it with `tools/tenant-dataset.generator.ts`. The seed writes the
 * states through the same import service the FGDB upload (5.19) uses.
 */
import type { Annex7CategoryCode, QuantityUnit } from '../../modules/area/entities';
import type { BuildYearClassCode, ReceiverType, SensitivityLevelCode, TimeGroup } from '../../modules/calculation/entities';
import type { CivilUsageKind, UsageSource, UsageType } from '../../modules/usage/entities';
import datasetJson from './tenant.mock.json';

/** Role keys of `roles.mock-data.ts` (`SLIM_ROLE_BY_KEY`). */
export type DatasetRoleKey = 'admin' | 'slim_specialist' | 'slim_range_owner' | 'slim_interested' | 'slim_admin';

export interface DatasetUser {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Role assigned on seed; `admin` = galaxy admin role (everything). */
  role?: DatasetRoleKey;
  /** Area names for a «W/R-O» role (`slim_range_owner`); resolved against `areas`. */
  areas?: string[];
}

// ---------------------------------------------------------------------------
// Tenant-wide master data (B1 5.22–5.25, übergeordnet)
// ---------------------------------------------------------------------------

export interface DatasetWeaponCategory {
  code: string;
  nameDe: string;
  nameFr?: string | null;
  nameIt?: string | null;
  sortOrder?: number;
}

export interface DatasetWeaponType {
  /** Key other records refer to. */
  key: string;
  nameDe: string;
  nameFr?: string | null;
  nameIt?: string | null;
  /** `DatasetWeaponCategory.code`. */
  category: string;
  annex7Category: Annex7CategoryCode | null;
}

export interface DatasetCaliber {
  key: string;
  nameDe: string;
  nameFr?: string | null;
  nameIt?: string | null;
  alnNo?: string | null;
  sapNo?: string | null;
  quantityUnit?: QuantityUnit;
}

/** Kombination Waffe/Kaliber with its sonARMS weapon name (B1.7). */
export interface DatasetCombination {
  key: string;
  weapon: string;
  caliber: string;
  nameDe: string;
  nameFr?: string | null;
  nameIt?: string | null;
  /** «Name» of the sonARMS weapon database; the import matches source lines by it. */
  sonarmsId?: string | null;
}

export interface DatasetMasterData {
  categories: DatasetWeaponCategory[];
  weapons: DatasetWeaponType[];
  calibers: DatasetCaliber[];
  combinations: DatasetCombination[];
}

// ---------------------------------------------------------------------------
// Schiessplatz: permanent references and usages
// ---------------------------------------------------------------------------

export interface DatasetRoom {
  /** Koordinationsabschnitt-Nr. of the room, optional (5.15). */
  coordinationSectionNo: string | null;
  name: string;
  groupName: string | null;
  sortOrder?: number;
  /** false = historical room (kept for old usages and states). */
  enabled?: boolean;
}

/** Zulässige Kombination je Stellungsraum (5.17). */
export interface DatasetRoomCombination {
  room: string;
  combination: string;
  /** Waffenname für die Erfassung. */
  entryName: string;
}

/** Kontingent gemäss Plangenehmigung je Kombination (5.16). */
export interface DatasetQuota {
  combination: string;
  shotsPerYear: number;
  basis?: string | null;
}

export interface DatasetUsagePosition {
  combination: string;
  quantity: number;
  quantityUnit?: QuantityUnit;
}

export interface DatasetUsage {
  /** Room name. */
  room: string;
  unit: string;
  date: string;
  from: string;
  to: string;
  usageType: UsageType;
  civilUsageKind?: CivilUsageKind | null;
  personCount?: number | null;
  recordedBy: string;
  /** manual (default), elo (interface 6.x) or import (9.x). */
  source_kind?: UsageSource;
  externalId?: string | null;
  note?: string | null;
  positions: DatasetUsagePosition[];
}

// ---------------------------------------------------------------------------
// Immissionsberechnung → Zustände (hellblau, per state)
// ---------------------------------------------------------------------------

export interface DatasetPlantPart {
  /** Übergeordneter Stellungsraum (name) the Anlageteil maps to. */
  room: string;
  coordinationSectionNo: string;
  name: string;
  type: string;
  builtAfter1985: boolean;
  geometry?: string | null;
}

export interface DatasetSourceLine {
  /** QuellenID (unique per state). */
  sourceId: string;
  /** Anlageteil by its Koordinationsabschnittsnummer. */
  plantPart: string;
  /** sonARMS weapon name (matches `DatasetCombination.sonarmsId`). */
  weaponSystem: string;
  geometry?: string | null;
  /** Quelldaten Anhang 9: shots inside / outside the workday per year (weights, 7.5.3). */
  a9?: { shotsInside: number; shotsOutside: number; estimated?: boolean; year?: number | null } | null;
  /** Quelldaten Anhang 7: half-days and shots per year (weights, 7.5.2). */
  a7?: { halfDaysWork: number; halfDaysSunday: number; shotsWork: number; shotsSunday?: number | null; estimated?: boolean; year?: number | null } | null;
}

export interface DatasetImmissionPoint {
  sonarmsId: string;
  code: string;
  egid: string | null;
  egrid?: string | null;
  address: string;
  municipality: string | null;
  type: ReceiverType;
  sensitivityLevel: SensitivityLevelCode;
  east: number | null;
  north: number | null;
  height?: number | null;
  /** Position on the schematic map, percent. */
  mapX: number;
  mapY: number;
  sortOrder?: number;
}

/** One WLR line: levels of a source at a point for one Zeitgruppe. */
export interface DatasetWlr {
  /** `DatasetImmissionPoint.sonarmsId`. */
  point: string;
  /** `DatasetSourceLine.sourceId`. */
  source: string;
  timeGroup: TimeGroup;
  lae: number;
  lafmax: number;
}

export interface DatasetState {
  /** K1 ZustandID. */
  externalId: string;
  name: string;
  referenceYear: number;
  buildYearClass?: BuildYearClassCode;
  isCurrent: boolean;
  isMgdm: boolean;
  propagation?: { model: string; modelVersion: string; primarySurfaces?: string } | null;
  perimeter?: { name: string; spmNo: string; coordinationSectionNo: string } | null;
  plantParts: DatasetPlantPart[];
  sources: DatasetSourceLine[];
  immissionPoints: DatasetImmissionPoint[];
  wlr: DatasetWlr[];
}

export interface DatasetCalculation {
  name: string;
  supplier: string;
  deliveredAt: string;
  states: DatasetState[];
}

export interface DatasetArea {
  name: string;
  coordinationSectionNo: string;
  sectoralPlanNo: string | null;
  annex7Overall: boolean;
  rooms: DatasetRoom[];
  roomCombinations: DatasetRoomCombination[];
  quotas: DatasetQuota[];
  calculations: DatasetCalculation[];
  usages: DatasetUsage[];
}

export interface TenantDataset {
  /** `tenant.tenantName`. */
  name: string;
  /** `tenant.identifier`. */
  identifier: string;
  description: string;
  /** Bump it when the data changes; the seed then rewrites the demo. */
  version: number;
  users: DatasetUser[];
  masterData: DatasetMasterData;
  holidays?: DatasetHoliday[];
  areas: DatasetArea[];
}

export const DEFAULT_DATASET_KEY = 'SLIM Demo';

/** The file as it is on disk, every dataset by its key, dates still raw. */
export function loadRawDatasets(): Record<string, TenantDataset> {
  // resolveJsonModule is on: webpack and vitest both load the file natively.
  return datasetJson as unknown as Record<string, TenantDataset>;
}

/** One dataset with every date rolled to `now`. */
export function loadDataset(key = DEFAULT_DATASET_KEY, now = new Date()): TenantDataset {
  const raw = loadRawDatasets()[key];
  if (!raw) throw new Error(`Demo dataset "${key}" is not in tenant.mock.json`);
  return withDates(raw, now);
}

/**
 * Replace the date placeholders in every string of the value, however deep.
 * Numbers, booleans and nulls pass through untouched.
 */
export function withDates<T>(value: T, now: Date): T {
  if (typeof value === 'string') return fillPlaceholders(value, now) as T;
  if (Array.isArray(value)) return value.map((v) => withDates(v, now)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = withDates(v, now);
    }
    return out as T;
  }
  return value;
}

const PLACEHOLDER = /\{\{(year|ym)([+-]\d+)?\}\}/g;

/** "{{year}}-10-05" → "2026-10-05", "{{ym-11}}-10" → "2025-10-10". */
export function fillPlaceholders(text: string, now: Date): string {
  return text.replace(PLACEHOLDER, (_all, kind: string, delta?: string) => {
    const shift = delta ? parseInt(delta, 10) : 0;
    if (kind === 'year') return String(now.getFullYear() + shift);
    const d = new Date(now.getFullYear(), now.getMonth() + shift, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Feiertag am Standort (B1 7.4): whole day, or half with `from`/`to`; `area` null = every Schiessplatz. */
export interface DatasetHoliday {
  area?: string | null;
  date: string;
  from?: string | null;
  to?: string | null;
  name: string;
}
