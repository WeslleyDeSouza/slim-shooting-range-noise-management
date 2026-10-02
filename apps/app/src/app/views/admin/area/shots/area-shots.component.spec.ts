import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type {
  UsageCombinationDto,
  UsageKpiDto,
  UsageResultDto,
  UsageRoomDto,
} from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { AreaFacade } from '../../../../core/area/area.facade';
import { SettingsFacade } from '../../../../core/settings/settings.facade';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { UsageFacade } from '../../../../core/usage/usage.facade';
import { AreaShotsComponent, minutesBetween } from './area-shots.component';
import { QuantityComponent } from './quantity.component';
import { SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { fakeSelectionLists } from '../../../../core/settings/selection-lists.testing';

/** Keys pass through; interpolation like the real pipe (`{{n}}`). */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    if (!params) return key;
    return Object.entries(params).reduce(
      (text, [k, v]) => text.replace(`{{${k}}}`, String(v)),
      key,
    );
  }
}

const AREA_ID = 'area-1';

const ROOMS: UsageRoomDto[] = [
  { id: 'r1', coordinationSectionNo: '1104.020.05', name: 'Stellungsrm Mw Neuhaus, B 3', groupName: 'Stellungsräume', enabled: true, usageCount: 2, shots: 1500, kg: 2.5 },
  { id: 'r2', coordinationSectionNo: '1104.020.07', name: 'Stellungsrm B 2', groupName: 'Stellungsräume', enabled: true, usageCount: 1, shots: 2400, kg: 0 },
  { id: 'r3', coordinationSectionNo: '1104.020.11', name: 'NGST Seeli C rechts', groupName: 'NGST', enabled: true, usageCount: 0, shots: 0, kg: 0 },
];

/** Zulässige Kombinationen je Stellungsraum (5.17); `c1` is the permanent combination «Stgw 90» allowed on two rooms. */
const COMBINATIONS: UsageCombinationDto[] = [
  { combinationId: 'c2', roomId: 'r1', entryName: 'Pz Hb 74 · 15.5 cm', name: 'Pz Hb 74 · 15.5 cm', weapon: 'Pz Hb 74', caliber: '15.5 cm Spr Gr', category: 'artillery', categoryName: 'Artillerie', annex7Category: null, quantityUnit: 'shots', quota: 1500, enabled: true },
  { combinationId: 'c1', roomId: 'r1', entryName: 'Stgw 90 · 5.6 mm', name: 'Stgw 90 · 5.6 mm', weapon: 'Stgw 90', caliber: '5.6 mm GP 90', category: 'handguns', categoryName: 'Handfeuerwaffen', annex7Category: 'a', quantityUnit: 'shots', quota: null, enabled: true },
  { combinationId: 'c1', roomId: 'r2', entryName: 'Stgw 90 · 5.6 mm', name: 'Stgw 90 · 5.6 mm', weapon: 'Stgw 90', caliber: '5.6 mm GP 90', category: 'handguns', categoryName: 'Handfeuerwaffen', annex7Category: 'a', quantityUnit: 'shots', quota: null, enabled: true },
  { combinationId: 'c3', roomId: 'r1', entryName: 'Sprengladung · kg', name: 'Sprengladung · kg', weapon: 'Sprengladung', caliber: 'Sprengstoff (kg)', category: 'artillery', categoryName: 'Artillerie', annex7Category: null, quantityUnit: 'kg', quota: null, enabled: true },
];

const pos = (id: string, combinationId: string, quantity: number, quantityUnit: 'shots' | 'kg' = 'shots') => {
  const c = COMBINATIONS.find((x) => x.combinationId === combinationId) as UsageCombinationDto;
  return { id, combinationId, name: c.entryName, weapon: c.weapon, caliber: c.caliber, category: c.category, quantity, quantityUnit };
};

const USAGES: UsageResultDto[] = [
  { id: 'u1', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, positions: [pos('p1', 'c2', 500)], weaponName: 'Pz Hb 74 · 15.5 cm', category: 'artillery', unit: 'K1', date: '2026-05-05', timeFrom: '11:00', timeTo: '15:00', usageType: 'military', civilUsageKind: null, personCount: 40, shots: 500, kg: 0, recordedBy: 'Lt Meier Fiona', source: 'manual', externalId: null, note: null, updatedAt: '2026-05-05T15:00:00.000Z' },
  { id: 'u2', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, positions: [pos('p2', 'c1', 1000), pos('p3', 'c3', 2.5, 'kg')], weaponName: 'Stgw 90 · 5.6 mm, Sprengladung · kg', category: 'handguns', unit: 'Inf Bat 12', date: '2026-06-17', timeFrom: '08:00', timeTo: '11:30', usageType: 'military', civilUsageKind: null, personCount: 80, shots: 1000, kg: 2.5, recordedBy: 'Hptm Roth Beat', source: 'manual', externalId: null, note: null, updatedAt: '2026-06-17T12:00:00.000Z' },
  { id: 'u3', areaId: AREA_ID, roomId: 'r2', roomName: ROOMS[1].name, positions: [pos('p4', 'c1', 2400)], weaponName: 'Stgw 90 · 5.6 mm', category: 'handguns', unit: 'Schützenverein Geissalp', date: '2026-06-21', timeFrom: '13:30', timeTo: '17:00', usageType: 'civil', civilUsageKind: 'obligatory', personCount: 22, shots: 2400, kg: 0, recordedBy: 'ELO-Import', source: 'elo', externalId: 'ELO-2026-1104-00001', note: null, updatedAt: '2026-06-21T17:00:00.000Z' },
];

const KPI: UsageKpiDto = { year: 2026, totalShots: 3900, totalKg: 2.5, count: 3, civilSharePercent: 62, lastDate: '2026-06-21', years: [2026, 2025] };

/** Sperrdatum der Schusszahlenerfassung as the erweiterte Konfiguration (B1 5.28) delivers it. */
const lockDate = signal<string | null>(null);

describe('AreaShotsComponent', () => {
  afterEach(() => lockDate.set(null));

  let fixture: ComponentFixture<AreaShotsComponent>;
  let facade: {
    kpi: ReturnType<typeof signal<UsageKpiDto | null>>;
    rooms: ReturnType<typeof signal<UsageRoomDto[]>>;
    combinations: ReturnType<typeof signal<UsageCombinationDto[]>>;
    usages: ReturnType<typeof signal<UsageResultDto[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    load: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    updateUsage: jest.Mock;
    remove: jest.Mock;
    restore: jest.Mock;
  };
  /** What the export button hands to the API. */
  let exportFacade: { download: jest.Mock };
  /** The query of the address (`?usage=<id>`) and what the page writes back to it. */
  let query$: BehaviorSubject<{ get: (key: string) => string | null }>;
  let router: { navigate: jest.Mock };
  const address = (usage: string | null) => ({ get: (key: string) => (key === 'usage' ? usage : null) });

  const el = () => fixture.nativeElement as HTMLElement;
  /** Let pending promises settle without waiting for the 6 s toast timer. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  const rows = () => el().querySelectorAll('[data-testid="shots-row"]');

  beforeEach(async () => {
    facade = {
      kpi: signal<UsageKpiDto | null>(KPI),
      rooms: signal<UsageRoomDto[]>(ROOMS),
      combinations: signal<UsageCombinationDto[]>(COMBINATIONS),
      usages: signal<UsageResultDto[]>(USAGES),
      loading: signal(false),
      saving: signal(false),
      error: signal<string | null>(null),
      load: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(USAGES[0]),
      updateUsage: jest.fn().mockResolvedValue(USAGES[0]),
      remove: jest.fn().mockResolvedValue(['u1']),
      restore: jest.fn().mockResolvedValue(['u1']),
    };
    exportFacade = { download: jest.fn().mockResolvedValue(true) };
    query$ = new BehaviorSubject(address(null));
    router = { navigate: jest.fn().mockResolvedValue(true) };

    // The area id lives on the parent route (`/admin/area/:id/shots`).
    const paramMap = { get: (k: string) => (k === 'id' ? AREA_ID : null) };
    const parentRoute = { paramMap: of(paramMap), snapshot: { paramMap } };

    await TestBed.configureTestingModule({
      imports: [AreaShotsComponent],
      providers: [
        { provide: UsageFacade, useValue: facade },
        { provide: SettingsFacade, useValue: { usageLockDate: lockDate } },
        { provide: SelectionListsFacade, useValue: fakeSelectionLists() },
        { provide: TableExportFacade, useValue: exportFacade },
        // Keys pass through, as in the pipe stub.
        { provide: TranslateService, useValue: { translate: (key: string) => key, lang: 'de' } },
        { provide: AreaFacade, useValue: { byId: () => ({ id: AREA_ID, name: 'Geissalp', coordinationSectionNo: '1104.020' }) } },
        { provide: ActivatedRoute, useValue: { parent: parentRoute, paramMap: of(paramMap), queryParamMap: query$, snapshot: parentRoute.snapshot } },
        { provide: Router, useValue: router },
      ],
    })
      .overrideComponent(AreaShotsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .overrideComponent(TableExportComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .overrideComponent(QuantityComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AreaShotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the area for the current year and shows the KPIs', () => {
    expect(facade.load).toHaveBeenCalledWith(AREA_ID, new Date().getFullYear());
    expect(el().querySelector('[data-testid="shots-kpi-total"]')?.textContent).toContain('3');
    expect(el().querySelector('[data-testid="shots-kpi-total"]')?.textContent).toContain('900');
    expect(el().querySelector('[data-testid="shots-kpi-count"]')?.textContent?.trim()).toBe('3');
    expect(el().textContent).toContain('62 %');
    expect(el().textContent).toContain('21.06.2026');
  });

  it('renders one row per usage, newest first, with the ELO badge', () => {
    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Schützenverein Geissalp');
    expect(el().querySelectorAll('[data-testid="shots-src-elo"]').length).toBe(1);
    expect(el().querySelector('[data-testid="shots-foot-count"]')?.textContent).toContain('shots.foot_count');
  });

  it('filters by room from the room list', () => {
    const items = el().querySelectorAll<HTMLButtonElement>('[data-testid="shots-room"]');
    // "Alle", then the three rooms in list order.
    expect(items.length).toBe(4);
    items[2].click(); // Stellungsrm B 2
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Stellungsrm B 2');
    items[0].click();
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  it('filters by search text, usage type and category', () => {
    const search = el().querySelector<HTMLInputElement>('[data-testid="shots-search"]') as HTMLInputElement;
    search.value = 'roth';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Inf Bat 12');

    search.value = '';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const chips = el().querySelectorAll<HTMLButtonElement>('.slim-chip');
    // Chips: the four Nutzungskategorien (military, civil, blue_light, sat), then the weapon categories.
    chips[1].click(); // civil
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    chips[1].click();
    chips[4].click(); // artillery
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Pz Hb 74');
  });

  it('groups by room when sorted by room', () => {
    const th = el().querySelectorAll<HTMLElement>('.shots__th')[0];
    th.click();
    fixture.detectChanges();
    const groups = el().querySelectorAll('.shots__group');
    expect(groups.length).toBe(2);
    expect(groups[0].textContent).toContain('Stellungsrm');
  });

  it('freezes the usages up to and including the Sperrdatum (B1 5.28)', async () => {
    const rows = () => Array.from(el().querySelectorAll<HTMLElement>('[data-testid="shots-row"]'));
    expect(el().querySelector('[data-testid="shots-lock-notice"]')).toBeNull();
    expect(el().querySelectorAll('[data-testid="shots-edit"]')).toHaveLength(3);

    // Usages of 05.05., 17.06. and 21.06.2026: a Sperrdatum of 17.06. freezes the first two.
    lockDate.set('2026-06-17');
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="shots-lock-notice"]')?.textContent).toContain('shots.lock_notice');
    expect(rows().map((r) => r.getAttribute('data-locked'))).toEqual([null, 'true', 'true']); // newest first
    expect(el().querySelectorAll('[data-testid="shots-edit"]')).toHaveLength(1);
    expect(el().querySelectorAll('[data-testid="shots-delete"]')).toHaveLength(1);
    expect(el().querySelectorAll('[data-testid="shots-locked"]')).toHaveLength(2);
    const boxes = rows().map((r) => r.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled);
    expect(boxes).toEqual([false, true, true]);

    // The entry form starts the day after the Sperrdatum and refuses a date in the locked period.
    el().querySelector<HTMLButtonElement>('[data-testid="shots-new"]')?.click();
    fixture.detectChanges();
    const date = el().querySelector<HTMLInputElement>('#shots-date') as HTMLInputElement;
    expect(date.getAttribute('min')).toBe('2026-06-18');
    date.value = '2026-06-17';
    date.dispatchEvent(new Event('input'));
    el().querySelector<HTMLButtonElement>('[data-testid="shots-save"]')?.click();
    await settle();
    expect(el().querySelector('[data-testid="shots-date-error"]')?.textContent).toContain('shots.form.err_locked');
    expect(facade.create).not.toHaveBeenCalled();
  });

  it('opens the drawer and blocks an empty save', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="shots-new"]')?.click();
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="shots-drawer"]')).toBeTruthy();

    el().querySelector<HTMLButtonElement>('[data-testid="shots-save"]')?.click();
    await settle();
    expect(facade.create).not.toHaveBeenCalled();
    expect(el().querySelectorAll('.slim-field--invalid').length).toBeGreaterThan(3);
  });

  it('saves a valid usage and closes the drawer', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="shots-new"]')?.click();
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: { controls: Record<string, { setValue(v: unknown): void; at?(i: number): { controls: Record<string, { setValue(v: unknown): void }> } }> };
      addPosition(): void;
      save(): Promise<void>;
    };
    component.form.controls['roomId'].setValue('r1');
    component.form.controls['unit'].setValue('K1');
    component.form.controls['date'].setValue('2026-09-11');
    component.form.controls['timeFrom'].setValue('08:00');
    component.form.controls['timeTo'].setValue('11:30');
    component.form.controls['personCount'].setValue(12);
    const positions = component.form.controls['positions'] as unknown as { at(i: number): { controls: Record<string, { setValue(v: unknown): void }> } };
    positions.at(0).controls['category'].setValue('handguns');
    positions.at(0).controls['combinationId'].setValue('c1');
    positions.at(0).controls['quantity'].setValue(120);
    // A second line of the same Nutzung: the explosive in kg (B1 11.2.3 Multi-Eintrag, Dezimalmenge).
    component.addPosition();
    positions.at(1).controls['combinationId'].setValue('c3');
    positions.at(1).controls['quantity'].setValue(1.5);
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid="shots-position"]').length).toBe(2);
    expect(el().querySelectorAll('[data-testid="shots-unit"]')[1].textContent).toContain('shots.unit_kg');
    await component.save();
    await settle();
    expect(facade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r1',
        timeFrom: '08:00',
        timeTo: '11:30',
        usageType: 'military',
        personCount: 12,
        civilUsageKind: null,
        positions: [
          { combinationId: 'c1', quantity: 120 },
          { combinationId: 'c3', quantity: 1.5 },
        ],
      }),
    );
    expect(el().querySelector('[data-testid="shots-drawer"]')).toBeNull();
    expect(el().querySelector('[data-testid="shots-toast"]')?.textContent).toContain('shots.toast.created');
  });

  it('opens a usage for editing with its Stellungsraum, category and Waffe/Kaliber preselected, and saves a changed quantity', async () => {
    // u2 (Inf Bat 12, 17.06.2026): two positions on r1 — Stgw 90 (1000 Schuss) and Sprengladung (2.5 kg).
    const row = Array.from(rows()).find((r) => r.textContent?.includes('Inf Bat 12')) as HTMLElement;
    row.querySelector<HTMLButtonElement>('[data-testid="shots-edit"]')?.click();
    fixture.detectChanges();
    await settle();

    const component = fixture.componentInstance as unknown as {
      form: { getRawValue(): { roomId: string; positions: { category: string; combinationId: string; quantity: number }[] } };
      positions: { at(i: number): { controls: Record<string, { setValue(v: unknown): void }> } };
      save(): Promise<void>;
    };
    // The form model carries the stored positions …
    expect(component.form.getRawValue().roomId).toBe('r1');
    expect(component.form.getRawValue().positions).toEqual([
      { category: 'handguns', combinationId: 'c1', quantity: 1000 },
      { category: 'artillery', combinationId: 'c3', quantity: 2.5 },
    ]);
    // … and the selects show them (not «Bitte wählen»).
    const lines = el().querySelectorAll('[data-testid="shots-position"]');
    expect(lines.length).toBe(2);
    const selects = (line: Element) => Array.from(line.querySelectorAll<HTMLSelectElement>('select'));
    expect(selects(lines[0]).map((x) => x.value)).toEqual(['handguns', 'c1']);
    expect(selects(lines[1]).map((x) => x.value)).toEqual(['artillery', 'c3']);
    expect(selects(lines[0])[1].selectedOptions[0].textContent?.trim()).toBe('Stgw 90 · 5.6 mm');

    // Changing only the quantity saves without touching the Waffe/Kaliber.
    component.positions.at(0).controls['quantity'].setValue(1200);
    fixture.detectChanges();
    await component.save();
    await settle();
    expect(facade.create).not.toHaveBeenCalled();
    expect(facade.updateUsage).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        roomId: 'r1',
        positions: [
          { combinationId: 'c1', quantity: 1200 },
          { combinationId: 'c3', quantity: 2.5 },
        ],
      }),
    );
  });

  it('marks a range of usages with Shift + click (B1 5.5.3)', () => {
    const boxes = () => Array.from(el().querySelectorAll<HTMLInputElement>('[data-testid="shots-row"] input[type="checkbox"]'));
    expect(boxes().length).toBeGreaterThanOrEqual(3);
    boxes()[0].click();
    boxes()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    fixture.detectChanges();
    expect(boxes().slice(0, 3).map((box) => box.checked)).toEqual([true, true, true]);
    expect(el().querySelectorAll('[data-testid="shots-row"].slim-table__row--selected')).toHaveLength(3);
  });

  it('names the violated rule of the Zeitraum: missing, off the quarter hour, «Bis» not after «Von»', () => {
    el().querySelector<HTMLButtonElement>('[data-testid="shots-new"]')?.click();
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as { form: { controls: Record<string, { setValue(v: unknown): void }> } };
    const times = (from: string, to: string): string => {
      component.form.controls['timeFrom'].setValue(from);
      component.form.controls['timeTo'].setValue(to);
      el().querySelector<HTMLButtonElement>('[data-testid="shots-save"]')?.click();
      fixture.detectChanges();
      const error = el().querySelector('[data-testid="shots-time-error"]');
      // The text only shows while the field is marked invalid.
      expect(error?.closest('.slim-field')?.classList.contains('slim-field--invalid')).toBe(true);
      return error?.textContent?.trim() ?? '';
    };
    expect(times('', '')).toBe('shots.form.err_time_required');
    // 11:30 is after 08:07: the quarter hour is the rule that is violated.
    expect(times('08:07', '11:30')).toBe('shots.form.err_time_quarter');
    expect(times('11:30', '08:00')).toBe('shots.form.err_time');
    expect(facade.create).not.toHaveBeenCalled();
  });

  it('requires the civil kind for «Zivil» and rejects times off the quarter hour', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="shots-new"]')?.click();
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: { controls: Record<string, { setValue(v: unknown): void }>; hasError(e: string): boolean; invalid: boolean };
      save(): Promise<void>;
    };
    component.form.controls['roomId'].setValue('r2');
    component.form.controls['unit'].setValue('Verein');
    component.form.controls['date'].setValue('2026-09-12');
    component.form.controls['timeFrom'].setValue('08:10');
    component.form.controls['timeTo'].setValue('11:00');
    component.form.controls['usageType'].setValue('civil');
    const positions = component.form.controls['positions'] as unknown as { at(i: number): { controls: Record<string, { setValue(v: unknown): void }> } };
    positions.at(0).controls['combinationId'].setValue('c1');
    positions.at(0).controls['quantity'].setValue(300);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="shots-civil-kind"]')).toBeTruthy();
    expect(component.form.hasError('civilKind')).toBe(true);
    await component.save();
    expect(facade.create).not.toHaveBeenCalled();
    component.form.controls['civilUsageKind'].setValue('field_shooting');
    component.form.controls['timeFrom'].setValue('08:15');
    await component.save();
    expect(facade.create).toHaveBeenCalledWith(expect.objectContaining({ civilUsageKind: 'field_shooting', timeFrom: '08:15' }));
  });

  describe('export of the table (B1 5.5.5, slm 3)', () => {
    const exportAs = async (format: 'xlsx' | 'csv'): Promise<TableExportData> => {
      (el().querySelector('[data-testid="shots-export"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (el().querySelector(`[data-testid="shots-export-${format}"]`) as HTMLButtonElement).click();
      await settle();
      expect(exportFacade.download).toHaveBeenLastCalledWith(expect.anything(), format);
      return exportFacade.download.mock.calls.at(-1)[0] as TableExportData;
    };
    const column = (data: TableExportData, header: string) => data.rows.map((row) => row[data.header.indexOf(header)]);

    it('holds every usage shown, in the order of the table, with all its attributes', async () => {
      const data = await exportAs('xlsx');
      expect(data.table).toBe('schusszahlen');
      expect(data.subtitle).toBe('1104.020 Geissalp');
      expect(data.selection).toBe(false);
      expect(data.header).toEqual([
        'shots.columns.room', 'shots.columns.unit', 'shots.export.date', 'shots.form.from', 'shots.form.to', 'shots.columns.type', 'shots.form.civil_kind',
        'shots.columns.category', 'shots.columns.weapon', 'shots.columns.shots', 'shots.columns.kg', 'shots.form.persons', 'shots.columns.recorded_by', 'shots.export.source',
      ]);
      // Newest first, as the table is sorted.
      expect(column(data, 'shots.columns.unit')).toEqual(['Schützenverein Geissalp', 'Inf Bat 12', 'K1']);
      expect(data.rows[0]).toEqual([
        'Stellungsrm B 2', 'Schützenverein Geissalp', '21.06.2026', '13:30', '17:00', 'shots.type.civil', 'obligatory (DE)',
        'shots.category.handguns', 'Stgw 90 · 5.6 mm', 2400, 0, 22, 'ELO-Import', 'shots.export.source_elo',
      ]);
      // A usage with Schuss and Sprengstoff: one column per unit, never one sum.
      expect(data.rows[1].slice(9, 11)).toEqual([1000, 2.5]);
      expect(data.rows[2][6]).toBeNull();
    });

    it('follows the filters and the sorting of the table and names the filters', async () => {
      const search = el().querySelector<HTMLInputElement>('[data-testid="shots-search"]') as HTMLInputElement;
      search.value = 'stgw';
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      el().querySelectorAll<HTMLButtonElement>('.slim-chip')[0].click(); // military
      fixture.detectChanges();

      const data = await exportAs('csv');
      expect(column(data, 'shots.columns.unit')).toEqual(['Inf Bat 12']);
      expect(data.filters).toEqual(
        expect.arrayContaining([
          { label: 'shots.export.search', value: 'stgw' },
          { label: 'shots.columns.type', value: 'shots.type.military' },
        ]),
      );
      // The date range of the year is always a filter of this table.
      expect(data.filters?.map((f) => f.label)).toEqual(expect.arrayContaining(['shots.date_from', 'shots.date_to']));
      expect(data.filters?.some((f) => f.label === 'shots.columns.category')).toBe(false);
    });

    it('holds only the marked usages when some are marked (B1 5.5.3)', async () => {
      const boxes = Array.from(rows()).map((r) => r.querySelector<HTMLInputElement>('input[type="checkbox"]') as HTMLInputElement);
      // Mark the newest and the oldest usage.
      for (const box of [boxes[0], boxes[2]]) box.click();
      fixture.detectChanges();

      const data = await exportAs('xlsx');
      expect(data.selection).toBe(true);
      expect(column(data, 'shots.columns.unit')).toEqual(['Schützenverein Geissalp', 'K1']);
    });

    it('cannot be started when the table is empty', () => {
      const search = el().querySelector<HTMLInputElement>('[data-testid="shots-search"]') as HTMLInputElement;
      search.value = 'gibt es nicht';
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(rows().length).toBe(0);
      expect((el().querySelector('[data-testid="shots-export"]') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('sums per unit: Schuss and Kilogramm are never one number', () => {
    const parts = (host: Element | null) => ({
      shots: host?.querySelector('[data-unit="shots"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      kg: host?.querySelector('[data-unit="kg"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    });

    it('shows a usage with Schuss and Sprengstoff as two quantities', () => {
      // Row 1 is the usage of Inf Bat 12: 1000 Schuss Stgw 90 and 2.5 kg Sprengladung.
      const mixed = parts(rows()[1].querySelector('[data-testid="shots-quantity"]'));
      expect(mixed.shots).toMatch(/^1.?000 shots\.unit_shots$/);
      expect(mixed.kg).toBe('2.5 shots.unit_kg');
      // A usage in Schuss only names no kg.
      expect(parts(rows()[0].querySelector('[data-testid="shots-quantity"]'))).toEqual({ shots: expect.stringMatching(/^2.?400 shots\.unit_shots$/), kg: null });
    });

    it('sums the table per unit', () => {
      const foot = parts(el().querySelector('[data-testid="shots-foot-sum"]'));
      // 500 + 1000 + 2400 Schuss; the 2.5 kg are not part of that sum.
      expect(foot.shots).toMatch(/^3.?900 shots\.unit_shots$/);
      expect(foot.kg).toBe('2.5 shots.unit_kg');
    });

    it('shows the Sprengstoff of the year as a KPI of its own, only when there is some', () => {
      expect(el().querySelector('[data-testid="shots-kpi-total"]')?.textContent?.replace(/\D/g, '')).toBe('3900');
      expect(el().querySelector('[data-testid="shots-kpi-kg"]')?.textContent).toContain('2.5');
      facade.kpi.set({ ...KPI, totalKg: 0 });
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="shots-kpi-kg"]')).toBeNull();
    });

    it('sums the groups of the room view per unit', () => {
      const headers = el().querySelectorAll<HTMLElement>('.shots__th');
      headers[0].click(); // sort by room
      fixture.detectChanges();
      const groups = Array.from(el().querySelectorAll('.shots__group')).map((g) => parts(g));
      expect(groups).toEqual([
        { shots: expect.stringMatching(/^2.?400 /), kg: null },
        { shots: expect.stringMatching(/^1.?500 /), kg: '2.5 shots.unit_kg' },
      ]);
    });
  });

  describe('a usage under its own address (B1 5.6, slm 5)', () => {
    const drawer = () => el().querySelector('[data-testid="shots-drawer"]');
    const openAddress = async (usage: string | null) => {
      query$.next(address(usage));
      fixture.detectChanges();
      await settle();
      await settle();
    };

    it('opens the usage the address names', async () => {
      expect(drawer()).toBeNull();
      await openAddress('u2');
      expect(drawer()).toBeTruthy();
      expect((el().querySelector('[formControlName="unit"]') as HTMLInputElement).value).toBe('Inf Bat 12');
      // The usage is in the list of the year: no extra request.
      expect(facade.find).not.toHaveBeenCalled();
    });

    it('writes the usage to the address when its drawer opens, and takes it out when the drawer closes', async () => {
      rows()[0].querySelector<HTMLButtonElement>('[data-testid="shots-edit"]')?.click();
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { usage: 'u3' }, queryParamsHandling: 'merge', replaceUrl: true }));

      // The router answers: the address now names the usage.
      await openAddress('u3');
      el().querySelector<HTMLButtonElement>('.slim-sheet__close')?.click();
      fixture.detectChanges();
      expect(drawer()).toBeNull();
      expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { usage: null } }));
      // A reload while the address still names the usage does not reopen it.
      facade.usages.set([...USAGES]);
      fixture.detectChanges();
      await settle();
      expect(drawer()).toBeNull();
    });

    it('switches to the year of a usage that is not in the year shown', async () => {
      const old: UsageResultDto = { ...USAGES[0], id: 'u-old', date: '2025-09-09' };
      facade.find.mockResolvedValue(old);
      facade.load.mockClear();
      await openAddress('u-old');
      expect(facade.find).toHaveBeenCalledWith(AREA_ID, 'u-old');
      expect(facade.load).toHaveBeenCalledWith(AREA_ID, 2025);
      // The list of 2025 arrives: the drawer opens with the usage.
      facade.usages.set([old]);
      fixture.detectChanges();
      await settle();
      expect(drawer()).toBeTruthy();
      expect((el().querySelector('[formControlName="date"]') as HTMLInputElement).value).toBe('2025-09-09');
    });

    it('says so when the address names a usage that does not exist here, and clears the address', async () => {
      await openAddress('gibt-es-nicht');
      expect(facade.find).toHaveBeenCalledTimes(1);
      expect(drawer()).toBeNull();
      expect(el().querySelector('[data-testid="shots-usage-missing"]')?.textContent).toContain('shots.usage_missing');
      expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { usage: null } }));
    });
  });

  it('asks before deleting and offers undo afterwards', async () => {
    el().querySelectorAll<HTMLButtonElement>('[data-testid="shots-delete"]')[0]?.click();
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="shots-delete-dialog"]')?.textContent).toContain('shots.delete.title_one');

    el().querySelector<HTMLButtonElement>('[data-testid="shots-delete-confirm"]')?.click();
    await settle();
    expect(facade.remove).toHaveBeenCalledWith(['u3']);
    expect(el().querySelector('[data-testid="shots-toast"]')?.textContent).toContain('shots.toast.deleted');

    el().querySelector<HTMLButtonElement>('[data-testid="shots-toast-undo"]')?.click();
    await settle();
    expect(facade.restore).toHaveBeenCalledWith(['u1']);
    expect(el().querySelector('[data-testid="shots-toast"]')).toBeNull();
  });
});

describe('minutesBetween', () => {
  it('returns the slot length in minutes and 0 when incomplete', () => {
    expect(minutesBetween('08:00', '11:30')).toBe(210);
    expect(minutesBetween('19:00', '22:00')).toBe(180);
    expect(minutesBetween('', '11:30')).toBe(0);
    expect(minutesBetween('12:00', '11:00')).toBe(-60);
  });
});
