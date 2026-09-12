import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { SimulationBaseDto, SimulationResultDto } from '@ui-slim/apiClient';
import { SimulationFacade } from '../../../../core/calculation/simulation.facade';
import { AreaSimulationComponent } from './area-simulation.component';

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
      inside: 257857,
      outside: 26777,
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
      inside: 1240,
      outside: 0,
      hasLevels: false,
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
      current: 56.4,
      currentState: 'warn',
      incomplete: false,
    },
  ],
};

/** The facade as the page sees it: writable signals and spied methods. */
function mockFacade() {
  const base = signal<SimulationBaseDto | null>(BASE);
  const values = signal<Record<string, { inside: number; outside: number }>>({
    'r1|c1': { inside: 257857, outside: 26777 },
    'r1|c2': { inside: 1240, outside: 0 },
  });
  const result = signal<SimulationResultDto | null>(null);
  const changedCount = computed(() => {
    let n = 0;
    for (const row of base()?.rows ?? []) {
      const v = values()[`${row.roomId}|${row.combinationId}`];
      if (v.inside !== row.inside) n++;
      if (v.outside !== row.outside) n++;
    }
    return n;
  });
  return {
    base,
    rows: computed(() => base()?.rows ?? []),
    receivers: computed(() => base()?.receivers ?? []),
    values,
    result,
    changedCount,
    dirty: computed(() => changedCount() > 0),
    stale: signal(false),
    totals: computed(() => {
      const v = Object.values(values());
      return {
        inside: v.reduce((s, x) => s + x.inside, 0),
        outside: v.reduce((s, x) => s + x.outside, 0),
        baseInside: 259097,
        baseOutside: 26777,
      };
    }),
    loading: signal(false),
    running: signal(false),
    error: signal<string | null>(null),
    load: jest.fn().mockResolvedValue(undefined),
    setValue: jest.fn((id: string, key: 'inside' | 'outside', n: number) =>
      values.update((v) => ({ ...v, [id]: { ...v[id], [key]: n } })),
    ),
    scaleAll: jest.fn((f: number) =>
      values.update((v) =>
        Object.fromEntries(
          Object.entries(v).map(([id, x]) => [id, { inside: Math.round(x.inside * f), outside: Math.round(x.outside * f) }]),
        ),
      ),
    ),
    reset: jest.fn(),
    run: jest.fn().mockResolvedValue(null),
  };
}

describe('AreaSimulationComponent', () => {
  let fixture: ComponentFixture<AreaSimulationComponent>;
  let facade: ReturnType<typeof mockFacade>;

  beforeEach(async () => {
    jest.useFakeTimers();
    facade = mockFacade();
    const paramMap = convertToParamMap({ id: 'a1' });
    await TestBed.configureTestingModule({
      imports: [AreaSimulationComponent],
      providers: [
        { provide: SimulationFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap: of(paramMap), snapshot: { paramMap } }, paramMap: of(paramMap), snapshot: { paramMap } },
        },
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => key,
            sectionChanged$: new Subject<void>(),
            languageChanged$: new Subject<void>(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AreaSimulationComponent);
    fixture.detectChanges();
    // ComponentBase schedules getData() with a 10 ms timeout.
    jest.advanceTimersByTime(20);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const el = (testId: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));

  it('loads the area of the parent route through getData()', () => {
    expect(facade.load).toHaveBeenCalledTimes(1);
    expect(facade.load).toHaveBeenCalledWith('a1', new Date().getFullYear());
  });

  it('reloads when the year changes', () => {
    const select = fixture.nativeElement.querySelector('[data-testid="sim-year"]') as HTMLSelectElement;
    select.value = String(new Date().getFullYear() - 1);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(facade.load).toHaveBeenLastCalledWith('a1', new Date().getFullYear() - 1);
  });

  it('renders one row per room × weapon with formatted, read-only values', () => {
    const rows = el('sim-row');
    expect(rows).toHaveLength(2);
    expect(rows[1].classList).toContain('sim__row--muted');
    const inputs = el('sim-inside') as HTMLInputElement[];
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[0].value.replace(/\D/g, '')).toBe('257857');
    expect((el('sim-run')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((el('sim-reset')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the inputs and the quick buttons while editing', () => {
    el('sim-edit')[0].click();
    fixture.detectChanges();

    expect((el('sim-inside')[0] as HTMLInputElement).disabled).toBe(false);
    expect(el('sim-scale')).toHaveLength(5);
    expect(el('sim-scale').map((b) => b.dataset['factor'])).toEqual(['0.8', '0.9', '1.1', '1.2', '1.5']);
  });

  it('marks changed cells and enables run after a quick scale', () => {
    el('sim-edit')[0].click();
    fixture.detectChanges();
    el('sim-scale')[4].click(); // +50 %
    fixture.detectChanges();

    expect(facade.scaleAll).toHaveBeenCalledWith(1.5);
    const input = el('sim-inside')[0] as HTMLInputElement;
    expect(input.classList).toContain('slim-input--changed');
    expect(input.value.replace(/\D/g, '')).toBe('386786');
    expect(fixture.nativeElement.querySelector('.sim__delta').textContent).toContain('+50');
    expect((el('sim-run')[0] as HTMLButtonElement).disabled).toBe(false);
    expect(el('sim-state')[0].textContent).toContain('simulation.state.not_run');
  });

  it('parses a typed value and hands it to the facade', () => {
    el('sim-edit')[0].click();
    fixture.detectChanges();
    const input = el('sim-outside')[0] as HTMLInputElement;
    input.value = "30'000";
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(facade.setValue).toHaveBeenCalledWith('r1|c1', 'outside', 30000);
  });

  it('runs the simulation and shows the result table and ghost dots', async () => {
    facade.scaleAll(2);
    fixture.detectChanges();
    facade.run.mockImplementation(async () => {
      facade.result.set({
        areaId: 'a1',
        year: 2026,
        calculation: BASE.calculation,
        receivers: [{ ...BASE.receivers[0], simulated: 59.4, simulatedState: 'warn', delta: 3 }],
        counts: { total: 1, ok: 0, warn: 1, over: 0, none: 0, incomplete: 0 },
        totals: { inside: 518194, outside: 53554, baseInside: 259097, baseOutside: 26777 },
        calculatedAt: '2026-09-11T10:00:00.000Z',
      });
      return facade.result();
    });

    el('sim-run')[0].click();
    await facade.run.mock.results[0].value;
    fixture.detectChanges();

    expect(facade.run).toHaveBeenCalled();
    expect(el('sim-result-row')).toHaveLength(1);
    expect(el('sim-result-row')[0].textContent).toContain('+3');
    expect(fixture.nativeElement.querySelectorAll('.slim-map__ghost')).toHaveLength(1);
    expect(el('sim-pin')[0].classList).toContain('slim-map__pin--warn');
    expect(el('sim-state')[0].textContent).toContain('simulation.state.fresh');
  });

  it('opens the popover of a pin', () => {
    el('sim-pin')[0].click();
    fixture.detectChanges();
    const pop = fixture.nativeElement.querySelector('.slim-map__pop');
    expect(pop).not.toBeNull();
    expect(pop.textContent).toContain('E1');
    expect(pop.textContent).toContain('56.4');
  });
});
