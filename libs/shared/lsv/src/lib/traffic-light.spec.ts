import { assessedLevel, noiseState, quotaState, worstState } from './traffic-light';
import { LSV_EMPTY_LEVEL } from './types';

describe('noiseState (Ampel Lärmbelastung, B1 5.10)', () => {
  it('is red above the limit, orange within 5 dB, green below', () => {
    expect(noiseState(61, 60)).toBe('over');
    expect(noiseState(60.0, 60)).toBe('warn');
    expect(noiseState(56, 60)).toBe('warn');
    expect(noiseState(55.0, 60)).toBe('ok');
    expect(noiseState(41.8, 60)).toBe('ok');
    expect(noiseState(73.8, 60)).toBe('over');
  });

  it('rounds to whole dB before the comparison (Projekthandbuch B1.2 Kap. 10.4)', () => {
    // 60.4 → 60: Grenzwert eingehalten; 60.5 → 61: überschritten.
    expect(assessedLevel(60.4)).toBe(60);
    expect(assessedLevel(60.5)).toBe(61);
    expect(noiseState(60.4, 60)).toBe('warn');
    expect(noiseState(60.5, 60)).toBe('over');
    expect(noiseState(60.49, 60)).toBe('warn');
    // Same rule at the orange edge (limit − 5): 55.4 → 55 green, 55.5 → 56 orange.
    expect(noiseState(55.4, 60)).toBe('ok');
    expect(noiseState(55.5, 60)).toBe('warn');
    // Values right at the rounding boundary of a printed level.
    expect(noiseState(60.45, 60)).toBe('warn');
    expect(noiseState(60.95, 60)).toBe('over');
  });

  it('supports the display rounding (one decimal) and no rounding as configuration', () => {
    expect(noiseState(60.04, 60, 5, 'tenth')).toBe('warn');
    expect(noiseState(60.05, 60, 5, 'tenth')).toBe('over');
    expect(noiseState(60.01, 60, 5, 'none')).toBe('over');
    expect(noiseState(60.4, 60, 5, 'none')).toBe('over');
  });

  it('honours a custom warn band', () => {
    expect(noiseState(58, 60, 3)).toBe('warn');
    expect(noiseState(58, 60, 2)).toBe('ok');
    // The band edge itself is still green (> limit − band is orange).
    expect(noiseState(57, 60, 3)).toBe('ok');
  });

  it('marks an incomplete assessment as nicht beurteilbar — never a colour (O8)', () => {
    expect(noiseState(61.2, 60, 5, 'whole', { incomplete: true })).toBe('incomplete');
    expect(noiseState(41.8, 60, 5, 'whole', { incomplete: true })).toBe('incomplete');
    expect(noiseState(null, 60, 5, 'whole', { incomplete: true })).toBe('incomplete');
    // Aggregation: an incomplete row makes the whole assessment incomplete.
    expect(worstState(['ok', 'incomplete', 'warn'])).toBe('incomplete');
    expect(worstState(['incomplete', 'over'])).toBe('incomplete');
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
