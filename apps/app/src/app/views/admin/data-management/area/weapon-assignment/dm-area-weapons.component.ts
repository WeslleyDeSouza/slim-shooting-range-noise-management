import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type { WeaponAssignmentRoomDto } from '@ui-slim/apiClient';
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
import { areaIdSignal } from '../_context/area-id';

const I18N = 'admin.dm_area_weapons';

/**
 * 5.17 Datenverwaltung › Schiessplatz › Zuordnung Waffen (`slm 17`, B1
 * Abbildung 28): the Stellungsräume of the Schiessplatz (Koordinations-
 * abschnitts-Nr., Bezeichnung, Aktiv) with a search over number and name,
 * and for the chosen room the «Zugeordnete Waffen» — Waffenname für die
 * Erfassung, Waffe, Kaliber, Kategorie. A display: FAQ 52 dropped the
 * maintenance in the UI, the assignments come from the import (9.2) and the
 * DB administration. The room can be preselected with `?room=<id>`.
 */
@Component({
  selector: 'app-dm-area-weapons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './dm-area-weapons.component.html',
  styleUrl: './dm-area-weapons.component.scss',
})
export class DmAreaWeaponsComponent extends ComponentBase {
  protected readonly facade = inject(WeaponAssignmentFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
