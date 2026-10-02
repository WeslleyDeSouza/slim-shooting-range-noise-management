import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { OperatingA7RowDto, OperatingA9RowDto, RoomSummaryDto, WlrRowDto } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../../../common/table-export.component';
import { TableSelectComponent, TableSelectRowDirective } from '../../../../../../common/table-select.component';
import { TableSortHeaderComponent } from '../../../../../../common/table-sort-header.component';
import {
  DETAIL_TABS,
  DetailTab,
  detailTabCounts,
  filterRooms,
  initialRoom,
  roomDetailRows,
} from '../../../../../../core/data-calculations/calculations.logic';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { ExportColumn, tableExport, TableExportData } from '../../../../../../core/table/table-export';
import { TableSelection } from '../../../../../../core/table/table-selection';
import { SortValue, TableSort } from '../../../../../../core/table/table-sort';
import { areaIdSignal } from '../../_context/area-id';

const I18N = 'admin.dm_calc';
/** Ids of the tables in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLES: Record<DetailTab, string> = {
  wlr_day: 'berechnung_wlr_day',
  wlr_night: 'berechnung_wlr_night',
  a9: 'betriebsdaten_anhang9',
  a7: 'betriebsdaten_anhang7',
};

type RoomSortKey = 'no' | 'name' | 'sources';
type WlrSortKey = 'point' | 'egid' | 'source' | 'weapon' | 'elevation' | 'laeMk' | 'laeGk' | 'laeDet' | 'lae' | 'lafmax';
type A9SortKey = 'source' | 'weapon' | 'combination' | 'inside' | 'outside' | 'estimated' | 'year' | 'remark';
type A7SortKey = 'source' | 'weapon' | 'category' | 'halfDaysWork' | 'halfDaysSunday' | 'shotsWork' | 'shotsSunday' | 'estimated' | 'year';

/** What the columns of the four tables are sorted by (B1 5.5.2). */
const ROOM_SORT: Record<RoomSortKey, (r: RoomSummaryDto) => SortValue> = {
  no: (r) => r.coordinationSectionNo,
  name: (r) => r.name,
  sources: (r) => r.sourceCount,
};
const WLR_SORT: Record<WlrSortKey, (r: WlrRowDto) => SortValue> = {
  point: (r) => r.point,
  egid: (r) => r.egid,
  source: (r) => r.sourceId,
  weapon: (r) => r.weaponSystem,
  elevation: (r) => r.elevation,
  laeMk: (r) => r.laeMk,
  laeGk: (r) => r.laeGk,
  laeDet: (r) => r.laeDet,
  lae: (r) => r.lae,
  lafmax: (r) => r.lafmax,
};
const A9_SORT: Record<A9SortKey, (r: OperatingA9RowDto) => SortValue> = {
  source: (r) => r.sourceId,
  weapon: (r) => r.weaponSystem,
  combination: (r) => r.combinationName,
  inside: (r) => r.shotsInside,
  outside: (r) => r.shotsOutside,
  estimated: (r) => r.estimated,
  year: (r) => r.year,
  remark: (r) => r.remark,
};
const A7_SORT: Record<A7SortKey, (r: OperatingA7RowDto) => SortValue> = {
  source: (r) => r.sourceId,
  weapon: (r) => r.weaponSystem,
  category: (r) => r.category,
  halfDaysWork: (r) => r.halfDaysWork,
  halfDaysSunday: (r) => r.halfDaysSunday,
  shotsWork: (r) => r.shotsWork,
  shotsSunday: (r) => r.shotsSunday,
  estimated: (r) => r.estimated,
  year: (r) => r.year,
};

/** A WLR level belongs to an Empfänger and a Quelle; the Betriebsdaten to a Quelle. */
const wlrId = (r: WlrRowDto): string => `${r.point}|${r.sourceId}`;
const sourceId = (r: { sourceId: string }): string => r.sourceId;

/**
 * 5.21 Datenverwaltung › Schiessplatz › Berechnungen › Details (`slm 21`,
 * B1 Abbildung 32–35): pick a Berechnungszustand, then a Stellungsraum;
 * the detail area shows the data of that room in four tabs — WLR DAY,
 * WLR NIGHT (Empfänger, Gebäude, Quelle, Waffe, Elevation, LAE(MK), LAE(GK),
 * LAE(Det), LAE, LAFmax), Betriebsdaten Anhang 9 and Anhang 7. The state
 * can be preselected with `?state=<id>` (links of the overview). Splitting
 * and counting live in `calculations.logic.ts`. Every table sorts by its
 * columns (5.5.2); the table of the open tab can be exported as shown, or
 * its marked rows (5.5.3, 5.5.5).
 */
@Component({
  selector: 'app-dm-calc-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DatePipe, DecimalPipe, NgTemplateOutlet, TableExportComponent, TableSelectComponent, TableSelectRowDirective, TableSortHeaderComponent],
  templateUrl: './dm-calc-details.component.html',
  styleUrl: './dm-calc-details.component.scss',
})
export class DmCalcDetailsComponent extends ComponentBase {
  private readonly facade = inject(DataCalculationsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

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
  protected readonly roomSort = new TableSort<RoomSortKey>();
  protected readonly filteredRooms = computed(() => this.roomSort.apply(filterRooms(this.rooms(), this.roomQuery()), ROOM_SORT));
  protected readonly selectedRoom = computed<RoomSummaryDto | null>(() => this.rooms().find((r) => r.id === this.selectedRoomId()) ?? null);

  protected readonly tab = signal<DetailTab>('wlr_day');
  protected readonly rows = computed(() => {
    const d = this.details();
    return d && d.state.id === this.selectedStateId() ? roomDetailRows(d, this.selectedRoomId()) : roomDetailRows({ wlr: [], a9: [], a7: [] }, null);
  });
  protected readonly counts = computed(() => detailTabCounts(this.rows()));

  protected readonly wlrSort = new TableSort<WlrSortKey>();
  protected readonly a9Sort = new TableSort<A9SortKey>();
  protected readonly a7Sort = new TableSort<A7SortKey>();
  /** The rows of the four tabs as shown: in the order of the delivery, or of the chosen column. */
  protected readonly view = computed(() => {
    const rows = this.rows();
    return {
      wlrDay: this.wlrSort.apply(rows.wlrDay, WLR_SORT),
      wlrNight: this.wlrSort.apply(rows.wlrNight, WLR_SORT),
      a9: this.a9Sort.apply(rows.a9, A9_SORT),
      a7: this.a7Sort.apply(rows.a7, A7_SORT),
    };
  });
  /** Marked rows of the open tab; the marks end with the tab, the Stellungsraum and the Zustand. */
  protected readonly selection = new TableSelection();
  protected readonly shownIds = computed(() => {
    const view = this.view();
    switch (this.tab()) {
      case 'wlr_day':
        return view.wlrDay.map(wlrId);
      case 'wlr_night':
        return view.wlrNight.map(wlrId);
      case 'a9':
        return view.a9.map(sourceId);
      default:
        return view.a7.map(sourceId);
    }
  });
  protected readonly wlrId = wlrId;

  /** The table of the open tab as shown, or its marked rows, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const yesNo = (value: boolean) => t(value ? 'common.yes' : 'common.no');
    const tab = this.tab();
    const state = this.selectedState();
    const head = {
      table: EXPORT_TABLES[tab],
      title: t(`${I18N}.tab_${tab}`),
      filters: [
        { label: t(`${I18N}.field_state`), value: state ? `${state.delivery.name}, ${state.name}` : null },
        { label: t('admin.export.room'), value: this.roomLabel(this.selectedRoom()) },
      ],
    };
    const view = this.view();
    if (tab === 'a9') {
      const picked = this.selection.pick(view.a9, sourceId);
      const columns: ExportColumn<OperatingA9RowDto>[] = [
        { header: t(`${I18N}.col_source`), value: (r) => r.sourceId },
        { header: t(`${I18N}.col_weapon`), value: (r) => r.weaponSystem },
        { header: t(`${I18N}.col_combination`), value: (r) => r.combinationName },
        { header: t(`${I18N}.col_a9_m1`), value: (r) => r.shotsInside },
        { header: t(`${I18N}.col_a9_m2`), value: (r) => r.shotsOutside },
        { header: t(`${I18N}.col_estimated`), value: (r) => yesNo(r.estimated) },
        { header: t(`${I18N}.col_year`), value: (r) => r.year },
        { header: t(`${I18N}.col_remark`), value: (r) => r.remark },
      ];
      return tableExport({ ...head, columns, rows: picked.rows, selection: picked.selection });
    }
    if (tab === 'a7') {
      const picked = this.selection.pick(view.a7, sourceId);
      const columns: ExportColumn<OperatingA7RowDto>[] = [
        { header: t(`${I18N}.col_source`), value: (r) => r.sourceId },
        { header: t(`${I18N}.col_weapon`), value: (r) => r.weaponSystem },
        { header: t(`${I18N}.col_category`), value: (r) => `${r.category} · ${t(`admin.dm_weapons.annex7.${r.category}`)}` },
        { header: t(`${I18N}.col_half_days_work`), value: (r) => r.halfDaysWork },
        { header: t(`${I18N}.col_half_days_sunday`), value: (r) => r.halfDaysSunday },
        { header: t(`${I18N}.col_shots_work`), value: (r) => r.shotsWork },
        { header: t(`${I18N}.col_shots_sunday`), value: (r) => r.shotsSunday },
        { header: t(`${I18N}.col_estimated`), value: (r) => yesNo(r.estimated) },
        { header: t(`${I18N}.col_year`), value: (r) => r.year },
      ];
      return tableExport({ ...head, columns, rows: picked.rows, selection: picked.selection });
    }
    const picked = this.selection.pick(tab === 'wlr_day' ? view.wlrDay : view.wlrNight, wlrId);
    const columns: ExportColumn<WlrRowDto>[] = [
      { header: t(`${I18N}.col_point`), value: (r) => r.point },
      { header: t(`${I18N}.col_building`), value: (r) => r.egid },
      { header: t(`${I18N}.col_source`), value: (r) => r.sourceId },
      { header: t(`${I18N}.col_weapon`), value: (r) => r.weaponSystem },
      { header: t(`${I18N}.col_elevation`), value: (r) => r.elevation },
      { header: 'LAE(MK)', value: (r) => r.laeMk },
      { header: 'LAE(GK)', value: (r) => r.laeGk },
      { header: 'LAE(Det)', value: (r) => r.laeDet },
      { header: 'LAE', value: (r) => r.lae },
      { header: 'LAFmax', value: (r) => r.lafmax },
    ];
    return tableExport({ ...head, columns, rows: picked.rows, selection: picked.selection });
  };

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
    // The marks belong to the rows of one tab of one Stellungsraum.
    effect(() => {
      this.tab();
      this.selectedRoomId();
      this.selectedStateId();
      untracked(() => this.selection.clear());
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
