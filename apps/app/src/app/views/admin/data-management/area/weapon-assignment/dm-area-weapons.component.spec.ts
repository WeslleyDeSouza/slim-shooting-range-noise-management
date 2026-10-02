import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaResultDto, RoomWeaponAssignmentDto, WeaponAssignmentRoomDto } from '@ui-slim/apiClient';
import { WeaponAssignmentFacade } from '../../../../../core/data-area/weapon-assignment.facade';
import { DmAreaWeaponsComponent } from './dm-area-weapons.component';

const room = (id: string, no: string | null, name: string, assignmentCount: number, enabled = true): WeaponAssignmentRoomDto => ({
  id,
  coordinationSectionNo: no,
  name,
  groupName: null,
  sortOrder: 0,
  enabled,
  assignmentCount,
});

const assignment = (id: string, roomId: string, entryName: string, weapon: string, caliber: string, categoryName: string, enabled = true): RoomWeaponAssignmentDto => ({
  id,
  roomId,
  combinationId: `c-${id}`,
  entryName,
  weapon,
  caliber,
  category: 'handguns',
  categoryName,
  enabled,
});

// Order of the Schiessplatz: a room without assignments first, so «first with assignments» is visible.
const ROOMS: WeaponAssignmentRoomDto[] = [
  room('r-b1', '1104.020.03', 'Zielrm / Stellungsrm Seelihuus, B 1', 0),
  room('r-b2', '1104.020.06', 'Stellungsrm B 2', 3),
  room('r-a3', '1104.020.05', 'Stellungsraum A 3 auch Mw', 1, false),
  room('r-d', null, 'NGST Schönenboden D oben', 0),
];

const ASSIGNMENTS: RoomWeaponAssignmentDto[] = [
  assignment('a1', 'r-b2', 'Stgw 90 · 5.6 mm', 'Stgw 90', '5.6 mm GP 90', 'Handfeuerwaffen'),
  assignment('a2', 'r-b2', 'Mg 51 · 7.5 mm', 'Mg 51', '7.5 mm GP 11', 'Handfeuerwaffen'),
  assignment('a3', 'r-b2', 'Pist 75 · 9 mm', 'Pist 75', '9 mm Pist Pat 41', 'Handfeuerwaffen', false),
  assignment('a4', 'r-a3', 'Mw 72 · 8.1 cm', 'Mw 72', '8.1 cm', 'Minenwerfer'),
];

class FacadeStub {
  readonly areaId = signal('area-1');
  readonly area = signal<Pick<AreaResultDto, 'name' | 'coordinationSectionNo'> | null>({ name: 'Geissalp', coordinationSectionNo: '1104.020' });
  readonly rooms = signal<WeaponAssignmentRoomDto[]>(ROOMS);
  readonly assignments = signal<RoomWeaponAssignmentDto[]>(ASSIGNMENTS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn().mockResolvedValue(undefined);
  readonly clearError = jest.fn(() => this.error.set(null));
}

const TRANSLATE_STUB = {
  translate: (key: string) => (key === 'common.yes' ? 'Ja' : key === 'common.no' ? 'Nein' : key),
  lang: 'de',
  sectionChanged$: of(null),
  languageChanged$: of(null),
};

function routeStub(query: Record<string, string> = {}) {
  return {
    paramMap: of(convertToParamMap({ areaId: 'area-1' })),
    queryParamMap: of(convertToParamMap(query)),
    snapshot: { paramMap: convertToParamMap({ areaId: 'area-1' }), queryParamMap: convertToParamMap(query), data: {} },
    data: of({}),
    parent: null,
  };
}

describe('DmAreaWeaponsComponent (5.17 Zuordnung Waffen)', () => {
  let fixture: ComponentFixture<DmAreaWeaponsComponent>;
  let facade: FacadeStub;
  let navigate: jest.SpyInstance;

  async function setup(query: Record<string, string> = {}): Promise<void> {
    facade = new FacadeStub();
    await TestBed.configureTestingModule({
      imports: [DmAreaWeaponsComponent],
      providers: [
        provideRouter([]),
        { provide: WeaponAssignmentFacade, useValue: facade },
        DataEmitter,
        { provide: TranslateService, useValue: TRANSLATE_STUB },
        { provide: ActivatedRoute, useValue: routeStub(query) },
      ],
    }).compileComponents();
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DmAreaWeaponsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const roomNames = () => all('[data-testid="dwa-room"]').map((r) => r.getAttribute('data-name'));
  const cells = (row: HTMLElement) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.replace(/\s+/g, ' ').trim());
  const rows = () => all('[data-testid="dwa-row"]').map(cells);
  const header = (table: string, label: string) =>
    all(`${table} th button`).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

  it('loads the Schiessplatz and opens with the first Stellungsraum that has assignments (B1 Abbildung 28)', async () => {
    await setup();
    expect(facade.load).toHaveBeenCalledWith('area-1');
    expect(el('[data-testid="dwa-title"]').textContent).toContain('title');
    // Rooms by Koordinationsabschnitts-Nr., the one without a number last.
    expect(roomNames()).toEqual(['Zielrm / Stellungsrm Seelihuus, B 1', 'Stellungsraum A 3 auch Mw', 'Stellungsrm B 2', 'NGST Schönenboden D oben']);
    expect(cells(all('[data-testid="dwa-room"]')[1])).toEqual(['1104.020.05', 'Stellungsraum A 3 auch Mw', 'Nein']);
    expect(cells(all('[data-testid="dwa-room"]')[3])[0]).toBe('—');
    expect(all('[data-testid="dwa-room"]')[0].classList).toContain('dwa__room--empty');

    const selected = all('[data-testid="dwa-room"]')[2];
    expect(selected.classList).toContain('slim-table__row--selected');
    expect(el('[data-testid="dwa-room-no"]').textContent?.trim()).toBe('1104.020.06');
    // Zugeordnete Waffen: Waffenname für Erfassung, Waffe, Kaliber, Kategorie — by the entry name.
    expect(rows()).toEqual([
      ['Mg 51 · 7.5 mm', 'Mg 51', '7.5 mm GP 11', 'Handfeuerwaffen'],
      ['Pist 75 · 9 mm admin.dm_area_weapons.inactive', 'Pist 75', '9 mm Pist Pat 41', 'Handfeuerwaffen'],
      ['Stgw 90 · 5.6 mm', 'Stgw 90', '5.6 mm GP 90', 'Handfeuerwaffen'],
    ]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('is a display: no form, no save, no add or delete control (FAQ 52)', async () => {
    await setup();
    expect(el('[data-testid="dwa-readonly"]').textContent).toContain('readonly');
    expect(all('form, input:not([type="search"]), select, textarea')).toHaveLength(0);
    expect(all('button[type="submit"]')).toHaveLength(0);
  });

  it('shows the assignments of the chosen room and writes ?room= (deep link)', async () => {
    await setup();
    all('[data-testid="dwa-room"]')[1].click();
    fixture.detectChanges();
    expect(rows()).toEqual([['Mw 72 · 8.1 cm', 'Mw 72', '8.1 cm', 'Minenwerfer']]);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { room: 'r-a3' }, queryParamsHandling: 'merge', replaceUrl: true }));

    // A room without assignments says so instead of showing an empty table.
    all('[data-testid="dwa-room"]')[0].click();
    fixture.detectChanges();
    expect(rows()).toEqual([]);
    expect(el('[data-testid="dwa-empty"]').textContent).toContain('assignments_empty');
  });

  it('preselects the room of the query parameter', async () => {
    await setup({ room: 'r-a3' });
    expect(all('[data-testid="dwa-room"]')[1].classList).toContain('slim-table__row--selected');
    expect(rows()).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('searches the Stellungsräume by number or name and keeps the selection', async () => {
    await setup();
    const search = el<HTMLInputElement>('[data-testid="dwa-room-search"]');
    search.value = '020.05';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual(['Stellungsraum A 3 auch Mw']);
    expect(el('[data-testid="dwa-rooms-foot"]').textContent).toContain('rooms_foot');

    search.value = 'ngst';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual(['NGST Schönenboden D oben']);
    // The detail still shows the room chosen before the search.
    expect(rows()).toHaveLength(3);

    search.value = 'xyz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual([]);
    expect(el('[data-testid="dwa-rooms"] .slim-empty__text').textContent).toContain('rooms_no_match');
  });

  it('sorts both tables by a column, a second click reverses', async () => {
    await setup();
    header('[data-testid="dwa-rooms"]', 'col_room_name').click();
    fixture.detectChanges();
    expect(roomNames()).toEqual(['NGST Schönenboden D oben', 'Stellungsraum A 3 auch Mw', 'Stellungsrm B 2', 'Zielrm / Stellungsrm Seelihuus, B 1']);
    header('[data-testid="dwa-rooms"]', 'col_room_name').click();
    fixture.detectChanges();
    expect(roomNames()[0]).toBe('Zielrm / Stellungsrm Seelihuus, B 1');

    header('[data-testid="dwa-assignments"]', 'col_caliber').click();
    fixture.detectChanges();
    expect(rows().map((r) => r[2])).toEqual(['5.6 mm GP 90', '7.5 mm GP 11', '9 mm Pist Pat 41']);
    header('[data-testid="dwa-assignments"]', 'col_caliber').click();
    fixture.detectChanges();
    expect(rows().map((r) => r[2])).toEqual(['9 mm Pist Pat 41', '7.5 mm GP 11', '5.6 mm GP 90']);
  });

  it('reloads when the context switches to another Schiessplatz and falls back to its first room', async () => {
    await setup();
    facade.areaId.set('area-2'); // what the facade reports once the other area is loaded
    facade.rooms.set([room('r-x', '3101.020.01', 'Stellungsraum Thun 1', 1)]);
    facade.assignments.set([assignment('x1', 'r-x', 'Pz Hb 74 · 15.5 cm', 'Pz Hb 74', '15.5 cm', 'Artillerie')]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(roomNames()).toEqual(['Stellungsraum Thun 1']);
    expect(rows()).toEqual([['Pz Hb 74 · 15.5 cm', 'Pz Hb 74', '15.5 cm', 'Artillerie']]);
  });

  it('shows an API error and the empty notice of a Schiessplatz without rooms', async () => {
    await setup();
    facade.rooms.set([]);
    facade.assignments.set([]);
    facade.error.set('errors.load_failed');
    fixture.detectChanges();
    expect(el('[data-testid="dwa-error"]').textContent).toContain('errors.load_failed');
    expect(el('[data-testid="dwa-rooms"] .slim-empty__text').textContent).toContain('rooms_empty');
    expect(el('[data-testid="dwa-detail-title"]').textContent).toContain('detail_none');
    el<HTMLButtonElement>('[data-testid="dwa-error"] button').click();
    expect(facade.clearError).toHaveBeenCalled();
  });
});
