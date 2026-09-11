import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type {
  UsageKpiDto,
  UsageResultDto,
  UsageRoomDto,
  UsageWeaponDto,
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
  { id: 'r1', coordinationSectionNo: '1104.020.05', name: 'Stellungsrm Mw Neuhaus, B 3', groupName: 'Stellungsräume', builtAfter1985: true, usageCount: 2, shots: 1500 },
  { id: 'r2', coordinationSectionNo: '1104.020.07', name: 'Stellungsrm B 2', groupName: 'Stellungsräume', builtAfter1985: false, usageCount: 1, shots: 2400 },
  { id: 'r3', coordinationSectionNo: '1104.020.11', name: 'NGST Seeli C rechts', groupName: 'NGST', builtAfter1985: false, usageCount: 0, shots: 0 },
];

const WEAPONS: UsageWeaponDto[] = [
  { id: 'w1', roomId: 'r1', weaponName: 'Pz Hb 74 · 15.5 cm', weapon: 'Pz Hb 74', caliber: '15.5 cm Spr Gr', category: 'artillery', annex7Category: null, quota: 1500 },
  { id: 'w2', roomId: 'r1', weaponName: 'Stgw 90 · 5.6 mm', weapon: 'Stgw 90', caliber: '5.6 mm GP 90', category: 'handguns', annex7Category: 'a', quota: null },
  { id: 'w3', roomId: 'r2', weaponName: 'Stgw 90 · 5.6 mm', weapon: 'Stgw 90', caliber: '5.6 mm GP 90', category: 'handguns', annex7Category: 'a', quota: null },
];

const USAGES: UsageResultDto[] = [
  { id: 'u1', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, weaponId: 'w1', weaponName: WEAPONS[0].weaponName, category: 'artillery', unit: 'K1', date: '2026-05-05', timeFrom: '11:00', timeTo: '15:00', usageType: 'military', shots: 500, quantityUnit: 'shots', recordedBy: 'Lt Meier Fiona', source: 'manual', note: null, updatedAt: '2026-05-05T15:00:00.000Z' },
  { id: 'u2', areaId: AREA_ID, roomId: 'r1', roomName: ROOMS[0].name, weaponId: 'w2', weaponName: WEAPONS[1].weaponName, category: 'handguns', unit: 'Inf Bat 12', date: '2026-06-17', timeFrom: '08:00', timeTo: '11:30', usageType: 'military', shots: 1000, quantityUnit: 'shots', recordedBy: 'Hptm Roth Beat', source: 'manual', note: null, updatedAt: '2026-06-17T12:00:00.000Z' },
  { id: 'u3', areaId: AREA_ID, roomId: 'r2', roomName: ROOMS[1].name, weaponId: 'w3', weaponName: WEAPONS[2].weaponName, category: 'handguns', unit: 'Schützenverein Geissalp', date: '2026-06-21', timeFrom: '13:30', timeTo: '17:00', usageType: 'civil', shots: 2400, quantityUnit: 'shots', recordedBy: 'ELO-Import', source: 'elo', note: null, updatedAt: '2026-06-21T17:00:00.000Z' },
];

const KPI: UsageKpiDto = { year: 2026, totalShots: 3900, count: 3, civilSharePercent: 62, lastDate: '2026-06-21', years: [2026, 2025] };

describe('AreaShotsComponent', () => {
  let fixture: ComponentFixture<AreaShotsComponent>;
  let facade: {
    kpi: ReturnType<typeof signal<UsageKpiDto | null>>;
    rooms: ReturnType<typeof signal<UsageRoomDto[]>>;
    weapons: ReturnType<typeof signal<UsageWeaponDto[]>>;
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
      weapons: signal<UsageWeaponDto[]>(WEAPONS),
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
      form: { setValue(v: unknown): void; controls: Record<string, { setValue(v: unknown): void }> };
      save(): Promise<void>;
    };
    component.form.controls['roomId'].setValue('r1');
    component.form.controls['category'].setValue('handguns');
    component.form.controls['weaponId'].setValue('w2');
    component.form.controls['unit'].setValue('K1');
    component.form.controls['date'].setValue('2026-09-11');
    component.form.controls['timeFrom'].setValue('08:00');
    component.form.controls['timeTo'].setValue('11:30');
    component.form.controls['shots'].setValue(120);
    await component.save();
    await settle();
    expect(facade.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'r1', weaponId: 'w2', shots: 120, timeFrom: '08:00', timeTo: '11:30', usageType: 'military' }),
    );
    expect(el().querySelector('[data-testid="shots-drawer"]')).toBeNull();
    expect(el().querySelector('[data-testid="shots-toast"]')?.textContent).toContain('shots.toast.created');
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
