import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { CaliberDto, WeaponCategoryDto, WeaponCombinationDto, WeaponDto, WeaponMasterDataDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../core/access/access.facade';
import { DataWeaponsFacade, InUseError, WeaponKind, WeaponRecord } from '../../../../core/data-weapons/data-weapons.facade';
import { DmWeaponsComponent } from './dm-weapons.component';

const TS = '2026-09-19T08:00:00.000Z';

const CATEGORIES: WeaponCategoryDto[] = [
  { id: 'c-hand', code: 'handguns', nameDe: 'Handfeuerwaffen', nameFr: 'Armes légères', nameIt: null, sortOrder: 0, enabled: true, weaponCount: 2, createdAt: TS, updatedAt: TS },
  { id: 'c-mw', code: 'mortar', nameDe: 'Minenwerfer', nameFr: null, nameIt: null, sortOrder: 1, enabled: false, weaponCount: 0, createdAt: TS, updatedAt: TS },
];
const WEAPONS: WeaponDto[] = [
  { id: 'w-stgw', nameDe: 'Stgw 90', nameFr: 'Fass 90', nameIt: null, categoryId: 'c-hand', categoryName: 'Handfeuerwaffen', annex7Category: 'a', enabled: true, combinationCount: 1, createdAt: TS, updatedAt: TS },
  { id: 'w-pist', nameDe: 'Pist 75', nameFr: null, nameIt: null, categoryId: 'c-hand', categoryName: 'Handfeuerwaffen', annex7Category: 'b', enabled: true, combinationCount: 1, createdAt: TS, updatedAt: TS },
];
const CALIBERS: CaliberDto[] = [
  { id: 'k-gp90', nameDe: '5.6 mm GP 90', nameFr: null, nameIt: null, alnNo: '594-7005', sapNo: '2000.7073', quantityUnit: 'shots', enabled: true, combinationCount: 1, createdAt: TS, updatedAt: TS },
  { id: 'k-pp41', nameDe: '9 mm Pist Pat 41', nameFr: null, nameIt: null, alnNo: '511-0041', sapNo: '2400.0041', quantityUnit: 'shots', enabled: true, combinationCount: 1, createdAt: TS, updatedAt: TS },
];
const COMBINATIONS: WeaponCombinationDto[] = [
  {
    id: 'x-stgw', nameDe: 'Stgw 90 · 5.6 mm', nameFr: null, nameIt: null, weaponId: 'w-stgw', weaponName: 'Stgw 90', caliberId: 'k-gp90', caliberName: '5.6 mm GP 90',
    categoryId: 'c-hand', categoryName: 'Handfeuerwaffen', sonarmsId: 'Stgw90', enabled: true,
    areas: [{ id: 'a1', coordinationSectionNo: '1104.020', name: 'Geissalp' }, { id: 'a2', coordinationSectionNo: '3101.020', name: 'Thun' }],
    usageCount: 12, quotaCount: 2, sourceCount: 3, inUse: 19, createdAt: TS, updatedAt: TS,
  },
  {
    id: 'x-pist', nameDe: 'Pist 75 · 9 mm', nameFr: null, nameIt: null, weaponId: 'w-pist', weaponName: 'Pist 75', caliberId: 'k-pp41', caliberName: '9 mm Pist Pat 41',
    categoryId: 'c-hand', categoryName: 'Handfeuerwaffen', sonarmsId: null, enabled: true,
    areas: [], usageCount: 0, quotaCount: 0, sourceCount: 0, inUse: 0, createdAt: TS, updatedAt: TS,
  },
];

const DATA: WeaponMasterDataDto = { categories: CATEGORIES, weapons: WEAPONS, calibers: CALIBERS, combinations: COMBINATIONS, sonarmsOptions: ['Stgw90', 'Pist75'] };

class FacadeStub {
  readonly dataSignal = signal<WeaponMasterDataDto>(DATA);
  readonly data = this.dataSignal;
  readonly loaded = signal(true);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly inUse = signal<InUseError | null>(null);
  readonly categories = signal(CATEGORIES);
  readonly weapons = signal(WEAPONS);
  readonly calibers = signal(CALIBERS);
  readonly combinations = signal(COMBINATIONS);
  readonly sonarmsOptions = signal(DATA.sonarmsOptions);
  readonly load = jest.fn(async () => undefined);
  readonly createRecord = jest.fn(async (_kind: WeaponKind, body: Partial<WeaponRecord>) => ({ ...COMBINATIONS[1], ...body, id: 'new-id' }) as WeaponRecord);
  readonly updateRecord = jest.fn(async (kind: WeaponKind, id: string, body: Partial<WeaponRecord>) => ({ ...(this.rows(kind).find((r) => r.id === id) as WeaponRecord), ...body }) as WeaponRecord);
  readonly deleteRecord = jest.fn(async () => true);
  readonly exportXlsx = jest.fn(async () => new Blob(['x']));
  readonly clearError = jest.fn();
  rows(kind: WeaponKind): WeaponRecord[] {
    const d = this.dataSignal();
    return { combination: d.combinations, caliber: d.calibers, weapon: d.weapons, category: d.categories }[kind];
  }
}

class AccessStub {
  readonly write = signal(true);
  readonly loaded = signal(true);
  canWrite = () => this.write;
  can = () => signal(true);
  load = jest.fn(async () => undefined);
}

describe('DmWeaponsComponent (5.22–5.25)', () => {
  let fixture: ComponentFixture<DmWeaponsComponent>;
  let component: DmWeaponsComponent;
  let facade: FacadeStub;
  let access: AccessStub;
  let routeData: BehaviorSubject<{ kind: WeaponKind }>;

  beforeEach(async () => {
    facade = new FacadeStub();
    access = new AccessStub();
    routeData = new BehaviorSubject<{ kind: WeaponKind }>({ kind: 'combination' });
    await TestBed.configureTestingModule({
      imports: [DmWeaponsComponent],
      providers: [
        provideRouter([]),
        { provide: DataWeaponsFacade, useValue: facade },
        { provide: AccessFacade, useValue: access },
        DataEmitter,
        {
          provide: TranslateService,
          useValue: { translate: (key: string) => key, lang: 'de', sectionChanged$: of(null), languageChanged$: of(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            data: routeData.asObservable(),
            paramMap: of(convertToParamMap({})),
            snapshot: { data: { kind: 'combination' }, paramMap: convertToParamMap({}) },
            parent: null,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DmWeaponsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const rowNames = () => all('[data-testid="dmw-row"]').map((r) => r.getAttribute('data-name'));
  const type = (selector: string, value: string) => {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const pick = (selector: string, value: string) => {
    const select = el<HTMLSelectElement>(selector);
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('shows the four tabs with counts and the combination table of B1 5.22', () => {
    expect(all('[data-testid^="dmw-tab-"]').map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'admin.dm_weapons.kind_combination 2',
      'admin.dm_weapons.kind_caliber 2',
      'admin.dm_weapons.kind_weapon 2',
      'admin.dm_weapons.kind_category 2',
    ]);
    expect(rowNames()).toEqual(['Pist 75 · 9 mm', 'Stgw 90 · 5.6 mm']); // sorted by Bezeichnung
    const headers = all('th button.dmw__sort').map((h) => h.textContent?.trim().split(' ')[0]);
    expect(headers).toEqual(['admin.dm_weapons.col_name', 'admin.dm_weapons.col_weapon', 'admin.dm_weapons.col_caliber', 'admin.dm_weapons.col_category', 'admin.dm_weapons.col_active']);
    expect(all('[data-testid^="dmw-filter-"]')).toHaveLength(3);
    expect(el('[data-testid="dmw-detail-title"]').textContent).toContain('kind_combination_one');
    expect(el('.dmw__placeholder')).not.toBeNull();
  });

  it('searches over the shown columns and the sonARMS mapping, and filters by Waffe', () => {
    type('[data-testid="dmw-search"]', 'stgw90');
    expect(rowNames()).toEqual(['Stgw 90 · 5.6 mm']);
    type('[data-testid="dmw-search"]', '');
    pick('[data-testid="dmw-filter-weaponName"]', 'Pist 75');
    expect(rowNames()).toEqual(['Pist 75 · 9 mm']);
    expect(el('[data-testid="dmw-count"]').textContent).toContain('count');
  });

  it('opens the detail of a row with derived category, Verwendung and meta dates', () => {
    all('[data-testid="dmw-row"]')[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="dmw-detail-title"]').textContent).toContain('Stgw 90 · 5.6 mm');
    expect(el<HTMLInputElement>('[data-testid="dmw-name-de"]').value).toBe('Stgw 90 · 5.6 mm');
    expect(el<HTMLSelectElement>('[data-testid="dmw-weapon"]').value).toBe('w-stgw');
    expect(el<HTMLInputElement>('[data-testid="dmw-sonarms"]').value).toBe('Stgw90');
    expect(el('[data-testid="dmw-derived-category"]').textContent).toContain('Handfeuerwaffen');
    expect(all('[data-testid="dmw-usage"] tbody tr')).toHaveLength(2);
    expect(el('[data-testid="dmw-usage"]').textContent).toContain('Geissalp');
    expect(el('[data-testid="dmw-meta"]').textContent).toContain('2026');
    expect(el<HTMLButtonElement>('[data-testid="dmw-save"]').disabled).toBe(true); // nothing edited yet
  });

  it('derives the Waffenkategorie from the chosen Waffe and saves the sonARMS mapping', fakeAsync(() => {
    all('[data-testid="dmw-row"]')[0].click(); // Pist 75
    fixture.detectChanges();
    type('[data-testid="dmw-sonarms"]', 'Pist75');
    expect(el('[data-testid="dmw-dirty"]')).not.toBeNull();
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.updateRecord).toHaveBeenCalledWith('combination', 'x-pist', expect.objectContaining({ sonarmsId: 'Pist75', weaponId: 'w-pist', caliberId: 'k-pp41', enabled: true }));
    expect(el('[data-testid="dmw-toast"]').textContent).toContain('toast_updated');
    tick(6000);
  }));

  it('creates a new combination: Waffe and Kaliber are required, the name may stay empty (API derives it)', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dmw-new"]').click();
    tick();
    fixture.detectChanges();
    expect(el('[data-testid="dmw-detail-title"]').textContent).toContain('detail_new');
    type('[data-testid="dmw-name-de"]', 'Stgw 90 · 9 mm');
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createRecord).not.toHaveBeenCalled();
    expect(all('.slim-field--invalid').length).toBeGreaterThanOrEqual(2);

    pick('[data-testid="dmw-weapon"]', 'w-stgw');
    pick('[data-testid="dmw-caliber"]', 'k-pp41');
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createRecord).toHaveBeenCalledWith('combination', expect.objectContaining({ nameDe: 'Stgw 90 · 9 mm', weaponId: 'w-stgw', caliberId: 'k-pp41', sonarmsId: null }));
    expect(el('[data-testid="dmw-toast"]').textContent).toContain('toast_created');
    tick(6000);
  }));

  it('switches to the Kaliber tab: ALN- and SAP-Nr. become required (B1 5.23)', fakeAsync(() => {
    routeData.next({ kind: 'caliber' });
    fixture.detectChanges();
    expect(rowNames()).toEqual(['5.6 mm GP 90', '9 mm Pist Pat 41']);
    expect(all('[data-testid^="dmw-filter-"]')).toHaveLength(0);
    el<HTMLButtonElement>('[data-testid="dmw-new"]').click();
    tick();
    fixture.detectChanges();
    type('[data-testid="dmw-name-de"]', '7.5 mm GP 11');
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createRecord).not.toHaveBeenCalled();
    type('[data-testid="dmw-aln"]', '550-1100');
    type('[data-testid="dmw-sap"]', '2410.0011');
    el<HTMLInputElement>('[data-testid="dmw-unit-kg"]').click();
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    expect(facade.createRecord).toHaveBeenCalledWith('caliber', expect.objectContaining({ nameDe: '7.5 mm GP 11', alnNo: '550-1100', sapNo: '2410.0011', quantityUnit: 'kg' }));
    tick(6000);
  }));

  it('saves a Waffe with its Anhang 7 category (B1 5.24) and a Waffenkategorie (5.25)', fakeAsync(() => {
    routeData.next({ kind: 'weapon' });
    fixture.detectChanges();
    all('[data-testid="dmw-row"]')[1].click(); // Stgw 90
    fixture.detectChanges();
    expect(el<HTMLSelectElement>('[data-testid="dmw-annex7"]').value).toBe('a');
    pick('[data-testid="dmw-annex7"]', '');
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    expect(facade.updateRecord).toHaveBeenCalledWith('weapon', 'w-stgw', expect.objectContaining({ annex7Category: null, categoryId: 'c-hand' }));

    routeData.next({ kind: 'category' });
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Handfeuerwaffen', 'Minenwerfer']);
    all('[data-testid="dmw-row"]')[1].click();
    fixture.detectChanges();
    el<HTMLInputElement>('[data-testid="dmw-active-yes"]').click();
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dmw-save"]').click();
    tick();
    expect(facade.updateRecord).toHaveBeenCalledWith('category', 'c-mw', expect.objectContaining({ enabled: true, nameDe: 'Minenwerfer' }));
    tick(6000);
  }));

  it('deletes after confirmation and, when the API says «in use», offers «Inaktiv setzen» instead', fakeAsync(() => {
    all('[data-testid="dmw-row-delete"]')[0].click(); // Pist 75, unused
    fixture.detectChanges();
    expect(el('[data-testid="dmw-delete-dialog"]').textContent).toContain('Pist 75 · 9 mm');
    el<HTMLButtonElement>('[data-testid="dmw-delete-confirm"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.deleteRecord).toHaveBeenCalledWith('combination', 'x-pist');
    expect(el('[data-testid="dmw-delete-dialog"]')).toBeNull();
    expect(el('[data-testid="dmw-toast"]').textContent).toContain('toast_deleted');

    // The API refuses: the dialog stays with the count and the alternative.
    facade.deleteRecord.mockImplementationOnce(async () => {
      facade.inUse.set({ kind: 'combination', inUse: 19 });
      return false;
    });
    all('[data-testid="dmw-row-delete"]')[1].click(); // Stgw 90
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dmw-delete-confirm"]').click();
    tick();
    fixture.detectChanges();
    expect(el('[data-testid="dmw-in-use"]').textContent).toContain('in_use_text');
    expect(el('[data-testid="dmw-delete-confirm"]')).toBeNull();
    el<HTMLButtonElement>('[data-testid="dmw-deactivate"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.updateRecord).toHaveBeenCalledWith('combination', 'x-stgw', { enabled: false });
    expect(el('[data-testid="dmw-toast"]').textContent).toContain('toast_deactivated');
    tick(6000);
  }));

  it('guards unsaved edits when another row or a tab is chosen', async () => {
    all('[data-testid="dmw-row"]')[0].click();
    fixture.detectChanges();
    type('[data-testid="dmw-name-de"]', 'Geändert');
    const leaving = component.canDeactivate() as Promise<boolean>;
    fixture.detectChanges();
    expect(el('[data-testid="dmw-discard"]')).not.toBeNull();
    el<HTMLButtonElement>('[data-testid="dmw-discard-keep"]').click();
    await expect(leaving).resolves.toBe(false);
    expect(el<HTMLInputElement>('[data-testid="dmw-name-de"]').value).toBe('Geändert');
  });

  it('is read-only without the write right', () => {
    access.write.set(false);
    fixture.detectChanges();
    expect(el('[data-testid="dmw-new"]')).toBeNull();
    expect(el('[data-testid="dmw-readonly"]')).not.toBeNull();
    expect(all('[data-testid="dmw-row-delete"]')).toHaveLength(0);
    all('[data-testid="dmw-row"]')[0].click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('[data-testid="dmw-name-de"]').disabled).toBe(true);
    expect(el('[data-testid="dmw-form-actions"]')).toBeNull();
  });
});
