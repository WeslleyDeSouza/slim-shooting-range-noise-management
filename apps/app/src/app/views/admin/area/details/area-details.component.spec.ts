import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AssessmentDto, MapPlantPartDto, ReceiverAssessmentDto } from '@ui-slim/apiClient';
import { FakeMap, provideFakeMap } from '@ui-slim/map';
import { AccessFacade } from '../../../../core/access/access.facade';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { AreaDetailsComponent } from './area-details.component';

const CALC_INITIAL = {
  id: 'calc-initial',
  externalId: '02218_1',
  name: 'Initiale Aufnahme',
  calculationId: 'delivery-1',
  calculationName: 'Empa 2019',
  supplier: 'Empa',
  deliveredAt: '2019-05-08',
  referenceYear: 2019,
  buildYearClass: 'mixed' as const,
  isCurrent: true,
  isMgdm: true,
  sourceCount: 16,
};
const CALC_SANITISED = { ...CALC_INITIAL, id: 'calc-saniert', name: 'Sanierter Zustand', deliveredAt: '2025-03-25', isCurrent: false, isMgdm: false };

function receiver(
  code: string,
  state: ReceiverAssessmentDto['state'],
  levels: [number | null, number | null, number | null, number | null],
  type: ReceiverAssessmentDto['type'] = 'facade',
): ReceiverAssessmentDto {
  const kinds = [
    [9, 'igw', 60],
    [9, 'pw', 55],
    [7, 'igw', 60],
    [7, 'pw', 55],
  ] as const;
  return {
    id: `id-${code}`,
    sonarmsId: code,
    code,
    egid: type === 'facade' ? '123' : null,
    address: `${code} Strasse 1`,
    municipality: 'Sigriswil',
    type,
    sensitivityLevel: 'II',
    east: null,
    north: null,
    height: 4,
    mapX: 30,
    mapY: 40,
    state,
    missingSources: [],
    rows: kinds.map(([annex, limitKind, limit], i) => ({
      annex,
      limitKind,
      limit,
      applicable: true,
      level: levels[i],
      state: levels[i] === null ? 'none' : levels[i] > limit ? 'over' : levels[i] > limit - 5 ? 'warn' : 'ok',
      reserve: levels[i] === null ? null : Math.round((limit - levels[i]) * 10) / 10,
      deltaToCurrent: null,
    })),
  };
}

const RECEIVERS = [
  receiver('E1', 'over', [60.8, 52.1, 49.1, null]),
  receiver('E2', 'ok', [54.2, 48.0, 44.0, null]),
  receiver('E6', 'none', [null, null, null, null], 'reserve'),
];

function assessment(overrides: Partial<AssessmentDto> = {}): AssessmentDto {
  return {
    areaId: 'area-1',
    calculation: CALC_INITIAL,
    current: CALC_INITIAL,
    calculations: [CALC_INITIAL, CALC_SANITISED],
    period: { from: '2026-01-01', to: '2026-12-31', years: 1, selectedYears: [] },
    counts: { total: 3, ok: 1, warn: 0, over: 1, none: 1, incomplete: 0 },
    receivers: RECEIVERS,
    operatingData: [],
    calculatedAt: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

class FacadeStub {
  readonly assessment = signal<AssessmentDto | null>(assessment());
  readonly receivers = signal<ReceiverAssessmentDto[]>(RECEIVERS);
  readonly calculations = signal(assessment().calculations);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn(async () => undefined);
  readonly select = jest.fn(async () => undefined);
}

class MapFacadeStub {
  readonly plantParts = signal<MapPlantPartDto[]>([]);
  readonly load = jest.fn(async () => undefined);
}

/** Rights of the signed-in user: the link to the Datenverwaltung only shows with access to it. */
const canOpenCalculations = signal(true);
const ACCESS_STUB = { can: () => canOpenCalculations };

const AREA_STUB = { byId: () => ({ id: 'area-1', name: 'Geissalp', coordinationSectionNo: '1104.020' }) };

/** What the export button hands to the API. */
const exportFacade = { download: jest.fn().mockResolvedValue(true) };

describe('AreaDetailsComponent', () => {
  let fixture: ComponentFixture<AreaDetailsComponent>;
  let facade: FacadeStub;

  beforeEach(async () => {
    facade = new FacadeStub();
    await TestBed.configureTestingModule({
      imports: [AreaDetailsComponent],
      providers: [
        { provide: AssessmentFacade, useValue: facade },
        { provide: MapFacade, useValue: new MapFacadeStub() },
        { provide: AreaFacade, useValue: AREA_STUB },
        { provide: AccessFacade, useValue: ACCESS_STUB },
        { provide: TableExportFacade, useValue: exportFacade },
        DataEmitter,
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => key,
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              paramMap: of(convertToParamMap({ id: 'area-1' })),
              snapshot: { paramMap: convertToParamMap({ id: 'area-1' }) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AreaDetailsComponent);
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T =>
    fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  it('exports the assessment: one line per Empfangspunkt and comparison, in the order of the list (B1 5.5.5)', async () => {
    exportFacade.download.mockClear();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[data-testid="details-export"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="details-export-xlsx"]') as HTMLButtonElement).click();
    await Promise.resolve();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(data.table).toBe('empfangspunkte');
    expect(data.subtitle).toBe('1104.020 Geissalp');
    expect(data.header).toHaveLength(9);
    // Every applicable comparison of every point is a line.
    expect(data.rows).toHaveLength(RECEIVERS.reduce((n, r) => n + Math.max(1, r.rows.filter((row) => row.applicable).length), 0));
    // The worst point comes first, as in the list; limit and level are numbers.
    expect(data.rows[0][0]).toBe('E1');
    expect(data.rows[0][3]).toBe('details.state.over');
    expect(typeof data.rows[0][5]).toBe('number');
    expect(data.rows[0][6]).toBe(60.8);
    expect(data.filters).toEqual(expect.arrayContaining([{ label: 'details.calc.basis', value: 'Initiale Aufnahme' }]));
  });

  it('says that the assessment compares the level rounded to whole dB (B1.2 10.4)', () => {
    const note = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="details-rounding"]');
    expect(note?.textContent).toContain('rounding_note');
  });

  it('loads the assessment of the parent route area once', fakeAsync(() => {
    tick(20); // ComponentBase calls getData() after 10 ms
    expect(facade.load).toHaveBeenCalledTimes(1);
    expect(facade.load).toHaveBeenCalledWith('area-1', {});
  }));

  it('renders the counts and one pin per receiver', () => {
    const counts = all('[data-testid="details-counts"] .slim-stat__value').map((e) => e.textContent?.trim());
    expect(counts).toEqual(['3', '1', '0', '1', '1']);
    const pins = all('[data-testid="details-pin"]');
    expect(pins).toHaveLength(3);
    expect(pins[0].className).toContain('slim-map__pin--over');
    expect(pins[0].className).toContain('slim-map__pin--active'); // first receiver preselected
    expect(pins[2].className).toContain('slim-map__pin--none');
  });

  it('shows the selected receiver in the aside and switches on pin click', () => {
    // The translate stub returns the key, so read the code from the pin badge.
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E1');
    expect(all('[data-testid="details-row"]')).toHaveLength(4);
    expect(all('[data-testid="details-row"]')[0].textContent).toContain('60.8');

    all('[data-testid="details-pin"]')[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E2');
    expect(all('[data-testid="details-row"]')[0].textContent).toContain('54.2');
    expect(all('[data-testid="details-pin"]')[1].className).toContain('slim-map__pin--active');
  });

  it('marks not applicable rows for a reserve point', () => {
    all('[data-testid="details-pin"]')[2].click();
    fixture.detectChanges();
    const rows = all('[data-testid="details-row"]');
    expect(rows.every((r) => r.textContent?.includes('details.not_applicable'))).toBe(true);
    expect(el('[data-testid="details-aside"]').textContent).toContain('details.receiver.egid_none');
  });

  it('toggles between map and list, list sorted worst first', () => {
    el<HTMLButtonElement>('[data-testid="details-list-toggle"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).toBeNull();
    const items = all('[data-testid="details-list-item"]');
    expect(items.map((i) => i.dataset['code'])).toEqual(['E1', 'E2', 'E6']);
    expect(items[0].dataset['state']).toBe('over');

    items[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E2');

    el<HTMLButtonElement>('[data-testid="details-map-toggle"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).not.toBeNull();
  });

  it('reloads with the chosen calculation state', fakeAsync(() => {
    tick(20);
    facade.load.mockClear();
    const select = el<HTMLSelectElement>('[data-testid="details-calc-select"]');
    select.value = CALC_SANITISED.id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(facade.load).toHaveBeenCalledWith('area-1', { calculationId: CALC_SANITISED.id });
  }));

  it('uses three representative years, rejects duplicates and switches back to a date period', () => {
    const input = el<HTMLInputElement>('[data-testid="details-years"]');
    input.value = '2025, 2020, 2023';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(facade.load).toHaveBeenLastCalledWith('area-1', { years: '2020,2023,2025' });
    facade.load.mockClear();
    input.value = '2020, 2020, 2025';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(facade.load).not.toHaveBeenCalled();
    const date = el<HTMLInputElement>('input[type="date"]');
    date.value = '2022-01-01';
    date.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(facade.load).toHaveBeenLastCalledWith('area-1', { from: '2022-01-01' });
    expect(input.value).toBe('');
  });

  it('shows the delta and the note when another state is viewed', () => {
    const other = assessment({
      calculation: CALC_SANITISED,
      receivers: RECEIVERS.map((r) => ({
        ...r,
        rows: r.rows.map((row) => ({ ...row, deltaToCurrent: row.level === null ? null : -4.4 })),
      })),
    });
    facade.assessment.set(other);
    facade.receivers.set(other.receivers);
    fixture.detectChanges();
    expect(el('.details__note').className).toContain('details__note--other');
    expect(all('[data-testid="details-delta"]').length).toBeGreaterThan(0);
    expect(all('[data-testid="details-delta"]')[0].textContent).toContain('-4.4');
    // The selection survived the reload.
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E1');
  });

  it('explains a missing calculation basis', () => {
    facade.assessment.set(assessment({ calculation: null, current: null, calculations: [], receivers: [] }));
    facade.receivers.set([]);
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('details.no_calculation.text');
    // … and leads straight to where a calculation is imported.
    expect(el<HTMLAnchorElement>('[data-testid="details-to-calculations"]').getAttribute('href')).toBe(
      '/admin/data-management/area/area-1/calculations',
    );
  });

  it('does not offer the link to the Datenverwaltung without the right to open it', () => {
    canOpenCalculations.set(false);
    facade.assessment.set(assessment({ calculation: null, current: null, calculations: [], receivers: [] }));
    facade.receivers.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('details.no_calculation.text');
    expect(el('[data-testid="details-to-calculations"]')).toBeNull();
    canOpenCalculations.set(true);
  });
});

describe('AreaDetailsComponent — GIS-Kartenviewer (slm 2)', () => {
  let fixture: ComponentFixture<AreaDetailsComponent>;
  let facade: FacadeStub;
  let maps: MapFacadeStub;
  let fakeMap: FakeMap;

  /** The receivers of the suite with LV95 coordinates, E6 without (as a delivery may leave them out). */
  const LOCATED: ReceiverAssessmentDto[] = [
    { ...RECEIVERS[0], east: 2618180, north: 1176916 },
    { ...RECEIVERS[1], east: 2618836, north: 1176894 },
    RECEIVERS[2],
  ];
  const PART: MapPlantPartDto = {
    id: 'part-1',
    roomId: 'room-1',
    coordinationSectionNo: '1104.020.07',
    name: 'Stellungsrm B 2',
    type: 'Schiessanlage (300m)',
    builtAfter1985: false,
    geometry: 'POLYGON((2618540 1176683, 2618620 1176683, 2618620 1176733, 2618540 1176733, 2618540 1176683))',
  };

  async function setup(options: { fail?: boolean } = {}): Promise<void> {
    facade = new FacadeStub();
    facade.receivers.set(LOCATED);
    facade.assessment.set(assessment({ receivers: LOCATED }));
    maps = new MapFacadeStub();
    maps.plantParts.set([PART]);
    fakeMap = provideFakeMap();
    fakeMap.fail = Boolean(options.fail);
    await TestBed.configureTestingModule({
      imports: [AreaDetailsComponent],
      providers: [
        { provide: AssessmentFacade, useValue: facade },
        { provide: MapFacade, useValue: maps },
        { provide: AreaFacade, useValue: AREA_STUB },
        { provide: AccessFacade, useValue: ACCESS_STUB },
        { provide: TableExportFacade, useValue: exportFacade },
        ...fakeMap.providers,
        DataEmitter,
        { provide: TranslateService, useValue: { translate: (key: string) => key, sectionChanged$: of(null), languageChanged$: of(null) } },
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap: of(convertToParamMap({ id: 'area-1' })), snapshot: { paramMap: convertToParamMap({ id: 'area-1' }) } } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreaDetailsComponent);
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const pins = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="details-pin"]'));

  it('shows the receivers with coordinates and the Anlagenteile of the state on the map', async () => {
    await setup();
    expect(el('slim-map-viewer[data-testid="details-map"]')).not.toBeNull();
    expect(el('[data-kind="schematic"]')).toBeNull();
    // The Anlagenteile are loaded for the area and the state the assessment shows.
    expect(maps.load).toHaveBeenCalledWith('area-1', 'calc-initial');
    expect(fakeMap.engine?.plantParts.map((p) => p.coordinationSectionNo)).toEqual(['1104.020.07']);
    expect(fakeMap.engine?.pins.map((p) => [p.east, p.north])).toEqual([
      [2618180, 1176916],
      [2618836, 1176894],
    ]);
    expect(pins().map((p) => p.textContent?.trim())).toEqual(['E1', 'E2']);
    expect(pins()[0].getAttribute('aria-label')).toBe('E1, details.state.over');
  });

  it('selects a receiver from its pin and shows it in the aside', async () => {
    await setup();
    expect(el('[data-testid="details-aside"]').textContent).toContain('E1 Strasse 1');
    pins()[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="details-aside"]').textContent).toContain('E2 Strasse 1');
    expect(pins()[1].classList).toContain('slim-map__pin--active');
  });

  it('links the Vollansicht of the shown state in a new tab (B1 5.10)', async () => {
    await setup();
    const link = el<HTMLAnchorElement>('[data-testid="details-fullscreen"]');
    expect(link.getAttribute('href')).toBe('/admin/area/area-1/map?state=calc-initial');
    expect(link.target).toBe('_blank');
    expect(el('[data-testid="map-fullscreen"]').getAttribute('href')).toBe('/admin/area/area-1/map?state=calc-initial');
  });

  it('falls back to the schematic map when the map library cannot be loaded', async () => {
    await setup({ fail: true });
    expect(el('slim-map-viewer')).toBeNull();
    expect(el('[data-kind="schematic"]')).not.toBeNull();
    // Every receiver is on the schematic map, also the one without coordinates.
    expect(pins().map((p) => p.textContent?.trim())).toEqual(['E1', 'E2', 'E6']);
    expect(el('[data-testid="details-fullscreen"]')).toBeNull();
  });
});
