import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaResultDto, AssessmentDto, AssessmentRowDto, MapPlantPartDto, QuotaOverviewDto, QuotaRowDto, ReceiverAssessmentDto } from '@ui-slim/apiClient';
import { provideFakeMap } from '@ui-slim/map';
import { AccessFacade } from '../../../../core/access/access.facade';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { QuotaFacade } from '../../../../core/calculation/quota.facade';
import { SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { fakeSelectionLists } from '../../../../core/settings/selection-lists.testing';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { AreaSummaryComponent } from './area-summary.component';

const AREA_ID = 'area-1';
const YEAR = new Date().getFullYear();

const AREA = {
  id: AREA_ID,
  name: 'Geissalp',
  coordinationSectionNo: '1104.020',
  classification: 'a',
  spmState: 'in_progress',
  noiseRemediationState: null,
  projectState: null,
  remediationProjectState: null,
  recalculationState: null,
  planningApproval: 'PGV 12.03.2021',
  quotaStatus: 'over',
  quotaStatusReason: 'no-quota',
  noiseStatus: 'warn',
  noiseStatusReason: null,
  noiseStatusBasis: 'Initiale Aufnahme',
  statusYear: YEAR,
} as unknown as AreaResultDto;

const quotaRow = (patch: Partial<QuotaRowDto>): QuotaRowDto => ({
  combinationId: 'c1',
  name: 'Stgw 90 · 5.6 mm',
  quantityUnit: 'shots',
  target: 2000,
  hasQuota: true,
  basis: 'Plangenehmigung',
  current: 1200,
  currentState: 'ok',
  average: 900,
  averageState: 'ok',
  ...patch,
});

const QUOTA: QuotaOverviewDto = {
  year: YEAR,
  fromYear: YEAR - 2,
  years: [YEAR, YEAR - 1],
  greenMaxPercent: 100,
  orangeMaxPercent: 125,
  status: 'over',
  reason: 'no-quota',
  rows: [
    quotaRow({ combinationId: 'c2', name: 'Pz Hb 74 · 15.5 cm', target: 1500, current: 1700, currentState: 'warn', average: 1400, averageState: 'ok' }),
    quotaRow({ combinationId: 'c3', name: 'Sprengladung · kg', quantityUnit: 'kg', target: 0, hasQuota: false, basis: null, current: 2.5, currentState: 'over', average: 0.833, averageState: 'over' }),
    quotaRow({}),
  ],
};

const row = (annex: 9 | 7, limit: number, level: number | null, state: AssessmentRowDto['state'], applicable = true): AssessmentRowDto => ({
  annex, limitKind: 'igw', limit, applicable, level, state, reserve: level === null ? null : limit - level, deltaToCurrent: null,
});

const receiver = (code: string, state: ReceiverAssessmentDto['state'], rows: AssessmentRowDto[], east: number | null, north: number | null): ReceiverAssessmentDto =>
  ({ id: code, code, address: `${code} Strasse 1`, municipality: null, egid: null, height: null, east, north, mapX: 0, mapY: 0, missingSources: [], sensitivityLevel: 'III', sonarmsId: code, state, type: 'facade', rows }) as ReceiverAssessmentDto;

/** E1: red after Anhang 7, but only orange after Anhang 9 — the map shows Anhang 9 (B1 5.10). */
const RECEIVERS = [
  receiver('E1', 'over', [row(9, 65, 62.4, 'warn'), row(7, 60, 61.2, 'over')], 2618180, 1176916),
  receiver('E2', 'ok', [row(9, 65, 51, 'ok'), row(7, 60, 44, 'ok', false)], 2618836, 1176894),
];

const CALCULATION = { id: 'calc-1', name: 'Initiale Aufnahme', isCurrent: true };

describe('AreaSummaryComponent — Schiessplatz-Nutzungen – Übersicht (B1 5.10, slm 9)', () => {
  let fixture: ComponentFixture<AreaSummaryComponent>;
  let area: ReturnType<typeof signal<AreaResultDto | null>>;
  let quotas: { overview: ReturnType<typeof signal<QuotaOverviewDto | null>>; loading: ReturnType<typeof signal<boolean>>; error: ReturnType<typeof signal<string | null>>; load: jest.Mock };
  let assessments: { assessment: ReturnType<typeof signal<AssessmentDto | null>>; receivers: ReturnType<typeof signal<ReceiverAssessmentDto[]>>; loading: ReturnType<typeof signal<boolean>>; load: jest.Mock };
  let maps: { plantParts: ReturnType<typeof signal<MapPlantPartDto[]>>; load: jest.Mock };
  let exportFacade: { download: jest.Mock };
  let fakeMap: ReturnType<typeof provideFakeMap>;
  const canOpenCalculations = signal(true);

  async function setup(options: { receivers?: ReceiverAssessmentDto[]; quota?: QuotaOverviewDto | null; failMap?: boolean } = {}): Promise<void> {
    const receivers = options.receivers ?? RECEIVERS;
    area = signal<AreaResultDto | null>(AREA);
    quotas = { overview: signal(options.quota === undefined ? QUOTA : options.quota), loading: signal(false), error: signal<string | null>(null), load: jest.fn().mockResolvedValue(undefined) };
    assessments = {
      assessment: signal(receivers.length ? ({ calculation: CALCULATION, receivers } as unknown as AssessmentDto) : null),
      receivers: signal(receivers),
      loading: signal(false),
      load: jest.fn().mockResolvedValue(undefined),
    };
    maps = { plantParts: signal<MapPlantPartDto[]>([]), load: jest.fn().mockResolvedValue(undefined) };
    exportFacade = { download: jest.fn().mockResolvedValue(true) };
    fakeMap = provideFakeMap();
    fakeMap.fail = Boolean(options.failMap);
    const params = convertToParamMap({ id: AREA_ID });

    await TestBed.configureTestingModule({
      imports: [AreaSummaryComponent],
      providers: [
        { provide: AreaFacade, useValue: { byId: () => area(), load: jest.fn().mockResolvedValue(undefined) } },
        { provide: QuotaFacade, useValue: quotas },
        { provide: AssessmentFacade, useValue: assessments },
        { provide: MapFacade, useValue: maps },
        { provide: SelectionListsFacade, useValue: fakeSelectionLists() },
        { provide: AccessFacade, useValue: { can: () => canOpenCalculations } },
        { provide: TableExportFacade, useValue: exportFacade },
        ...fakeMap.providers,
        DataEmitter,
        // Keys pass through; parameters are appended so a test can see them.
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => Object.entries(params ?? {}).reduce((text, [k, v]) => `${text} ${k}=${v}`, key),
            lang: 'de',
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
        { provide: ActivatedRoute, useValue: { parent: { paramMap: of(params), snapshot: { paramMap: params } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AreaSummaryComponent);
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const all = (testId: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('loads the Kontingentvergleich and the assessment of the current year on the current state', async () => {
    await setup();
    expect(quotas.load).toHaveBeenCalledWith(AREA_ID, null);
    expect(assessments.load).toHaveBeenCalledWith(AREA_ID, { from: `${YEAR}-01-01`, to: `${YEAR}-12-31` });
    // The Anlagenteile of the map belong to the state the assessment shows.
    expect(maps.load).toHaveBeenCalledWith(AREA_ID, 'calc-1');
  });

  it('shows the assessment: Klassierung and both lights with their reason', async () => {
    await setup();
    expect(text(el('summary-classification'))).not.toBe('');
    const quotaLight = el('summary-light-quota').querySelector('.slim-badge') as HTMLElement;
    expect(quotaLight.classList).toContain('slim-badge--danger');
    expect(quotaLight.getAttribute('data-reason')).toBe('no-quota');
    const noiseLight = el('summary-light-noise').querySelector('.slim-badge') as HTMLElement;
    expect(noiseLight.classList).toContain('slim-badge--warning');
  });

  it('shows the Stand SPM / MPV / Projekt from the Stammdaten, with the labels of the Auswahllisten', async () => {
    await setup();
    expect(all('summary-stand-spm_state')).toHaveLength(1);
    expect(text(el('summary-stand-spm_state'))).toBe('in_progress (DE)');
    // A field that is not recorded says so instead of staying empty.
    expect(text(el('summary-stand-project_state'))).toBe('summary.not_set');
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="summary-stand-"]')).toHaveLength(5);
  });

  it('compares every Waffe/Kaliber with its Kontingent: Soll, Ist of the year, Ø of three years, each with its colour', async () => {
    await setup();
    const rows = all('summary-quota-row');
    expect(rows).toHaveLength(3);
    expect(text(el('summary-approval'))).toContain('PGV 12.03.2021');

    // Pz Hb 74: 1700 of 1500 = 113 % → orange in the year, 1400 = 93 % → green in the mean.
    expect(text(rows[0])).toContain('Pz Hb 74 · 15.5 cm');
    expect(rows[0].getAttribute('data-current')).toBe('warn');
    expect(rows[0].getAttribute('data-average')).toBe('ok');
    expect(text(rows[0])).toContain('113 %');
    expect(text(rows[0])).toContain('93 %');
    const pills = Array.from(rows[0].querySelectorAll('.slim-badge')).map((b) => b.className);
    expect(pills[0]).toContain('slim-badge--warning');
    expect(pills[1]).toContain('slim-badge--success');

    // Sprengladung: used without a Kontingent → Soll 0, red, flagged, in kg and without a percentage.
    expect(rows[1].querySelector('[data-testid="summary-no-quota"]')).not.toBeNull();
    expect(rows[1].getAttribute('data-current')).toBe('over');
    expect(text(rows[1])).toContain('shots.unit_kg');
    expect(text(rows[1])).not.toContain('%');
    expect(rows[2].querySelector('[data-testid="summary-no-quota"]')).toBeNull();

    // The thresholds of the erweiterte Konfiguration are named below the table.
    expect(text(el('summary-quota-rule'))).toContain('green=100');
    expect(text(el('summary-quota-rule'))).toContain('orange=125');
  });

  it('loads another year of the comparison', async () => {
    await setup();
    const select = el<HTMLSelectElement>('summary-year');
    expect(Array.from(select.options).map((o) => o.value)).toEqual([String(YEAR), String(YEAR - 1)]);
    select.value = String(YEAR - 1);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(quotas.load).toHaveBeenLastCalledWith(AREA_ID, YEAR - 1);
  });

  it('says so when neither Kontingente nor usages exist', async () => {
    await setup({ quota: { ...QUOTA, status: 'none', reason: 'no-usages', rows: [] } });
    expect(all('summary-quota-row')).toHaveLength(0);
    expect(text(el('summary-quota-empty'))).toBe('summary.quota.empty');
    expect(el<HTMLButtonElement>('summary-export').disabled).toBe(true);
  });

  it('shows the Empfangspunkte on the map in the colour of Anhang 9, not of the overall state', async () => {
    await setup();
    expect(el('summary-map')).not.toBeNull();
    const pins = all('summary-pin');
    expect(pins.map((p) => p.textContent?.trim())).toEqual(['E1', 'E2']);
    // E1 is red after Anhang 7 but orange after Anhang 9.
    expect(pins[0].getAttribute('aria-label')).toBe('E1, details.state.warn');
    expect(all('summary-point').map((p) => p.getAttribute('data-state'))).toEqual(['warn', 'ok']);
    // The page says that the assessment rounds the level to whole dB.
    expect(text(el('summary-rounding'))).toContain('rounding_note');
    expect(el<HTMLAnchorElement>('map-fullscreen')?.getAttribute('href') ?? fixture.nativeElement.innerHTML).toContain('/admin/area/area-1/map?state=calc-1');
  });

  it('shows limit and level of a point in a pop-up: Anhang 9 and, where assessed, Anhang 7', async () => {
    await setup();
    all('summary-pin')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const popup = el('map-popup');
    expect(text(popup)).toContain('E1 · E1 Strasse 1');
    const lines = Array.from(popup.querySelectorAll('.asum__pop-row')).map((n) => [text(n.querySelector('span')), text(n.querySelector('b'))]);
    expect(lines).toEqual([
      ['summary.map.annex_9 · IGW 65 dB', '62.4 dB'],
      ['summary.map.annex_7 · IGW 60 dB', '61.2 dB'],
    ]);

    // E2 is not assessed after Anhang 7: only the row of Anhang 9.
    all('summary-pin')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el('map-popup').querySelectorAll('.asum__pop-row')).toHaveLength(1);
  });

  it('keeps the list of the Empfangspunkte when the map cannot be shown', async () => {
    await setup({ failMap: true });
    expect(el('summary-map')).toBeNull();
    expect(all('summary-point')).toHaveLength(2);
  });

  it('says so without a calculation and leads to the import for users who may open it', async () => {
    await setup({ receivers: [] });
    expect(el('summary-map')).toBeNull();
    expect(text(el('summary-map-card'))).toContain('details.no_calculation.title');
    expect(el<HTMLAnchorElement>('summary-to-calculations').getAttribute('href')).toContain('/admin/data-management/area/area-1/calculations');
    canOpenCalculations.set(false);
    fixture.detectChanges();
    expect(el('summary-to-calculations')).toBeNull();
    canOpenCalculations.set(true);
  });

  it('sorts the comparison by a column and exports only the marked rows (B1 5.5.2, 5.5.3)', async () => {
    await setup();
    const states = () => all('summary-quota-row').map((row) => row.getAttribute('data-current'));
    expect(states()).toEqual(['warn', 'over', 'ok']);
    // Ist of the year ascending: Sprengladung 2.5, Stgw 90 1'200, Pz Hb 74 1'700.
    (el('summary-sort-current').querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(states()).toEqual(['over', 'ok', 'warn']);
    expect(el('summary-sort-current').getAttribute('aria-sort')).toBe('ascending');

    // The first and the last row as shown are marked: the export holds these two, in this order.
    const boxes = all('summary-select');
    boxes[0].click();
    boxes[2].click();
    fixture.detectChanges();
    expect(all('summary-quota-row').map((row) => row.classList.contains('slim-table__row--selected'))).toEqual([true, false, true]);
    el('summary-export').click();
    fixture.detectChanges();
    expect(text(el('summary-export-scope'))).toContain('common.export.rows_selected n=2');
    el('summary-export-csv').click();
    for (let i = 0; i < 3; i++) await Promise.resolve();
    const calls = exportFacade.download.mock.calls;
    const data = calls[calls.length - 1][0] as TableExportData;
    expect(data.selection).toBe(true);
    expect(data.rows.map((row) => row[0])).toEqual(['Sprengladung · kg', 'Pz Hb 74 · 15.5 cm']);
  });

  it('exports the comparison as shown (B1 5.5.5)', async () => {
    await setup();
    el('summary-export').click();
    fixture.detectChanges();
    el('summary-export-xlsx').click();
    for (let i = 0; i < 3; i++) await Promise.resolve();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(data.table).toBe('kontingente_vergleich');
    expect(data.subtitle).toBe('1104.020 Geissalp');
    expect(data.header).toHaveLength(8);
    expect(data.rows).toHaveLength(3);
    // Sprengladung: unit, Soll 0, no Kontingent, Ist, colour, mean, colour.
    expect(data.rows[1]).toEqual(['Sprengladung · kg', 'shots.unit_kg', 0, 'common.no', 2.5, 'status_area.over', 0.833, 'status_area.over']);
    expect(data.filters).toEqual([
      { label: 'year', value: String(YEAR) },
      { label: 'summary.quota.approval', value: 'PGV 12.03.2021' },
    ]);
  });
});
