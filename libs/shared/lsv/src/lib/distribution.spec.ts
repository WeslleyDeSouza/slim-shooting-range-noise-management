import { distributeShots } from './distribution';

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

  it('gives a single source everything and nothing to no source', () => {
    expect(distributeShots(123.456, [{ sourceId: 'a', weight: 0 }]).shares).toEqual([{ sourceId: 'a', shots: 123.456 }]);
    expect(distributeShots(500, [])).toEqual({ shares: [] });
  });

  it('spreads evenly and warns when every weight is zero (T02)', () => {
    const d = distributeShots(100, [
      { sourceId: 'a', weight: 0 },
      { sourceId: 'b', weight: 0 },
      { sourceId: 'c', weight: 0 },
    ]);
    expect(d.warning).toBe('zero-weights');
    expect(d.shares.map((s) => s.shots)).toEqual([33.334, 33.333, 33.333]);
    expect(sum(d.shares)).toBeCloseTo(100, 12);
  });

  it('keeps decimal quantities to three decimals and preserves the total', () => {
    const d = distributeShots(1.2, [
      { sourceId: 'a', weight: 2 },
      { sourceId: 'b', weight: 1 },
    ]);
    expect(d.shares).toEqual([
      { sourceId: 'a', shots: 0.8 },
      { sourceId: 'b', shots: 0.4 },
    ]);
    const odd = distributeShots(0.01, [
      { sourceId: 'a', weight: 1 },
      { sourceId: 'b', weight: 1 },
      { sourceId: 'c', weight: 1 },
    ]);
    expect(sum(odd.shares)).toBeCloseTo(0.01, 12);
    expect(odd.shares.map((s) => s.shots)).toEqual([0.004, 0.003, 0.003]);
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
