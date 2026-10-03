import { AreaViewStore } from './store.service';

describe('AreaViewStore', () => {
  it('retains independent period and calculation selections for each area', () => {
    const store = new AreaViewStore();
    store.setYears('a', '2025, 2020, 2023');
    store.setCalculation('a', 'state-a');
    expect(store.selection('b')).toMatchObject({ years: null, calculationId: null });
    store.setDate('b', 'from', '2022-01-01');
    expect(store.selection('a')).toMatchObject({ yearsText: '2025, 2020, 2023', years: '2020,2023,2025', calculationId: 'state-a' });
    expect(store.selection('b').from).toBe('2022-01-01');
  });

  it('retains the last valid selection with invalid draft text and clears years for a date range', () => {
    const store = new AreaViewStore();
    store.setYears('a', '1900,2023,2200');
    store.setYears('a', '1899,2023,2025');
    expect(store.selection('a')).toMatchObject({ years: '1900,2023,2200', yearsText: '1899,2023,2025', yearsInvalid: true });
    store.setDate('a', 'to', '2025-12-31');
    expect(store.selection('a')).toMatchObject({ years: null, yearsText: '', yearsInvalid: false, to: '2025-12-31' });
  });
});
