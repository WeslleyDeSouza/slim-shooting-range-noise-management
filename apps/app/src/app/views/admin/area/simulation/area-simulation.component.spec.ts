import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { MapPlantPartDto, SimulationBaseDto, SimulationResultDto } from '@ui-slim/apiClient';
import { provideFakeMap } from '@ui-slim/map';
import { AreaFacade } from '../../../../core/area/area.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { SimulationFacade } from '../../../../core/calculation/simulation.facade';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
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
        insideKg: 12.5, outsideKg: 0, baseInsideKg: 12.5, baseOutsideKg: 0,
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

/** Anlagenteile of the state, as the map shows them. */
function mockMaps() {
  return { plantParts: signal<MapPlantPartDto[]>([]), load: jest.fn().mockResolvedValue(undefined) };
}
const AREAS = { byId: () => ({ id: 'a1', name: 'Geissalp', coordinationSectionNo: '1104.020' }) };

/** What the export buttons hand to the API. */
const exportFacade = { download: jest.fn().mockResolvedValue(true) };

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
        { provide: MapFacade, useValue: mockMaps() },
        { provide: AreaFacade, useValue: AREAS },
        { provide: TableExportFacade, useValue: exportFacade },
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

  it('shows kilograms separately and no schematic map without a calculation basis', () => {
    expect(fixture.nativeElement.querySelector('[data-unit="kg"]').textContent).toContain('12.5');
    facade.base.set({ ...BASE, calculation: null, receivers: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-kind="schematic"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Lattigen');
  });

  it('B03: changed quantities without a basis cannot produce success, a zero-exceedance result or a PDF', () => {
    facade.base.set({ ...BASE, calculation: null, receivers: [] });
    facade.scaleAll(1.5);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector<HTMLButtonElement>('[data-testid="sim-run"]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="sim-pdf"]')?.disabled).toBe(true);
    expect(host.querySelector('[data-testid="sim-no-basis"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="sim-state"]')?.textContent).toContain('simulation.no_calculation');
    expect(host.querySelector('[data-testid="sim-state"] .slim-badge--success')).toBeNull();
    expect(host.textContent).not.toContain('simulation.result_sub_over');
    expect(host.textContent).not.toContain('simulation.result_empty_dirty');
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
        receivers: [{ ...BASE.receivers[0], simulated: 59.4, simulatedState: 'over', delta: 3,
          simulatedRows: [
            { annex: 9, limitKind: 'igw', limit: 60, applicable: true, level: 59.4, state: 'warn', reserve: 0.6, deltaToCurrent: null },
            { annex: 9, limitKind: 'pw', limit: 55, applicable: true, level: 57, state: 'over', reserve: -2, deltaToCurrent: null },
          ],
        }],
        counts: { total: 1, ok: 0, warn: 0, over: 1, none: 0, incomplete: 0 },
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
    expect(el('sim-result-row')[0].textContent).toContain('IGW');
    expect(el('sim-result-row')[0].textContent).toContain('PW');
    expect(el('sim-result-row')[0].textContent).toContain('57');
    expect(fixture.nativeElement.querySelectorAll('.slim-map__ghost')).toHaveLength(1);
    expect(el('sim-pin')[0].classList).toContain('slim-map__pin--over');
    expect(el('sim-state')[0].textContent).toContain('simulation.state.fresh');
  });

  it('exports the Schusszahlen as shown: the Ist and the values the simulation runs with (B1 5.5.5)', async () => {
    exportFacade.download.mockClear();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[data-testid="sim-export"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="sim-export-csv"]') as HTMLButtonElement).click();
    await Promise.resolve();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(exportFacade.download).toHaveBeenCalledWith(data, 'csv');
    expect(data.table).toBe('simulation_schusszahlen');
    expect(data.header).toEqual([
      'simulation.columns.room', 'simulation.columns.room_no', 'simulation.columns.weapon', 'simulation.quantity_unit',
      'simulation.export.inside_current', 'simulation.export.inside_simulated', 'simulation.export.outside_current', 'simulation.export.outside_simulated',
    ]);
    expect(data.rows).toHaveLength(host.querySelectorAll('[data-testid="sim-row"]').length);
    // Nothing overridden yet: the simulated values are the Ist.
    for (const row of data.rows) {
      expect(row[5]).toBe(row[4]);
      expect(row[7]).toBe(row[6]);
      expect(typeof row[4]).toBe('number');
    }
    // The result is exported from its own button, which only exists once a simulation ran.
    expect(host.querySelector('[data-testid="sim-result-export"]')).toBeNull();
  });

  it('sorts the Schusszahlen by a column and exports only the marked rows (B1 5.5.2, 5.5.3)', async () => {
    exportFacade.download.mockClear();
    const host = fixture.nativeElement as HTMLElement;
    const weapons = () => el('sim-row').map((row) => (row.textContent?.includes('Pz Hb 74') ? 'Pz Hb 74' : 'Stgw 90'));
    expect(weapons()).toEqual(['Stgw 90', 'Pz Hb 74']);
    // Innerhalb Werktag ascending: 1'240 before 257'857.
    (host.querySelector('[data-testid="sim-sort-inside"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(weapons()).toEqual(['Pz Hb 74', 'Stgw 90']);

    (host.querySelector('[data-testid="sim-select"]') as HTMLInputElement).click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="sim-export"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="sim-export-csv"]') as HTMLButtonElement).click();
    await Promise.resolve();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(data.selection).toBe(true);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0][2]).toBe('Pz Hb 74 · 15.5 cm Spr Gr');
    // The total stays the total of all rows.
    expect(host.querySelector('.sim__foot')?.textContent).toContain('simulation.total_rows');
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

describe('AreaSimulationComponent — GIS-Kartenviewer (slm 2)', () => {
  let fixture: ComponentFixture<AreaSimulationComponent>;
  let facade: ReturnType<typeof mockFacade>;
  let maps: ReturnType<typeof mockMaps>;
  let fakeMap: ReturnType<typeof provideFakeMap>;

  /** The receiver of the suite, now with LV95 coordinates as a sonARMS delivery brings them. */
  const LOCATED: SimulationBaseDto = { ...BASE, receivers: [{ ...BASE.receivers[0], east: 2618180, north: 1176916 }] };

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function setup(options: { fail?: boolean } = {}): Promise<void> {
    facade = mockFacade();
    facade.base.set(LOCATED);
    maps = mockMaps();
    fakeMap = provideFakeMap();
    fakeMap.fail = Boolean(options.fail);
    const paramMap = convertToParamMap({ id: 'a1' });
    await TestBed.configureTestingModule({
      imports: [AreaSimulationComponent],
      providers: [
        { provide: SimulationFacade, useValue: facade },
        { provide: MapFacade, useValue: maps },
        { provide: AreaFacade, useValue: AREAS },
        { provide: TableExportFacade, useValue: exportFacade },
        ...fakeMap.providers,
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap: of(paramMap), snapshot: { paramMap } }, paramMap: of(paramMap), snapshot: { paramMap } },
        },
        {
          provide: TranslateService,
          useValue: { translate: (key: string) => key, sectionChanged$: new Subject<void>(), languageChanged$: new Subject<void>() },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreaSimulationComponent);
    await settle();
  }

  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const pins = () => all('[data-testid="sim-pin"]');

  it('shows the Empfangspunkte and the Anlagenteile of the state on the map', async () => {
    await setup();
    expect(all('slim-map-viewer[data-testid="sim-map"]')).toHaveLength(1);
    expect(all('[data-kind="schematic"]')).toHaveLength(0);
    expect(maps.load).toHaveBeenCalledWith('a1', 'c1');
    expect(fakeMap.engine?.pins.map((p) => [p.id, p.east, p.north])).toEqual([['e1', 2618180, 1176916]]);
    expect(pins().map((p) => p.textContent?.trim())).toEqual(['E1']);
    // Ist: the pin has the current state, no «before» dot.
    expect(pins()[0].classList).toContain('slim-map__pin--warn');
    expect(all('.slim-map__ghost')).toHaveLength(0);
  });

  it('colours the pin by the simulated state and keeps the Ist as a dot next to it', async () => {
    await setup();
    facade.result.set({
      areaId: 'a1',
      year: 2026,
      calculation: LOCATED.calculation,
      receivers: [{ id: 'e1', code: 'E1', current: 56.4, simulated: 60.8, delta: 4.4, limitKind: 'igw', limit: 60, simulatedState: 'over', incomplete: false, simulatedRows: [] }],
      counts: { total: 1, ok: 0, warn: 0, over: 1, none: 0, incomplete: 0 },
      totals: { inside: 518194, outside: 53554, baseInside: 259097, baseOutside: 26777 },
      calculatedAt: '2026-09-11T10:00:00.000Z',
    } as unknown as SimulationResultDto);
    await settle();
    expect(pins()[0].classList).toContain('slim-map__pin--over');
    const ghost = all('.slim-map__ghost');
    expect(ghost).toHaveLength(1);
    expect(ghost[0].classList).toContain('slim-map__ghost--warn');
    // The map keeps the dot at the coordinate of its point.
    expect(fakeMap.engine?.pins.map((p) => p.element.tagName)).toEqual(['BUTTON', 'SPAN']);
  });

  it('opens the popover of a pin on the map and closes it again', async () => {
    await setup();
    expect(all('[data-testid="map-popup"]')).toHaveLength(0);
    pins()[0].click();
    await settle();
    const popup = all('[data-testid="map-popup"]')[0];
    expect(popup.textContent).toContain('E1');
    expect(popup.textContent).toContain('56.4');
    expect(pins()[0].classList).toContain('slim-map__pin--active');
    (popup.querySelector('.sim__pop-close') as HTMLButtonElement).click();
    await settle();
    expect(all('[data-testid="map-popup"]')).toHaveLength(0);
  });

  it('falls back to the schematic map when the map library cannot be loaded', async () => {
    await setup({ fail: true });
    expect(all('slim-map-viewer')).toHaveLength(0);
    expect(all('[data-kind="schematic"]')).toHaveLength(1);
    expect(all('[data-kind="schematic"]')[0].textContent).toContain('simulation.schematic');
    expect(all('[data-kind="schematic"] svg')[0].textContent).not.toMatch(/Lattigen|Laberhus|SPM/);
    expect(pins().map((p) => p.textContent?.trim())).toEqual(['E1']);
  });
});
