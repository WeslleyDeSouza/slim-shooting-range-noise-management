import { esm, gemw, roundDb } from './levels';
import { LSV_EMPTY_LEVEL } from './types';

describe('gemw (gewichtetes energetisches Mittel, B1.4 VBA)', () => {
  it('returns the level itself for a single source', () => {
    expect(gemw([100], [80.4])).toBeCloseTo(80.4, 10);
    expect(gemw([0.5], [63.3])).toBeCloseTo(63.3, 10);
  });

  it('is the energetic mean for equal weights', () => {
    // 10·log10((10^8 + 10^9) / 2) = 87.40 dB
    expect(gemw([1, 1], [80, 90])).toBeCloseTo(87.4032, 3);
    expect(gemw([7, 7], [80, 90])).toBeCloseTo(gemw([1, 1], [80, 90]), 10);
  });

  it('weights heavier sources more', () => {
    expect(gemw([1, 9], [80, 90])).toBeGreaterThan(gemw([9, 1], [80, 90]));
    expect(gemw([1, 0], [80, 90])).toBeCloseTo(80, 10);
  });

  it('accepts fractional weights', () => {
    expect(gemw([0.5, 0.5], [80, 90])).toBeCloseTo(gemw([1, 1], [80, 90]), 10);
  });

  it('is -99 when there is no weight at all', () => {
    expect(gemw([], [])).toBe(LSV_EMPTY_LEVEL);
    expect(gemw([0, 0, 0], [80, 90, 70])).toBe(LSV_EMPTY_LEVEL);
  });

  it('rejects mismatched lists and negative weights', () => {
    expect(() => gemw([1, 2], [80])).toThrow(/weights/);
    expect(() => gemw([1, -1], [80, 90])).toThrow(/invalid weight/);
    expect(() => gemw([Number.NaN], [80])).toThrow(/invalid weight/);
  });
});

describe('esm (energetische Summe, B1.4 VBA)', () => {
  it('adds 3.01 dB for two equal levels', () => {
    expect(esm([60, 60])).toBeCloseTo(63.0103, 3);
  });

  it('returns the single level unchanged', () => {
    expect(esm([73.75])).toBeCloseTo(73.75, 10);
  });

  it('ignores -99 markers and non-finite entries', () => {
    expect(esm([60, LSV_EMPTY_LEVEL])).toBeCloseTo(60, 10);
    expect(esm([60, -Infinity, Number.NaN])).toBeCloseTo(60, 10);
  });

  it('is -99 without any contributing level', () => {
    expect(esm([])).toBe(LSV_EMPTY_LEVEL);
    expect(esm([LSV_EMPTY_LEVEL, LSV_EMPTY_LEVEL])).toBe(LSV_EMPTY_LEVEL);
  });

  it('does not treat 0 dB as empty (0 dB carries 1 unit of energy)', () => {
    expect(esm([0])).toBeCloseTo(0, 10);
    expect(esm([73.75060616, 0, 0, 0, 0, 0])).toBeCloseTo(73.75060708, 6);
  });
});

describe('roundDb', () => {
  it('rounds half away from zero to one decimal', () => {
    expect(roundDb(60.75)).toBe(60.8);
    expect(roundDb(41.25)).toBe(41.3);
    expect(roundDb(-0.05)).toBe(-0.1);
    expect(roundDb(60.05)).toBe(60.1);
    expect(roundDb(2.675)).toBe(2.7);
  });

  it('rounds to other precisions without float artefacts', () => {
    expect(roundDb(2.675, 2)).toBe(2.68);
    expect(roundDb(1.005, 2)).toBe(1.01);
    expect(roundDb(116.06120988607783, 2)).toBe(116.06);
    expect(roundDb(60.73319888060385, 0)).toBe(61);
  });

  it('passes non-finite values through', () => {
    expect(roundDb(Number.NaN)).toBeNaN();
    expect(roundDb(-Infinity)).toBe(-Infinity);
  });
});
