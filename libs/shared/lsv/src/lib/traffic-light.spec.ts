import { noiseState, quotaState, worstState } from './traffic-light';
import { LSV_EMPTY_LEVEL } from './types';

describe('noiseState (Ampel Lärmbelastung, B1 5.10)', () => {
  it('is red above the limit, orange within 5 dB, green below', () => {
    expect(noiseState(60.1, 60)).toBe('over');
    expect(noiseState(60.0, 60)).toBe('warn');
    expect(noiseState(55.1, 60)).toBe('warn');
    expect(noiseState(55.0, 60)).toBe('ok');
    expect(noiseState(41.8, 60)).toBe('ok');
    expect(noiseState(73.8, 60)).toBe('over');
  });

  it('compares the printed (one-decimal) value', () => {
    expect(noiseState(60.04, 60)).toBe('warn');
    expect(noiseState(60.05, 60)).toBe('over');
    expect(noiseState(55.04, 60)).toBe('ok');
  });

  it('honours a custom warn band', () => {
    expect(noiseState(58, 60, 3)).toBe('warn');
    expect(noiseState(58, 60, 2)).toBe('ok');
    // The band edge itself is still green (> limit − band is orange).
    expect(noiseState(57, 60, 3)).toBe('ok');
  });

  it('is none without a usable level', () => {
    expect(noiseState(null, 60)).toBe('none');
    expect(noiseState(undefined, 60)).toBe('none');
    expect(noiseState(LSV_EMPTY_LEVEL, 60)).toBe('none');
    expect(noiseState(Number.NaN, 60)).toBe('none');
    expect(noiseState(-Infinity, 60)).toBe('none');
  });
});

describe('worstState (aggregation onto the Schiessplatz)', () => {
  it('is red as soon as one is red, else orange, else green', () => {
    expect(worstState(['ok', 'ok', 'over', 'warn'])).toBe('over');
    expect(worstState(['ok', 'warn', 'none'])).toBe('warn');
    expect(worstState(['ok', 'none'])).toBe('ok');
    expect(worstState(['none', 'none'])).toBe('none');
    expect(worstState([])).toBe('none');
  });
});

describe('quotaState (Ampel Kontingent Plangenehmigung, B1 5.10)', () => {
  it('is green up to the target, orange up to 125 %, red above', () => {
    expect(quotaState(100, 100)).toBe('ok');
    expect(quotaState(0, 100)).toBe('ok');
    expect(quotaState(125, 100)).toBe('warn');
    expect(quotaState(100.5, 100)).toBe('warn');
    expect(quotaState(125.1, 100)).toBe('over');
  });

  it('handles weapons without a quota', () => {
    expect(quotaState(0, 0)).toBe('ok');
    expect(quotaState(1, 0)).toBe('over');
    expect(quotaState(50, null)).toBe('none');
    expect(quotaState(50, undefined)).toBe('none');
    expect(quotaState(50, Number.NaN)).toBe('none');
  });

  it('honours a custom tolerance', () => {
    expect(quotaState(110, 100, 1.1)).toBe('warn');
    expect(quotaState(111, 100, 1.1)).toBe('over');
  });
});
