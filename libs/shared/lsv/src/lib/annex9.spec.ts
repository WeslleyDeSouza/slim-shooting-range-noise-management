import { annex9Level } from './annex9';
import {
  B14_EXPECTED_A9,
  B14_OPDATA_A9,
  B14_RECEIVERS,
  B14_SOURCES,
  B14_WLR,
} from './fixtures/b14-demo.fixture';
import { roundDb } from './levels';
import { Annex9Source, LSV_EMPTY_LEVEL } from './types';

/** Sources of one receiver with the B1.4 operating data. */
function sourcesOf(receiver: string, scale = 1): Annex9Source[] {
  return B14_SOURCES.map((sourceId, i) => ({
    sourceId,
    shotsDay: B14_OPDATA_A9[sourceId][0] * scale,
    shotsEve: B14_OPDATA_A9[sourceId][1] * scale,
    laeDay: B14_WLR[receiver][i].laeDay,
    laeEve: B14_WLR[receiver][i].laeEve,
  }));
}

describe('annex9Level — Beilage B1.4 demo project (sheet sonARMS_Demo_A9X)', () => {
  it.each(B14_RECEIVERS)('reproduces receiver %s', (receiver) => {
    const expected = B14_EXPECTED_A9[receiver];
    const result = annex9Level(sourcesOf(receiver));
    expect(roundDb(result.lae1, 2)).toBe(expected.lae1);
    expect(roundDb(result.lae2, 2)).toBe(expected.lae2);
    expect(roundDb(result.lr, 1)).toBe(expected.lr);
  });

  it('matches the B1 control values E1 60.7, E2 51.8, E3 46.6, E4a 41.8', () => {
    expect(roundDb(annex9Level(sourcesOf('E1')).lr)).toBe(60.7);
    expect(roundDb(annex9Level(sourcesOf('E2')).lr)).toBe(51.8);
    expect(roundDb(annex9Level(sourcesOf('E3')).lr)).toBe(46.6);
    expect(roundDb(annex9Level(sourcesOf('E4a')).lr)).toBe(41.8);
  });

  // Excel's LOG differs from Math.log10 in the last bits, so ~1e-8 is the
  // agreement to expect on the unrounded numbers.
  it('reproduces the unrounded E1 value of the sheet', () => {
    const { lae1, lae2, lr } = annex9Level(sourcesOf('E1'));
    expect(lae1).toBeCloseTo(116.06120988607783, 6);
    expect(lae2).toBeCloseTo(102.24086760543716, 6);
    expect(lr).toBeCloseTo(60.73319888060385, 6);
  });

  it('does not depend on the order of the sources', () => {
    const forward = annex9Level(sourcesOf('E5b'));
    const backward = annex9Level([...sourcesOf('E5b')].reverse());
    expect(backward.lr).toBeCloseTo(forward.lr, 12);
    expect(backward.lae1).toBeCloseTo(forward.lae1, 12);
  });

  it('raises Lr by exactly 10 dB when every shot count is multiplied by 10', () => {
    const base = annex9Level(sourcesOf('E2'));
    const tenfold = annex9Level(sourcesOf('E2', 10));
    expect(tenfold.lr - base.lr).toBeCloseTo(10, 9);
    expect(tenfold.lae1 - base.lae1).toBeCloseTo(10, 9);
    expect(tenfold.lae2 - base.lae2).toBeCloseTo(10, 9);
  });

  it('uses LAE1 alone when nothing was shot outside the workday', () => {
    const dayOnly = sourcesOf('E1').map((s) => ({ ...s, shotsEve: 0 }));
    const result = annex9Level(dayOnly);
    expect(result.lae2).toBe(LSV_EMPTY_LEVEL);
    expect(result.lae1).toBeCloseTo(116.06120988607783, 6);
    // Lr = LAE1 − 10·log10(52·5·12·3600) + 15
    expect(result.lr).toBeCloseTo(
      result.lae1 - 10 * Math.log10(11232000) + 15,
      9,
    );
    expect(result.lr).toBeLessThan(annex9Level(sourcesOf('E1')).lr);
  });

  it('uses LAE2 alone when nothing was shot inside the workday', () => {
    const eveOnly = sourcesOf('E1').map((s) => ({ ...s, shotsDay: 0 }));
    const result = annex9Level(eveOnly);
    expect(result.lae1).toBe(LSV_EMPTY_LEVEL);
    expect(result.lr).toBeCloseTo(
      result.lae2 - 10 * Math.log10(11232000) + 15,
      9,
    );
  });

  it('is empty (-99) without any shots', () => {
    const none = sourcesOf('E1').map((s) => ({
      ...s,
      shotsDay: 0,
      shotsEve: 0,
    }));
    expect(annex9Level(none)).toEqual({
      lae1: LSV_EMPTY_LEVEL,
      lae2: LSV_EMPTY_LEVEL,
      lr: LSV_EMPTY_LEVEL,
    });
    expect(annex9Level([])).toEqual({
      lae1: LSV_EMPTY_LEVEL,
      lae2: LSV_EMPTY_LEVEL,
      lr: LSV_EMPTY_LEVEL,
    });
  });

  it('gives the single-source closed form', () => {
    // One source, 1000 day shots at LAE 80: LAE1 = 80 + 30 = 110.
    const result = annex9Level([
      { sourceId: 'x', shotsDay: 1000, shotsEve: 0, laeDay: 80, laeEve: 80 },
    ]);
    expect(result.lae1).toBeCloseTo(110, 9);
    expect(result.lr).toBeCloseTo(110 - 10 * Math.log10(11232000) + 15, 9);
  });

  it('rejects a negative shot count', () => {
    expect(() =>
      annex9Level([
        { sourceId: 'x', shotsDay: -1, shotsEve: 0, laeDay: 80, laeEve: 80 },
      ]),
    ).toThrow();
  });
});
