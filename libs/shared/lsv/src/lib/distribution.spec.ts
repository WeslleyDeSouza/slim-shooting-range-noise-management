import { distributeShots } from './distribution';

const RELEASE = { reference: 'Entscheidungslog O8, KOMZ Lärm', date: '2026-10-01' };

const sum = (shares: { shots: number }[]) => shares.reduce((a, s) => a + s.shots, 0);

describe('distributeShots (B1 7.5, Verteilung auf Quellen)', () => {
  it('spreads in proportion to the weights of the Betriebsdaten', () => {
    const d = distributeShots(1000, [
      { sourceId: 'SH300-Links', weight: 3000 },
      { sourceId: 'SH300-Rechts', weight: 1000 },
    ]);
    expect(d.shares).toEqual([
      { sourceId: 'SH300-Links', shots: 750 },
      { sourceId: 'SH300-Rechts', shots: 250 },
    ]);
    expect(d.warning).toBeUndefined();
  });

  it('gives a single source everything (flagging a zero weight) and reports a missing source', () => {
    expect(distributeShots(123.456, [{ sourceId: 'a', weight: 40 }])).toEqual({ shares: [{ sourceId: 'a', shots: 123.456 }] });
    // A single source with weight 0 is still Σ = 0 → refused by default.
    expect(distributeShots(123.456, [{ sourceId: 'a', weight: 0 }])).toEqual({ shares: [{ sourceId: 'a', shots: 0 }], warning: 'zero-weights', refused: true });
    expect(distributeShots(123.456, [{ sourceId: 'a', weight: 0 }], { onZeroWeights: 'equal', release: RELEASE })).toEqual({ shares: [{ sourceId: 'a', shots: 123.456 }], warning: 'zero-weights', substituteRule: true, release: RELEASE });
    // No source in the Zustand: nothing to distribute, but never silently dropped.
    expect(distributeShots(500, [])).toEqual({ shares: [], warning: 'no-source' });
    expect(distributeShots(0, [])).toEqual({ shares: [] });
  });

  it('refuses by default when every weight is zero — no invented distribution (O8)', () => {
    const d = distributeShots(100, [{ sourceId: 'a', weight: 0 }, { sourceId: 'b', weight: 0 }]);
    expect(d).toEqual({ shares: [{ sourceId: 'a', shots: 0 }, { sourceId: 'b', shots: 0 }], warning: 'zero-weights', refused: true });
    // Only Σ weights = 0 triggers the rule; partial zeros keep the defined ratio.
    expect(distributeShots(10, [{ sourceId: 'a', weight: 5 }, { sourceId: 'b', weight: 0 }]).refused).toBeUndefined();
  });

  it('spreads evenly only as the released Ersatzregel and marks the result (O8)', () => {
    const d = distributeShots(100, [
      { sourceId: 'a', weight: 0 },
      { sourceId: 'b', weight: 0 },
      { sourceId: 'c', weight: 0 },
    ], { onZeroWeights: 'equal', release: RELEASE });
    expect(d.warning).toBe('zero-weights');
    expect(d.substituteRule).toBe(true);
    expect(d.release).toEqual(RELEASE);
    // The parameter alone proves no release: without the decision reference it is refused loudly.
    expect(() => distributeShots(100, [{ sourceId: 'a', weight: 0 }], { onZeroWeights: 'equal' })).toThrow(/release/);
    for (const share of d.shares) expect(share.shots).toBeCloseTo(100 / 3, 12);
    expect(sum(d.shares)).toBeCloseTo(100, 12);
  });

  it('preserves fractional source ratios and the total without presentation rounding', () => {
    const d = distributeShots(1.2, [
      { sourceId: 'a', weight: 2 },
      { sourceId: 'b', weight: 1 },
    ]);
    expect(d.shares[0].shots).toBeCloseTo(0.8, 12);
    expect(d.shares[1].shots).toBeCloseTo(0.4, 12);
    const odd = distributeShots(0.01, [
      { sourceId: 'a', weight: 1 },
      { sourceId: 'b', weight: 1 },
      { sourceId: 'c', weight: 1 },
    ]);
    expect(sum(odd.shares)).toBeCloseTo(0.01, 12);
    for (const share of odd.shares) expect(share.shots).toBeCloseTo(0.01 / 3, 12);
  });

  it('leaves sources with weight 0 empty when others carry weight', () => {
    const d = distributeShots(10, [
      { sourceId: 'a', weight: 5 },
      { sourceId: 'b', weight: 0 },
    ]);
    expect(d.shares).toEqual([
      { sourceId: 'a', shots: 10 },
      { sourceId: 'b', shots: 0 },
    ]);
  });

  it('rejects negative or non-finite input', () => {
    expect(() => distributeShots(-1, [{ sourceId: 'a', weight: 1 }])).toThrow();
    expect(() => distributeShots(1, [{ sourceId: 'a', weight: -1 }])).toThrow();
    expect(() => distributeShots(Number.NaN, [{ sourceId: 'a', weight: 1 }])).toThrow();
  });
});
