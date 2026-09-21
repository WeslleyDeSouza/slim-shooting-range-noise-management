import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type { RoomSummaryDto } from '@ui-slim/apiClient';
import {
  DETAIL_TABS,
  DetailTab,
  detailTabCounts,
  filterRooms,
  initialRoom,
  roomDetailRows,
} from '../../../../../../core/data-calculations/calculations.logic';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { areaIdSignal } from '../../_context/area-id';

const I18N = 'admin.dm_calc';

/**
 * 5.21 Datenverwaltung › Schiessplatz › Berechnungen › Details (`slm 21`,
 * B1 Abbildung 32–35): pick a Berechnungszustand, then a Stellungsraum;
 * the detail area shows the data of that room in four tabs — WLR DAY,
 * WLR NIGHT (Empfänger, Gebäude, Quelle, Waffe, Elevation, LAE(MK), LAE(GK),
 * LAE(Det), LAE, LAFmax), Betriebsdaten Anhang 9 and Anhang 7. The state
 * can be preselected with `?state=<id>` (links of the overview). Splitting
 * and counting live in `calculations.logic.ts`.
 */
@Component({
  selector: 'app-dm-calc-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DatePipe, DecimalPipe, NgTemplateOutlet],
  templateUrl: './dm-calc-details.component.html',
  styleUrl: './dm-calc-details.component.scss',
})
export class DmCalcDetailsComponent extends ComponentBase {
  private readonly facade = inject(DataCalculationsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly prefix = I18N;
  protected readonly tabs = DETAIL_TABS;
  readonly areaId = areaIdSignal(this.route);

  protected readonly states = this.facade.states;
  protected readonly details = this.facade.details;
  protected readonly loading = this.facade.loading;

  private readonly stateParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('state'))), {
    initialValue: this.route.snapshot.queryParamMap.get('state'),
  });
  protected readonly selectedStateId = signal<string | null>(null);
  protected readonly selectedState = computed(() => this.states().find((s) => s.id === this.selectedStateId()) ?? null);

  protected readonly roomQuery = signal('');
  protected readonly selectedRoomId = signal<string | null>(null);
  protected readonly rooms = computed(() => (this.details()?.state.id === this.selectedStateId() ? this.details()?.rooms ?? [] : []));
  protected readonly filteredRooms = computed(() => filterRooms(this.rooms(), this.roomQuery()));
  protected readonly selectedRoom = computed<RoomSummaryDto | null>(() => this.rooms().find((r) => r.id === this.selectedRoomId()) ?? null);

  protected readonly tab = signal<DetailTab>('wlr_day');
  protected readonly rows = computed(() => {
    const d = this.details();
    return d && d.state.id === this.selectedStateId() ? roomDetailRows(d, this.selectedRoomId()) : roomDetailRows({ wlr: [], a9: [], a7: [] }, null);
  });
  protected readonly counts = computed(() => detailTabCounts(this.rows()));

  constructor() {
    super();
    // State: from the query param, else the current state, else the first one.
    effect(() => {
      const states = this.states();
      const wanted = this.stateParam();
      untracked(() => {
        if (!states.length) return;
        const current = this.selectedStateId();
        const pick = states.find((s) => s.id === wanted) ?? (current ? states.find((s) => s.id === current) : undefined) ?? states.find((s) => s.isCurrent) ?? states[0];
        if (pick.id !== current) this.selectState(pick.id, false);
      });
    });
    // Room: the first one with sources of the freshly loaded state.
    effect(() => {
      const rooms = this.rooms();
      untracked(() => {
        if (!rooms.length) return;
        if (!this.selectedRoomId() || !rooms.some((r) => r.id === this.selectedRoomId())) this.selectedRoomId.set(initialRoom(rooms)?.id ?? null);
      });
    });
  }

  /** The tab host loads the overview; the details of the chosen state are loaded on selection. */
  override getData(): void {
    const id = this.selectedStateId();
    if (id) void this.facade.loadDetails(this.areaId(), id);
  }

  protected selectState(id: string, updateUrl = true): void {
    this.selectedStateId.set(id);
    void this.facade.loadDetails(this.areaId(), id);
    if (updateUrl) void this.router.navigate([], { relativeTo: this.route, queryParams: { state: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected selectRoom(room: RoomSummaryDto): void {
    this.selectedRoomId.set(room.id);
  }

  protected roomLabel(room: RoomSummaryDto | null): string {
    if (!room) return '';
    return room.coordinationSectionNo ? `${room.coordinationSectionNo}, ${room.name}` : room.name;
  }
}
