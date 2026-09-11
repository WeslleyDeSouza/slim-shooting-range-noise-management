/**
 * Beilage B1.4 «Berechnung Beurteilungspegel sonARMS Demo» — the tender's
 * demo project, copied from the workbook sheets:
 *
 *  - `sonARMS_Demo_Day` / `_Eve`: WLR results per receiver × source, column
 *    `LAE` (I) and `LAFmax` (J), Zeitgruppe Tag / Abend.
 *  - `OpData_DemoProj_A9`: shots Tag / Abend per source.
 *  - `OpData_DemoProj_A7`: shots per source in Waffenkategorie a, half-days.
 *  - `sonARMS_Demo_A9X` / `_A7X`: the expected results (formulas) — our
 *    unit-test expectations.
 */
import { Annex7Category, Annex7HalfDays } from '../types';

export const B14_SOURCES = [
  'SH300-Links_Stgw90',
  'SH300-Links_Stgw57',
  'SH300-Rechts_Stgw90',
  'SH300-Rechts_Stgw57',
] as const;

export type B14Source = (typeof B14_SOURCES)[number];

/** OpData_DemoProj_A9: [Tag, Abend] shots per source. */
export const B14_OPDATA_A9: Record<B14Source, [number, number]> = {
  'SH300-Links_Stgw90': [100, 2],
  'SH300-Links_Stgw57': [20, 1],
  'SH300-Rechts_Stgw90': [500, 5],
  'SH300-Rechts_Stgw57': [888, 12],
};

/** OpData_DemoProj_A7: shots per source, all in Waffenkategorie a. */
export const B14_OPDATA_A7: Record<B14Source, number> = {
  'SH300-Links_Stgw90': 5000,
  'SH300-Links_Stgw57': 500,
  'SH300-Rechts_Stgw90': 4000,
  'SH300-Rechts_Stgw57': 1000,
};

export const B14_OPDATA_A7_CATEGORY: Annex7Category = 'a';

/** OpData_DemoProj_A7: WerkHalbtage / SonnHalbtage per category. */
export const B14_HALF_DAYS: Annex7HalfDays = {
  a: { work: 27, sunday: 1 },
  b: { work: 0, sunday: 0 },
  c: { work: 0, sunday: 0 },
  d: { work: 0, sunday: 0 },
  e: { work: 0, sunday: 0 },
  f: { work: 0, sunday: 0 },
};

export interface B14WlrRow {
  /** LAE Tag (sheet Day, column I). */
  laeDay: number;
  /** LAE Abend (sheet Eve, column I). */
  laeEve: number;
  /** LAFmax Tag (sheet Day, column J). */
  lafmaxDay: number;
}

/** WLR levels per receiver, in the order of `B14_SOURCES`. */
export const B14_WLR: Record<
  string,
  [B14WlrRow, B14WlrRow, B14WlrRow, B14WlrRow]
> = {
  E1: [
    { laeDay: 80.4, laeEve: 80.4, lafmaxDay: 89.2 },
    { laeDay: 82.4, laeEve: 82.4, lafmaxDay: 91.1 },
    { laeDay: 82.8, laeEve: 82.7, lafmaxDay: 91.5 },
    { laeDay: 85.2, laeEve: 85.2, lafmaxDay: 94 },
  ],
  E2: [
    { laeDay: 75.3, laeEve: 75.3, lafmaxDay: 83.9 },
    { laeDay: 77.4, laeEve: 77.4, lafmaxDay: 86 },
    { laeDay: 73.5, laeEve: 73.5, lafmaxDay: 81.9 },
    { laeDay: 76, laeEve: 76, lafmaxDay: 84.4 },
  ],
  E3: [
    { laeDay: 68.3, laeEve: 68.3, lafmaxDay: 77.1 },
    { laeDay: 70.3, laeEve: 70.3, lafmaxDay: 79.1 },
    { laeDay: 68.5, laeEve: 68.5, lafmaxDay: 77.3 },
    { laeDay: 71, laeEve: 71, lafmaxDay: 79.9 },
  ],
  E4a: [
    { laeDay: 63.3, laeEve: 63.3, lafmaxDay: 69.5 },
    { laeDay: 65.8, laeEve: 65.9, lafmaxDay: 72.7 },
    { laeDay: 63.7, laeEve: 63.7, lafmaxDay: 69.7 },
    { laeDay: 66.2, laeEve: 66.2, lafmaxDay: 72.9 },
  ],
  E4b: [
    { laeDay: 63.1, laeEve: 63.1, lafmaxDay: 69.1 },
    { laeDay: 65.5, laeEve: 65.5, lafmaxDay: 72.2 },
    { laeDay: 63.3, laeEve: 63.3, lafmaxDay: 68.9 },
    { laeDay: 65.6, laeEve: 65.6, lafmaxDay: 71.9 },
  ],
  E4c: [
    { laeDay: 63.3, laeEve: 63.3, lafmaxDay: 69.5 },
    { laeDay: 65.8, laeEve: 65.8, lafmaxDay: 72.7 },
    { laeDay: 63.4, laeEve: 63.4, lafmaxDay: 69 },
    { laeDay: 65.7, laeEve: 65.7, lafmaxDay: 72 },
  ],
  E5a: [
    { laeDay: 75.5, laeEve: 75.6, lafmaxDay: 83.1 },
    { laeDay: 77, laeEve: 77.1, lafmaxDay: 84.6 },
    { laeDay: 82, laeEve: 82, lafmaxDay: 90.7 },
    { laeDay: 85.4, laeEve: 85.4, lafmaxDay: 94.3 },
  ],
  E5b: [
    { laeDay: 76.3, laeEve: 76.5, lafmaxDay: 83.8 },
    { laeDay: 77.7, laeEve: 77.9, lafmaxDay: 85.4 },
    { laeDay: 83.6, laeEve: 83.6, lafmaxDay: 92.3 },
    { laeDay: 86.5, laeEve: 86.5, lafmaxDay: 95.3 },
  ],
  E6: [
    { laeDay: 62.4, laeEve: 62.5, lafmaxDay: 70.6 },
    { laeDay: 64.7, laeEve: 64.9, lafmaxDay: 73.1 },
    { laeDay: 75, laeEve: 75, lafmaxDay: 83.9 },
    { laeDay: 77.8, laeEve: 77.9, lafmaxDay: 86.7 },
  ],
  E7: [
    { laeDay: 52.2, laeEve: 54.2, lafmaxDay: 60.4 },
    { laeDay: 54.4, laeEve: 56.4, lafmaxDay: 62.7 },
    { laeDay: 53, laeEve: 53.1, lafmaxDay: 61.2 },
    { laeDay: 55.3, laeEve: 55.5, lafmaxDay: 63.7 },
  ],
  E8: [
    { laeDay: 36.1, laeEve: 36.4, lafmaxDay: 44.6 },
    { laeDay: 39, laeEve: 39.4, lafmaxDay: 47.8 },
    { laeDay: 36.4, laeEve: 36.7, lafmaxDay: 44.7 },
    { laeDay: 38.9, laeEve: 39.3, lafmaxDay: 47.5 },
  ],
  E9: [
    { laeDay: 77.5, laeEve: 78, lafmaxDay: 86.3 },
    { laeDay: 79.6, laeEve: 80, lafmaxDay: 88.3 },
    { laeDay: 74.8, laeEve: 75.5, lafmaxDay: 82.4 },
    { laeDay: 76.9, laeEve: 77.6, lafmaxDay: 84.6 },
  ],
};

export const B14_RECEIVERS = Object.keys(B14_WLR);

/**
 * Expected Anhang 9 results (sheet A9X): LAE1 / LAE2 to two decimals, Lr to
 * one. The sonARMS kernel output (sheet A9p) agrees everywhere except E8,
 * where the kernel drops the evening sources below its relevance threshold
 * (LAE2 = 0, Lr = 14.3); the tender's formula sheet gives 14.5 and that is
 * what the engine reproduces.
 */
export const B14_EXPECTED_A9: Record<
  string,
  { lae1: number; lae2: number; lr: number }
> = {
  E1: { lae1: 116.06, lae2: 102.24, lr: 60.7 },
  E2: { lae1: 107.08, lae2: 93.53, lr: 51.8 },
  E3: { lae1: 101.93, lae2: 88.24, lr: 46.6 },
  E4a: { lae1: 97.13, lae2: 83.45, lr: 41.8 },
  E4b: { lae1: 96.6, lae2: 82.92, lr: 41.3 },
  E4c: { lae1: 96.71, lae2: 83.03, lr: 41.4 },
  E5a: { lae1: 115.93, lae2: 102.06, lr: 60.6 },
  E5b: { lae1: 117.13, lae2: 103.23, lr: 61.8 },
  E6: { lae1: 108.42, lae2: 94.56, lr: 53.1 },
  E7: { lae1: 86.26, lae2: 72.95, lr: 31.0 },
  E8: { lae1: 69.84, lae2: 56.55, lr: 14.5 },
  E9: { lae1: 108.2, lae2: 95.39, lr: 52.9 },
};

/**
 * Expected Anhang 7 results (sheets A7X / A7p): Li(a) to two decimals, Lr to
 * one. E8 is 28.0 as the kernel prints it; the Excel sheet sums the 0 dB
 * cells of the empty categories and shows 28.1.
 */
export const B14_EXPECTED_A7: Record<string, { li: number; lr: number }> = {
  E1: { li: 90.92, lr: 73.8 },
  E2: { li: 83.45, lr: 66.3 },
  E3: { li: 77.64, lr: 60.5 },
  E4a: { li: 70.23, lr: 53.1 },
  E4b: { li: 69.59, lr: 52.4 },
  E4c: { li: 69.85, lr: 52.7 },
  E5a: { li: 89.11, lr: 71.9 },
  E5b: { li: 90.42, lr: 73.3 },
  E6: { li: 81.6, lr: 64.4 },
  E7: { li: 61.26, lr: 44.1 },
  E8: { li: 45.21, lr: 28.0 },
  E9: { li: 85.17, lr: 68.0 },
};
