/**
 * Shared types of the LSV calculation engine (Beilage B1, Kapitel 7; B1.4).
 * Dependency-free on purpose: the API (assessment, simulation) and the app
 * consume this lib alike.
 */

/** sonARMS / B1.4 marker for "no energy" (empty weight list, no shots). */
export const LSV_EMPTY_LEVEL = -99;

/** Source (Quelle) with the Anhang 9 operating data and WLR levels. */
export interface Annex9Source {
  /** sonARMS QuellenID, e.g. `SH300-Links_Stgw90`. */
  sourceId: string;
  /** Shots inside the workday (Mo–Fr 07:00–19:00) per year. */
  shotsDay: number;
  /** Shots outside the workday per year. */
  shotsEve: number;
  /** LAE from WLR_Day at the receiver, dB. */
  laeDay: number;
  /** LAE from WLR_Eve at the receiver, dB. */
  laeEve: number;
}

/** Unrounded Anhang 9 result for one receiver (B1.4 sheet A9X). */
export interface Annex9Result {
  /** LAE1 (day), `LSV_EMPTY_LEVEL` when the day has no shots. */
  lae1: number;
  /** LAE2 (evening incl. +5 dB), `LSV_EMPTY_LEVEL` when the evening has no shots. */
  lae2: number;
  /** Beurteilungspegel Lr, `LSV_EMPTY_LEVEL` when both periods are empty. */
  lr: number;
}

/** Waffenkategorien a–f of Anhang 7 LSV. */
export type Annex7Category = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export const ANNEX7_CATEGORIES: readonly Annex7Category[] = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
];

/** Source with the Anhang 7 operating data and the LAFmax level. */
export interface Annex7Source {
  sourceId: string;
  category: Annex7Category;
  /** Shots per year of this source. */
  shots: number;
  /** LAFmax from WLR_Day at the receiver, dB. */
  lafmaxDay: number;
}

/** Schiesshalbtage: workday (Mo–Sa) and Sunday/holiday halves. */
export interface HalfDays {
  work: number;
  sunday: number;
}

export type Annex7HalfDays = Record<Annex7Category, HalfDays>;

/** Unrounded Anhang 7 result for one receiver (B1.4 sheet A7X). */
export interface Annex7Result {
  /** Li per category, `LSV_EMPTY_LEVEL` without shots. */
  li: Record<Annex7Category, number>;
  /** Lri per category, `LSV_EMPTY_LEVEL` without shots. */
  lri: Record<Annex7Category, number>;
  /** Beurteilungspegel Lr = ESM(Lri_a … Lri_f). */
  lr: number;
}

/** One Schiessplatz-Nutzung as the operating-data step sees it (B1 7.4). */
export interface UsageSlot {
  /** ISO calendar day `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, 24 h. */
  from: string;
  /** `HH:mm`, 24 h, after `from`, same day. */
  to: string;
  shots: number;
}

/** Shots inside / outside the Anhang 9 workday window. */
export interface WorkdaySplit {
  inside: number;
  outside: number;
}

/**
 * One public holiday of the site. A plain date is a whole day; `from` / `to`
 * (`HH:mm`) bound a half holiday, e.g. `{ date: '2026-12-24', from: '12:00' }`
 * for a free afternoon (B1 7.4: halbe Feiertage anteilig).
 */
export interface HolidayEntry {
  date: string;
  from?: string;
  to?: string;
}

export interface CalendarOptions {
  /** Public holidays valid at the site (local, B1 S. 71): whole or half days. */
  holidays?: readonly (string | HolidayEntry)[];
}

/**
 * Nutzungskategorien of a usage (B1 Tabelle 2). Anhang 9 assesses all of
 * them; Anhang 7 normally only Zivil and SAT, all when the Schiessplatz has
 * the flag «Gesamtbeurteilung nach Anhang 7».
 */
export const USAGE_CATEGORIES = ['military', 'civil', 'blue_light', 'sat'] as const;
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];
export const ANNEX7_USAGE_CATEGORIES: readonly UsageCategory[] = ['civil', 'sat'];

/** Whether a usage of this category enters the Anhang 7 assessment (B1 Tabelle 2). */
export function countsForAnnex7(category: UsageCategory, annex7Overall: boolean): boolean {
  return annex7Overall || ANNEX7_USAGE_CATEGORIES.includes(category);
}

/** Empfindlichkeitsstufe (Art. 43 LSV). */
export type SensitivityLevel = 'I' | 'II' | 'III' | 'IV';

export type LsvAnnex = 7 | 9;

/** Planungswert, Immissionsgrenzwert, Alarmwert in dB. */
export interface LimitSet {
  pw: number;
  igw: number;
  aw: number;
}

/** Baujahr der Anlageteile (B1 5.18, 7.7). */
export type BuildYearClass = 'before1985' | 'after1985' | 'mixed';

export type LimitKind = 'pw' | 'igw';

/** Traffic light (B1 5.10): `none` = no level / no basis. */
export type NoiseState = 'ok' | 'warn' | 'over' | 'none';

export type QuotaState = NoiseState;
