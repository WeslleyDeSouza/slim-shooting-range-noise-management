/**
 * The demo tenant as a dataset (llumi pattern): `tenant.mock.json` holds
 * the users, the Schiessplätze with their Stellungsräume, allowed weapons
 * (= noise sources), Empfangspunkte, calculation states with their sonARMS
 * levels and the year's Schiessplatz-Nutzungen. Every date in it is a
 * placeholder the seed rolls to the year it runs in:
 *
 *   {{year}} {{year+1}} {{year-1}}   the calendar year
 *   {{ym-N}}                          "YYYY-MM" of N months before this month
 *
 * That is what lets the same file fill the demo next year and look right,
 * and what the setup wizard (setup/11-seed-data) reads to know what to
 * expect. Regenerate it with `tools/tenant-dataset.generator.ts`.
 */
import type { AreaStatus, Annex7CategoryCode, WeaponCategory } from '../../modules/area/entities';
import type { BuildYearClassCode, ReceiverType, SensitivityLevelCode } from '../../modules/calculation/entities';
import type { UsageSource, UsageType } from '../../modules/usage/entities';
import datasetJson from './tenant.mock.json';

/** Role keys of `roles.mock-data.ts` (`SLIM_ROLE_BY_KEY`). */
export type DatasetRoleKey = 'admin' | 'specialist' | 'range_owner' | 'interested' | 'app_admin';

export interface DatasetUser {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Role assigned on seed; `admin` = galaxy admin role (everything). */
  role?: DatasetRoleKey;
  /** Area names for a «W/R-O» role (`range_owner`); resolved against `areas`. */
  areas?: string[];
}

export interface DatasetRoom {
  /** Koordinationsabschnitt-Nr. of the room, optional (5.15). */
  coordinationSectionNo: string | null;
  name: string;
  groupName: string | null;
  builtAfter1985: boolean;
  sortOrder?: number;
}

/** Allowed room × weapon combination = one source of the noise model (5.17). */
export interface DatasetWeapon {
  /** Room name; resolved against `rooms`. */
  room: string;
  weaponName: string;
  weapon: string;
  caliber: string;
  category: WeaponCategory;
  annex7Category: Annex7CategoryCode | null;
  /** sonARMS QuellenID, unique per area. */
  sourceId: string;
  /** Kontingent gemäss Plangenehmigung, shots per year. */
  quota: number | null;
}

export interface DatasetReceiver {
  code: string;
  egid: string | null;
  address: string;
  municipality: string | null;
  type: ReceiverType;
  sensitivityLevel: SensitivityLevelCode;
  east: number | null;
  north: number | null;
  /** Position on the schematic map, percent. */
  mapX: number;
  mapY: number;
  sortOrder?: number;
}

/** One WLR line: levels of a source at a receiver. */
export interface DatasetWlr {
  /** Receiver code. */
  receiver: string;
  /** Source id (`DatasetWeapon.sourceId`). */
  source: string;
  laeDay: number;
  laeEve: number;
  lafmaxDay: number;
}

export interface DatasetCalculation {
  name: string;
  supplier: string;
  deliveredAt: string;
  referenceYear: number;
  buildYearClass: BuildYearClassCode;
  isCurrent: boolean;
  isMgdm: boolean;
  wlr: DatasetWlr[];
}

export interface DatasetUsage {
  /** Room name. */
  room: string;
  /** `DatasetWeapon.sourceId` of the combination shot. */
  source: string;
  unit: string;
  date: string;
  from: string;
  to: string;
  usageType: UsageType;
  shots: number;
  recordedBy: string;
  /** manual (default), elo (interface 6.x) or import (9.x). */
  source_kind?: UsageSource;
  note?: string | null;
}

export interface DatasetArea {
  name: string;
  coordinationSectionNo: string;
  sectoralPlanNo: string | null;
  quotaStatus: AreaStatus;
  noiseStatus: AreaStatus;
  annex7Overall: boolean;
  rooms: DatasetRoom[];
  weapons: DatasetWeapon[];
  receivers: DatasetReceiver[];
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
