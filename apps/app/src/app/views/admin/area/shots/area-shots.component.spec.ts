import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type {
  UsageCombinationDto,
  UsageKpiDto,
  UsageResultDto,
  UsageRoomDto,
} from '@ui-slim/apiClient';
import { AreaFacade } from '../../../../core/area/area.facade';
import { UsageFacade } from '../../../../core/usage/usage.facade';
import { AreaShotsComponent, minutesBetween } from './area-shots.component';

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
  { id: 'r1', coordinationSectionNo: '1104.020.05', name: 'Stellungsrm Mw Neuhaus, B 3', groupName: 'Stellungsräume', enabled: true, usageCount: 2, shots: 1500 },
  { id: 'r2', coordinationSectionNo: '1104.020.07', name: 'Stellungsrm B 2', groupName: 'Stellungsräume', enabled: true, usageCount: 1, shots: 2400 },
  { id: 'r3', coordinationSectionNo: '1104.020.11', name: 'NGST Seeli C rechts', groupName: 'NGST', enabled: true, usageCount: 0, shots: 0 },
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
  { id: 'u1', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, positions: [pos('p1', 'c2', 500)], weaponName: 'Pz Hb 74 · 15.5 cm', category: 'artillery', unit: 'K1', date: '2026-05-05', timeFrom: '11:00', timeTo: '15:00', usageType: 'military', civilUsageKind: null, personCount: 40, shots: 500, quantityUnit: 'shots', recordedBy: 'Lt Meier Fiona', source: 'manual', externalId: null, note: null, updatedAt: '2026-05-05T15:00:00.000Z' },
  { id: 'u2', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, positions: [pos('p2', 'c1', 1000), pos('p3', 'c3', 2.5, 'kg')], weaponName: 'Stgw 90 · 5.6 mm, Sprengladung · kg', category: 'handguns', unit: 'Inf Bat 12', date: '2026-06-17', timeFrom: '08:00', timeTo: '11:30', usageType: 'military', civilUsageKind: null, personCount: 80, shots: 1002.5, quantityUnit: 'mixed', recordedBy: 'Hptm Roth Beat', source: 'manual', externalId: null, note: null, updatedAt: '2026-06-17T12:00:00.000Z' },
  { id: 'u3', areaId: AREA_ID, roomId: 'r2', roomName: ROOMS[1].name, positions: [pos('p4', 'c1', 2400)], weaponName: 'Stgw 90 · 5.6 mm', category: 'handguns', unit: 'Schützenverein Geissalp', date: '2026-06-21', timeFrom: '13:30', timeTo: '17:00', usageType: 'civil', civilUsageKind: 'obligatory', personCount: 22, shots: 2400, quantityUnit: 'shots', recordedBy: 'ELO-Import', source: 'elo', externalId: 'ELO-2026-1104-00001', note: null, updatedAt: '2026-06-21T17:00:00.000Z' },
];

const KPI: UsageKpiDto = { year: 2026, totalShots: 3900, count: 3, civilSharePercent: 62, lastDate: '2026-06-21', years: [2026, 2025] };

describe('AreaShotsComponent', () => {
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
    create: jest.Mock;
    updateUsage: jest.Mock;
    remove: jest.Mock;
    restore: jest.Mock;
  };

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
      create: jest.fn().mockResolvedValue(USAGES[0]),
      updateUsage: jest.fn().mockResolvedValue(USAGES[0]),
      remove: jest.fn().mockResolvedValue(['u1']),
      restore: jest.fn().mockResolvedValue(['u1']),
    };

    // The area id lives on the parent route (`/admin/area/:id/shots`).
    const paramMap = { get: (k: string) => (k === 'id' ? AREA_ID : null) };
    const parentRoute = { paramMap: of(paramMap), snapshot: { paramMap } };

    await TestBed.configureTestingModule({
      imports: [AreaShotsComponent],
      providers: [
        { provide: UsageFacade, useValue: facade },
        { provide: AreaFacade, useValue: { byId: () => ({ id: AREA_ID, name: 'Geissalp', coordinationSectionNo: '1104.020' }) } },
        { provide: ActivatedRoute, useValue: { parent: parentRoute, paramMap: of(paramMap), snapshot: parentRoute.snapshot } },
      ],
    })
      .overrideComponent(AreaShotsComponent, {
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
