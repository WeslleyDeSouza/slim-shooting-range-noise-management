import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  AdminCalculationService,
  SimulationBaseDto,
  SimulationResultDto,
} from '@ui-slim/apiClient';
import { SimulationFacade } from './simulation.facade';

const BASE: SimulationBaseDto = {
  areaId: 'a1',
  year: 2026,
  calculation: {
    id: 'c1',
    externalId: '02218_1',
    name: 'Initiale Aufnahme',
    calculationId: 'delivery-1',
    calculationName: 'Empa 2019',
    supplier: 'Empa',
    deliveredAt: '2019-05-08',
    referenceYear: 2019,
    buildYearClass: 'mixed',
    isCurrent: true,
    isMgdm: true,
    sourceCount: 2,
  },
  rows: [
    {
      combinationId: 'c1',
      roomId: 'r1',
      roomName: 'Stellungsrm Mw Neuhaus, B 3',
      roomNo: '1104.020.05',
      weapon: 'Stgw 90',
      caliber: '5.6 mm GP 90',
      weaponName: 'Stgw 90 · 5.6 mm',
      inside: 1000,
      outside: 100,
      hasLevels: true,
    },
    {
      combinationId: 'c2',
      roomId: 'r1',
      roomName: 'Stellungsrm Mw Neuhaus, B 3',
      roomNo: '1104.020.05',
      weapon: 'Pz Hb 74',
      caliber: '15.5 cm Spr Gr',
      weaponName: 'Pz Hb 74 · 15.5 cm',
      inside: 50,
      outside: 0,
      hasLevels: true,
    },
  ],
  receivers: [
    {
      id: 'e1',
      code: 'E1',
      sonarmsId: 'E1',
      egid: null,
      address: 'Laberhusstrasse 4',
      municipality: null,
      type: 'facade',
      sensitivityLevel: 'II',
      east: null,
      north: null,
      height: 4,
      mapX: 37.5,
      mapY: 49,
      limitKind: 'igw',
      limit: 60,
      current: 60.8,
      currentState: 'over',
      incomplete: false,
    },
  ],
};

const RESULT: SimulationResultDto = {
  areaId: 'a1',
  year: 2026,
  calculation: BASE.calculation,
  receivers: [
    { ...BASE.receivers[0], simulated: 63.8, simulatedState: 'over', delta: 3 },
  ],
  counts: { total: 1, ok: 0, warn: 0, over: 1, none: 0, incomplete: 0 },
  totals: { inside: 2000, outside: 200, baseInside: 1050, baseOutside: 100 },
  calculatedAt: '2026-09-11T10:00:00.000Z',
};

describe('SimulationFacade', () => {
  let facade: SimulationFacade;

  // jest-environment-jsdom does not expose Node's structuredClone (the facade
  // uses it to freeze the values a result was computed with).
  beforeAll(() => {
    globalThis.structuredClone ??= (value: unknown) => JSON.parse(JSON.stringify(value));
  });
  let api: { adminCalculationSimulationBase: jest.Mock; adminCalculationSimulate: jest.Mock };

  beforeEach(() => {
    api = {
      adminCalculationSimulationBase: jest.fn().mockReturnValue(of(BASE)),
      adminCalculationSimulate: jest.fn().mockReturnValue(of(RESULT)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AdminCalculationService, useValue: api }],
    });
    facade = TestBed.inject(SimulationFacade);
  });

  it('loads the base and copies the Ist into the editable values', async () => {
    await facade.load('a1', 2026);

    expect(api.adminCalculationSimulationBase).toHaveBeenCalledWith({
      areaId: 'a1',
      year: '2026',
      calculationId: undefined,
    });
    expect(facade.rows()).toHaveLength(2);
    expect(facade.values()).toEqual({ w1: { inside: 1000, outside: 100 }, w2: { inside: 50, outside: 0 } });
    expect(facade.dirty()).toBe(false);
    expect(facade.changedCount()).toBe(0);
    expect(facade.totals()).toEqual({ inside: 1050, outside: 100, baseInside: 1050, baseOutside: 100 });
    expect(facade.loading()).toBe(false);
  });

  it('setValue clamps negatives and rounds, and counts the changed cells', async () => {
    await facade.load('a1', 2026);

    facade.setValue('w1', 'inside', -5);
    expect(facade.values()['w1'].inside).toBe(0);
    facade.setValue('w1', 'outside', 149.6);
    expect(facade.values()['w1'].outside).toBe(150);
    facade.setValue('w2', 'inside', Number.NaN);
    expect(facade.values()['w2'].inside).toBe(0);

    expect(facade.changedCount()).toBe(3);
    expect(facade.dirty()).toBe(true);

    // Back to the Ist → no longer counted.
    facade.setValue('w1', 'inside', 1000);
    facade.setValue('w1', 'outside', 100);
    facade.setValue('w2', 'inside', 50);
    expect(facade.dirty()).toBe(false);
  });

  it('scaleAll multiplies and rounds every value', async () => {
    await facade.load('a1', 2026);
    facade.scaleAll(1.5);

    expect(facade.values()).toEqual({ w1: { inside: 1500, outside: 150 }, w2: { inside: 75, outside: 0 } });
    expect(facade.totals().inside).toBe(1575);
    expect(facade.changedCount()).toBe(3);
  });

  it('runs the simulation with every row and keeps the result while values stay', async () => {
    await facade.load('a1', 2026);
    facade.scaleAll(2);

    const result = await facade.run();

    expect(result).toBe(RESULT);
    expect(api.adminCalculationSimulate).toHaveBeenCalledWith({
      areaId: 'a1',
      body: {
        year: 2026,
        calculationId: undefined,
        rows: [
          { roomId: 'r1', combinationId: 'c1', inside: 2000, outside: 200 },
          { roomId: 'r1', combinationId: 'c2', inside: 100, outside: 0 },
        ],
      },
    });
    expect(facade.result()).toBe(RESULT);
    expect(facade.stale()).toBe(false);
    expect(facade.running()).toBe(false);
  });

  it('marks the result stale once a value changes after the run', async () => {
    await facade.load('a1', 2026);
    facade.scaleAll(2);
    await facade.run();

    facade.setValue('w2', 'outside', 10);
    expect(facade.stale()).toBe(true);
    expect(facade.result()).toBe(RESULT);

    facade.setValue('w2', 'outside', 0);
    expect(facade.stale()).toBe(false);
  });

  it('reset restores the Ist and drops the result', async () => {
    await facade.load('a1', 2026);
    facade.scaleAll(2);
    await facade.run();

    facade.reset();

    expect(facade.values()).toEqual({ w1: { inside: 1000, outside: 100 }, w2: { inside: 50, outside: 0 } });
    expect(facade.dirty()).toBe(false);
    expect(facade.result()).toBeNull();
    expect(facade.stale()).toBe(false);
  });

  it('passes the calculation state on to both calls', async () => {
    await facade.load('a1', 2026, 'c2');
    expect(api.adminCalculationSimulationBase).toHaveBeenCalledWith(
      expect.objectContaining({ calculationId: 'c2' }),
    );
    facade.scaleAll(2);
    await facade.run();
    expect(api.adminCalculationSimulate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ calculationId: 'c2' }) }),
    );
  });

  it('does nothing before an area is loaded', async () => {
    expect(await facade.run()).toBeNull();
    expect(api.adminCalculationSimulate).not.toHaveBeenCalled();
  });

  it('reports a rejected run as error and keeps the values', async () => {
    await facade.load('a1', 2026);
    facade.scaleAll(2);
    api.adminCalculationSimulate.mockReturnValue(
      throwError(() => ({ status: 400, error: { message: ['Unknown sources: x'] } })),
    );

    const result = await facade.run();

    expect(result).toBeNull();
    expect(facade.error()).toBe('Unknown sources: x');
    expect(facade.running()).toBe(false);
    expect(facade.values()['w1'].inside).toBe(2000);
    expect(facade.result()).toBeNull();
  });

  it('reports a failed load and maps a network failure to the translation key', async () => {
    api.adminCalculationSimulationBase.mockReturnValue(throwError(() => ({ status: 0 })));
    await facade.load('a1', 2026);
    expect(facade.error()).toBe('error.network');
    expect(facade.loading()).toBe(false);
    expect(facade.rows()).toEqual([]);
  });
});
