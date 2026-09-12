import {
  ANNEX7_LIMITS,
  ANNEX9_LIMITS,
  applicableLimits,
  limits,
} from './limits';
import { SensitivityLevel } from './types';

describe('limits (Art. 43 LSV, Anhang 7 / 9)', () => {
  it.each<[SensitivityLevel, number, number, number]>([
    ['I', 50, 55, 65],
    ['II', 55, 60, 70],
    ['III', 60, 65, 70],
    ['IV', 65, 70, 75],
  ])('Anhang 9, ES %s → PW %d / IGW %d / AW %d', (es, pw, igw, aw) => {
    expect(limits(9, es)).toEqual({ pw, igw, aw });
    expect(ANNEX9_LIMITS[es]).toEqual({ pw, igw, aw });
  });

  it.each<[SensitivityLevel, number, number, number]>([
    ['I', 50, 55, 65],
    ['II', 55, 60, 75],
    ['III', 60, 65, 75],
    ['IV', 65, 70, 80],
  ])('Anhang 7, ES %s → PW %d / IGW %d / AW %d', (es, pw, igw, aw) => {
    expect(limits(7, es)).toEqual({ pw, igw, aw });
    expect(ANNEX7_LIMITS[es]).toEqual({ pw, igw, aw });
  });

  it('returns a copy, never the table itself', () => {
    const set = limits(9, 'II');
    set.igw = 0;
    expect(limits(9, 'II').igw).toBe(60);
  });

  it('rejects an unknown Empfindlichkeitsstufe', () => {
    expect(() => limits(9, 'V' as SensitivityLevel)).toThrow(
      /Empfindlichkeitsstufe/,
    );
  });
});

describe('applicableLimits (B1 7.7, Baujahr der Anlageteile)', () => {
  it('maps the build year class to the limit kinds', () => {
    expect(applicableLimits('before1985')).toEqual(['igw']);
    expect(applicableLimits('after1985')).toEqual(['pw']);
    expect(applicableLimits('mixed')).toEqual(['igw', 'pw']);
  });

  it('rejects an unknown class', () => {
    expect(() => applicableLimits('1990' as never)).toThrow(/build year/);
  });
});
