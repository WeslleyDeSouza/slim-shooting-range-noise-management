import { annex7Level } from './annex7';
import {
  B14_EXPECTED_A7,
  B14_HALF_DAYS,
  B14_OPDATA_A7,
  B14_OPDATA_A7_CATEGORY,
  B14_RECEIVERS,
  B14_SOURCES,
  B14_WLR,
} from './fixtures/b14-demo.fixture';
import { roundDb } from './levels';
import { Annex7HalfDays, Annex7Source, LSV_EMPTY_LEVEL } from './types';

function sourcesOf(receiver: string): Annex7Source[] {
  return B14_SOURCES.map((sourceId, i) => ({
    sourceId,
    category: B14_OPDATA_A7_CATEGORY,
    shots: B14_OPDATA_A7[sourceId],
    lafmaxDay: B14_WLR[receiver][i].lafmaxDay,
  }));
}

const NO_HALF_DAYS: Annex7HalfDays = {
  a: { work: 0, sunday: 0 },
  b: { work: 0, sunday: 0 },
  c: { work: 0, sunday: 0 },
  d: { work: 0, sunday: 0 },
  e: { work: 0, sunday: 0 },
  f: { work: 0, sunday: 0 },
};

describe('annex7Level — Beilage B1.4 demo project (sheets A7X / A7p)', () => {
  it.each(B14_RECEIVERS)('reproduces receiver %s', (receiver) => {
    const expected = B14_EXPECTED_A7[receiver];
    const result = annex7Level(sourcesOf(receiver), B14_HALF_DAYS);
    expect(roundDb(result.li.a, 2)).toBe(expected.li);
    expect(roundDb(result.lr, 1)).toBe(expected.lr);
  });

  it('matches the B1 control values E1 73.8, E2 66.3, E3 60.5, E4a 53.1', () => {
    expect(roundDb(annex7Level(sourcesOf('E1'), B14_HALF_DAYS).lr)).toBe(73.8);
    expect(roundDb(annex7Level(sourcesOf('E2'), B14_HALF_DAYS).lr)).toBe(66.3);
    expect(roundDb(annex7Level(sourcesOf('E3'), B14_HALF_DAYS).lr)).toBe(60.5);
    expect(roundDb(annex7Level(sourcesOf('E4a'), B14_HALF_DAYS).lr)).toBe(53.1);
  });

  it('reproduces the unrounded E1 Li(a) and Lri(a) of the sheet', () => {
    const { li, lri, lr } = annex7Level(sourcesOf('E1'), B14_HALF_DAYS);
    expect(li.a).toBeCloseTo(90.91582571800603, 6);
    expect(lri.a).toBeCloseTo(73.75060616241248, 6);
    // The sheet's five 0 dB cells lift Lr above Lri(a) by 5 / 10^7.375 energy units only.
    expect(lr).toBeCloseTo(lri.a, 5);
    expect(annex7Level(sourcesOf('E1'), B14_HALF_DAYS, { emptyCategories: 'skip' }).lr).toBeCloseTo(lri.a, 12);
  });

  it('reproduces the A7X sheet by default: 0 dB cells of empty categories are summed (E8 = 28.1)', () => {
    // 28.046 dB = 637.7 energy units; the five empty categories add 5 × 10^0 → 642.7 units = 28.080 dB.
    const sheet = annex7Level(sourcesOf('E8'), B14_HALF_DAYS);
    for (const k of ['b', 'c', 'd', 'e', 'f'] as const) {
      expect(sheet.li[k]).toBe(LSV_EMPTY_LEVEL);
      expect(sheet.lri[k]).toBe(LSV_EMPTY_LEVEL);
    }
    expect(sheet.lr).toBeCloseTo(28.08, 2);
    expect(roundDb(sheet.lr)).toBe(28.1);
    expect(annex7Level(sourcesOf('E8'), B14_HALF_DAYS, { emptyCategories: 'zero' }).lr).toBe(sheet.lr);
  });

  it('leaves categories without shots out of the sum with emptyCategories: skip — the kernel output A7p (E8 = 28.0)', () => {
    const kernel = annex7Level(sourcesOf('E8'), B14_HALF_DAYS, { emptyCategories: 'skip' });
    expect(roundDb(kernel.lr)).toBe(28.0);
    expect(kernel.lr).toBeCloseTo(28.046311575135064, 6);
    // Loud receivers are unaffected at display precision (E1: 73.8 either way).
    expect(roundDb(annex7Level(sourcesOf('E1'), B14_HALF_DAYS, { emptyCategories: 'skip' }).lr)).toBe(73.8);
  });

  it('raises Lr by exactly 3 dB when every shot count is multiplied by 10 (3·log M, half-days unchanged)', () => {
    // Metamorphic check per annex: Anhang 7 scales with 3·log(M) — unlike
    // Anhang 9, where tenfold shots add 10 dB (see annex9.spec).
    // 'skip' isolates the formula; the constant 0 dB cells of the sheet do not scale with M.
    const base = annex7Level(sourcesOf('E1'), B14_HALF_DAYS, { emptyCategories: 'skip' });
    const tenfold = annex7Level(
      sourcesOf('E1').map((s) => ({ ...s, shots: s.shots * 10 })),
      B14_HALF_DAYS,
      { emptyCategories: 'skip' },
    );
    expect(tenfold.li.a).toBeCloseTo(base.li.a, 9); // GEMW is scale-free
    expect(tenfold.lri.a - base.lri.a).toBeCloseTo(3, 9);
    expect(tenfold.lr - base.lr).toBeCloseTo(3, 9);
  });

  it('combines two categories energetically', () => {
    const sources: Annex7Source[] = [
      { sourceId: 'a1', category: 'a', shots: 1000, lafmaxDay: 90 },
      { sourceId: 'b1', category: 'b', shots: 1000, lafmaxDay: 90 },
    ];
    const halfDays = {
      ...NO_HALF_DAYS,
      a: { work: 10, sunday: 0 },
      b: { work: 10, sunday: 0 },
    };
    // 'skip': the exact doubling; the sheet's 0 dB cells would add 5 resp. 4 energy units on top.
    const single = annex7Level(sources.slice(0, 1), halfDays, { emptyCategories: 'skip' });
    const both = annex7Level(sources, halfDays, { emptyCategories: 'skip' });
    expect(both.lri.a).toBeCloseTo(both.lri.b, 12);
    expect(both.lr - single.lr).toBeCloseTo(10 * Math.log10(2), 9);
  });

  it('weights a Sunday half-day three times a workday half-day', () => {
    const sources: Annex7Source[] = [
      { sourceId: 'a1', category: 'a', shots: 500, lafmaxDay: 85 },
    ];
    const work = annex7Level(sources, {
      ...NO_HALF_DAYS,
      a: { work: 3, sunday: 0 },
    });
    const sunday = annex7Level(sources, {
      ...NO_HALF_DAYS,
      a: { work: 0, sunday: 1 },
    });
    expect(sunday.lr).toBeCloseTo(work.lr, 12);
  });

  it('follows the closed form for one source', () => {
    // Li = 85; Lri = 85 + 10·log10(27 + 3) + 3·log10(500) − 44
    const { lri } = annex7Level(
      [{ sourceId: 'a1', category: 'a', shots: 500, lafmaxDay: 85 }],
      { ...NO_HALF_DAYS, a: { work: 27, sunday: 1 } },
    );
    expect(lri.a).toBeCloseTo(
      85 + 10 * Math.log10(30) + 3 * Math.log10(500) - 44,
      9,
    );
  });

  it('treats shots without any half-day as not assessable (no -Infinity)', () => {
    const result = annex7Level(
      [{ sourceId: 'a1', category: 'a', shots: 500, lafmaxDay: 85 }],
      NO_HALF_DAYS,
    );
    expect(result.li.a).toBeCloseTo(85, 10);
    expect(result.lri.a).toBe(LSV_EMPTY_LEVEL);
    // No assessable category at all: «keine Energie», not the 7.8 dB of six 0 dB cells.
    expect(result.lr).toBe(LSV_EMPTY_LEVEL);
  });

  it('is empty without sources', () => {
    const result = annex7Level([], B14_HALF_DAYS);
    expect(result.lr).toBe(LSV_EMPTY_LEVEL);
    expect(Object.values(result.li).every((v) => v === LSV_EMPTY_LEVEL)).toBe(
      true,
    );
  });
});
