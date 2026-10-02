import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { RoomWeaponAssignmentDto, WeaponAssignmentRoomDto } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../../common/table-export.component';
import { TableSelectComponent, TableSelectRowDirective } from '../../../../../common/table-select.component';
import { WeaponAssignmentFacade } from '../../../../../core/data-area/weapon-assignment.facade';
import {
  AssignmentSortKey,
  assignmentsOfRoom,
  filterRooms,
  initialRoom,
  roomLabel,
  RoomSortKey,
  sortRooms,
} from '../../../../../core/data-area/weapon-assignment.logic';
import { tableExport, TableExportData } from '../../../../../core/table/table-export';
import { TableSelection } from '../../../../../core/table/table-selection';
import { areaIdSignal } from '../_context/area-id';

const I18N = 'admin.dm_area_weapons';
/** Ids of the two tables in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE_ROOMS = 'waffenzuordnung_stellungsraeume';
const EXPORT_TABLE_ASSIGNMENTS = 'waffenzuordnung';

/**
 * 5.17 Datenverwaltung › Schiessplatz › Zuordnung Waffen (`slm 17`, B1
 * Abbildung 28): the Stellungsräume of the Schiessplatz (Koordinations-
 * abschnitts-Nr., Bezeichnung, Aktiv) with a search over number and name,
 * and for the chosen room the «Zugeordnete Waffen» — Waffenname für die
 * Erfassung, Waffe, Kaliber, Kategorie. A display: FAQ 52 dropped the
 * maintenance in the UI, the assignments come from the import (9.2) and the
 * DB administration. The room can be preselected with `?room=<id>`. Both
 * tables can be exported as shown (Excel/CSV, 5.5.5); of the «Zugeordnete
 * Waffen» several rows can be marked for the export (5.5.3).
 */
@Component({
  selector: 'app-dm-area-weapons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, TableExportComponent, TableSelectComponent, TableSelectRowDirective],
  templateUrl: './dm-area-weapons.component.html',
  styleUrl: './dm-area-weapons.component.scss',
})
export class DmAreaWeaponsComponent extends ComponentBase {
  protected readonly facade = inject(WeaponAssignmentFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly prefix = I18N;
  readonly areaId = areaIdSignal(this.route);

  protected readonly area = this.facade.area;
  protected readonly rooms = this.facade.rooms;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly areaLabel = computed(() => {
    const a = this.area();
    return a ? `${a.coordinationSectionNo} ${a.name}` : '…';
  });

  protected readonly roomColumns: { key: RoomSortKey; label: string }[] = [
    { key: 'coordinationSectionNo', label: 'col_room_no' },
    { key: 'name', label: 'col_room_name' },
    { key: 'enabled', label: 'col_active' },
  ];
  protected readonly assignmentColumns: { key: AssignmentSortKey; label: string }[] = [
    { key: 'entryName', label: 'col_entry_name' },
    { key: 'weapon', label: 'col_weapon' },
    { key: 'caliber', label: 'col_caliber' },
    { key: 'categoryName', label: 'col_category' },
  ];

  protected readonly query = signal('');
  /** Default like B1 Abbildung 28: by Koordinationsabschnitts-Nr., rooms without one last. */
  protected readonly roomSort = signal<{ key: RoomSortKey; asc: boolean }>({ key: 'coordinationSectionNo', asc: true });
  protected readonly assignmentSort = signal<{ key: AssignmentSortKey; asc: boolean }>({ key: 'entryName', asc: true });

  private readonly roomParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('room'))), {
    initialValue: this.route.snapshot.queryParamMap.get('room'),
  });
  protected readonly selectedRoomId = signal<string | null>(null);
  protected readonly selectedRoom = computed<WeaponAssignmentRoomDto | null>(() => this.rooms().find((r) => r.id === this.selectedRoomId()) ?? null);
  protected readonly selectedLabel = computed(() => roomLabel(this.selectedRoom()));

  protected readonly visibleRooms = computed(() => sortRooms(filterRooms(this.rooms(), this.query()), this.roomSort().key, this.roomSort().asc));
  protected readonly assignments = computed(() =>
    assignmentsOfRoom(this.facade.assignments(), this.selectedRoomId(), this.assignmentSort().key, this.assignmentSort().asc),
  );

  /** Marked «Zugeordnete Waffen»; the ids are unique over all Stellungsräume, so a mark stays with its room. */
  protected readonly selection = new TableSelection();
  protected readonly shownIds = computed(() => this.assignments().map((a) => a.id));

  /** The Stellungsräume as shown (search and sorting applied) for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly roomsExportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    return tableExport<WeaponAssignmentRoomDto>({
      table: EXPORT_TABLE_ROOMS,
      title: t(`${I18N}.rooms_title`),
      subtitle: this.exportSubtitle(),
      filters: [{ label: t('admin.export.search'), value: this.query().trim() }],
      columns: [
        { header: t(`${I18N}.col_room_no`), value: (r) => r.coordinationSectionNo ?? null },
        { header: t(`${I18N}.col_room_name`), value: (r) => r.name },
        { header: t(`${I18N}.col_active`), value: (r) => t(r.enabled ? 'common.yes' : 'common.no') },
      ],
      rows: this.visibleRooms(),
    });
  };

  /** The «Zugeordnete Waffen» of the chosen Stellungsraum as shown (sorting applied) for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const picked = this.selection.pick(this.assignments(), (a) => a.id);
    return tableExport<RoomWeaponAssignmentDto>({
      table: EXPORT_TABLE_ASSIGNMENTS,
      title: t(`${I18N}.assignments_title`),
      subtitle: this.exportSubtitle(),
      filters: [{ label: t('admin.export.room'), value: this.selectedLabel() }],
      columns: [
        { header: t(`${I18N}.col_entry_name`), value: (a) => (a.enabled ? a.entryName : `${a.entryName} (${t(`${I18N}.inactive`)})`) },
        { header: t(`${I18N}.col_weapon`), value: (a) => a.weapon },
        { header: t(`${I18N}.col_caliber`), value: (a) => a.caliber },
        { header: t(`${I18N}.col_category`), value: (a) => a.categoryName },
      ],
      rows: picked.rows,
      selection: picked.selection,
    });
  };

  /** «1104.020 Geissalp» for the head of the export; empty while the Schiessplatz is loading. */
  private exportSubtitle(): string | null {
    const a = this.area();
    return a ? `${a.coordinationSectionNo} ${a.name}` : null;
  }

  constructor() {
    super();
    // Room: the one of the query param, else the one already chosen, else the first with assignments.
    effect(() => {
      const rooms = this.rooms();
      const wanted = this.roomParam();
      untracked(() => {
        if (!rooms.length) return;
        const current = this.selectedRoomId();
        const pick = rooms.find((r) => r.id === wanted) ?? rooms.find((r) => r.id === current) ?? initialRoom(rooms);
        if (pick && pick.id !== current) this.selectedRoomId.set(pick.id);
      });
    });
    // The switcher keeps this component and only changes `:areaId`: load the
    // other Schiessplatz (the first value is handled by getData()).
    effect(() => {
      const id = this.areaId();
      untracked(() => {
        if (id && this.facade.areaId() && this.facade.areaId() !== id) void this.facade.load(id);
      });
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit (the area id is set by the context route). */
  override getData(): void {
    void this.facade.load(this.areaId());
  }

  protected selectRoom(room: WeaponAssignmentRoomDto): void {
    this.selectedRoomId.set(room.id);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { room: room.id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected sortRoomsBy(key: RoomSortKey): void {
    this.roomSort.update((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  }

  protected sortAssignmentsBy(key: AssignmentSortKey): void {
    this.assignmentSort.update((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  }

  protected clearQuery(input: HTMLInputElement): void {
    this.query.set('');
    input.focus();
  }
}
