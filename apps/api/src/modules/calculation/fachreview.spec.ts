import { describe, expect, it } from 'vitest';
import { distributeShots, splitAnnex9 } from '@slim/lsv';
import { deriveOperatingData, distributeOntoState, pointSources, ReferenceData } from './operating-data';
import { SimulationService } from './simulation.service';
import { StateModel } from './calculation.service';
import { AreaUsageEntity, UsagePositionEntity } from '../usage/entities';

function fixture<T>(value: unknown): T { return value as T; }
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}

// Deliberately minimal in-memory fixtures. These exercise real calculation code,
// not HTTP, validation decorators, file parsers or database persistence.
const reference = () => fixture<ReferenceData>({
  area: { id: 'area', annex7Overall: false, coordinationSectionNo: 'test' },
  rooms: [{ id: 'room', name: 'Room', enabled: true }],
  combinations: ['a', 'b'].map(id => ({ id, weapon: { nameDe: id, annex7Category: 'a' }, caliber: { nameDe: id } })),
  holidays: [],
});
const usage = (positions: Pick<UsagePositionEntity, 'combinationId' | 'quantity'>[]) => fixture<AreaUsageEntity>({
  roomId: 'room', date: '2026-09-07', timeFrom: '08:00', timeTo: '09:30',
  usageType: 'civil', positions,
});
const model = () => fixture<StateModel>({
  state: { id: 'state', buildYearClass: 'before1985' },
  plantParts: [{ id: 'part', roomId: 'room', builtAfter1985: false }],
  sources: [{ id: 'source', plantPartId: 'part', combinationId: 'a', dataA9: { shotsInside: 100, shotsOutside: 100 } }],
  points: [{ id: 'point', code: 'E1', type: 'facade', sensitivityLevel: 'II' }],
  wlr: new Map([['point', new Map([['source', { day: { lae: 80, lafmax: 70 }, eve: { lae: 80, lafmax: 70 } }]])]]),
});
const label = () => 'room / combination';

function simulation(usages: AreaUsageEntity[], assignments = ['a', 'b'], m = model()) {
  return new SimulationService(
    fixture<ConstructorParameters<typeof SimulationService>[0]>({ find: async () => assignments.map(combinationId => ({ roomId: 'room', combinationId, enabled: true, entryName: combinationId })) }),
    fixture<ConstructorParameters<typeof SimulationService>[1]>({ reference: async () => reference() }),
    fixture<ConstructorParameters<typeof SimulationService>[2]>({ listYear: async () => usages }),
    fixture<ConstructorParameters<typeof SimulationService>[3]>({ resolve: async () => ({ selected: m.state }), loadModel: async () => m, toDto: () => m.state }),
  );
}

describe('Fachreview 13.09.2026 — regressions', () => {
  it('P1: 1 kg over 06:00–08:00 splits into 0.5 kg in each time group', () => {
    expect(splitAnnex9({ date: '2026-09-07', from: '06:00', to: '08:00', shots: 1 })).toEqual({ inside: 0.5, outside: 0.5 });
  });

  it('P1: mixed plant exposes PW exceedance even when the overall IGW is met', async () => {
    const m = model();
    m.state.buildYearClass = 'mixed';
    m.plantParts[0].builtAfter1985 = true;
    const svc = simulation([usage([{ combinationId: 'a', quantity: 2000 }])], ['a'], m);
    const result = await svc.run('tenant', 'area', { year: 2026, rows: [] });
    const r = result.receivers[0];
    // Lr = 80 + 10 log(2000) - 70.50457 + 15 = 57.5057;
    // ES II: IGW 60 met, PW 55 exceeded.
    expect(r.simulatedRows?.find(x => x.limitKind === 'igw')?.state).toBe('warn');
    expect(r.simulatedRows?.find(x => x.limitKind === 'pw')?.state).toBe('over');
    expect(r.simulatedState).toBe('over');
    expect(r.currentState).toBe('over');
  });

  it('P1: conflicting A7 source and master categories are not silently combined', () => {
    const m = model();
    m.sources[0].dataA7 = fixture({ category: 'b', shotsWork: 100, shotsSunday: 0 });
    const operating = deriveOperatingData(reference(), [usage([{ combinationId: 'a', quantity: 100 }])], 1);
    const result = distributeOntoState(operating, reference(), m, label);
    expect(result.missing.map(x => x.reason)).toContain('category-mismatch');
    expect(result.bySource.get('source')?.civil).toBe(0);
  });

  it('F01: one usage with two combinations of category a counts its 90 minutes only once', () => {
    const result = deriveOperatingData(reference(), [usage([
      { combinationId: 'a', quantity: 100 }, { combinationId: 'b', quantity: 100 },
    ])], 1);
    expect(result.annex7HalfDays.a.work).toBe(0.5);
  });

  it('F02: source distribution preserves a three-year average below 0.001', () => {
    const amount = 0.001 / 3;
    const result = distributeShots(amount, [{ sourceId: 'one', weight: 1 }, { sourceId: 'two', weight: 1 }]);
    expect(result.shares.reduce((s, x) => s + x.shots, 0)).toBeCloseTo(amount, 12);
    for (const share of result.shares) expect(share.shots).toBeGreaterThan(0);
  });

  it('F01: different categories each count once, including the new-room subset', () => {
    const ref = reference();
    ref.combinations[1].weapon.annex7Category = 'b';
    const result = deriveOperatingData(ref, [usage([{ combinationId: 'a', quantity: 100 }, { combinationId: 'b', quantity: 100 }])], 1);
    expect(result.annex7HalfDays.a.work).toBe(0.5);
    expect(result.annex7HalfDays.b.work).toBe(0.5);
    expect(result.annex7HalfDaysOf(new Set(['room']))).toEqual(result.annex7HalfDays);
    expect(result.annex7HalfDaysOf(new Set()).a.work).toBe(0);
  });

  it('F02: averaging, splitting and source ordering preserve the same ratios', () => {
    const sources = [{ sourceId: 'one', weight: 1 }, { sourceId: 'two', weight: 2 }];
    const annual = distributeShots(0.001 / 3, sources);
    const total = distributeShots(0.001, sources);
    const reversed = distributeShots(0.001 / 3, [...sources].reverse());
    annual.shares.forEach((share, i) => {
      expect(share.shots).toBeCloseTo(total.shares[i].shots / 3, 15);
      expect(share.shots).toBeCloseTo(required(reversed.shares.find(s => s.sourceId === share.sourceId)).shots, 15);
    });
  });

  it('F03: one zero-weight source follows the same refuse default as the kernel', () => {
    const m = model();
    required(m.sources[0].dataA9).shotsInside = 0;
    const operating = deriveOperatingData(reference(), [usage([{ combinationId: 'a', quantity: 100 }])], 1);
    const result = distributeOntoState(operating, reference(), m, label);
    expect(result.missing.map(x => x.reason)).toContain('zero-weights');
  });

  it('F04: missing evening level with positive evening quantity is reported', () => {
    const m = model();
    delete required(required(m.wlr.get('point')).get('source')).eve;
    const operating = deriveOperatingData(reference(), [{ ...usage([{ combinationId: 'a', quantity: 100 }]), timeFrom: '20:00', timeTo: '21:00' }], 1);
    const distributed = distributeOntoState(operating, reference(), m, label);
    expect(pointSources(distributed, m, 'point', label).missing.map(x => x.reason)).toContain('no-level');
  });

  it.each(['day', 'eve'] as const)('F04: %s-only shooting does not require an unused WLR time group', (group) => {
    const m = model();
    delete required(required(m.wlr.get('point')).get('source'))[group === 'day' ? 'eve' : 'day'];
    const slot = { ...usage([{ combinationId: 'a', quantity: 100 }]), usageType: 'military' };
    if (group === 'eve') Object.assign(slot, { timeFrom: '20:00', timeTo: '21:00' });
    const operating = deriveOperatingData(reference(), [slot], 1);
    const result = pointSources(distributeOntoState(operating, reference(), m, label), m, 'point', label);
    expect(result.missing).toEqual([]);
    expect(result.annex9).toHaveLength(1);
    expect(result.annex9[0][group === 'day' ? 'shotsDay' : 'shotsEve']).toBe(100);
  });

  it('F05a: adding positive simulated quantity without a source makes the result incomplete', async () => {
    const svc = simulation([usage([{ combinationId: 'a', quantity: 100 }])]);
    const result = await svc.run('tenant', 'area', { year: 2026, rows: [{ roomId: 'room', combinationId: 'b', inside: 100, outside: 0 }] });
    expect(result.receivers[0].simulatedState).toBe('incomplete');
    expect(result.receivers[0].incomplete).toBe(true);
  });

  it('F05b: zeroing the only missing-source quantity clears simulated incompleteness', async () => {
    const svc = simulation([usage([{ combinationId: 'a', quantity: 100 }, { combinationId: 'b', quantity: 100 }])]);
    const result = await svc.run('tenant', 'area', { year: 2026, rows: [{ roomId: 'room', combinationId: 'b', inside: 0, outside: 0 }] });
    expect(result.receivers[0].simulatedState).not.toBe('incomplete');
    expect(result.receivers[0].incomplete).toBe(false);
    expect(result.receivers[0].currentState).toBe('incomplete');
  });

  it('F06: unchanged simulation preserves historical quantities of disabled assignments', async () => {
    // The database query returns only enabled assignment b. Historical usage a
    // still contributes to the real baseline and has a valid source.
    const svc = simulation([usage([{ combinationId: 'a', quantity: 100 }])], ['b']);
    const result = await svc.run('tenant', 'area', { year: 2026, rows: [] });
    expect(result.totals.inside).toBe(result.totals.baseInside);
    expect(result.receivers[0].simulated).toBe(result.receivers[0].current);
    expect(result.receivers[0].delta).toBe(0);
  });
});
