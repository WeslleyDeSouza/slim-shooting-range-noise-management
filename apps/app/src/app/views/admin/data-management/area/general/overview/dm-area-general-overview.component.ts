import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type { AreaRoomDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataAreaFacade } from '../../../../../../core/data-area/data-area.facade';
import { areaIdSignal } from '../../_context/area-id';

const I18N = 'admin.dm_area_general';

type RoomSortKey = 'coordinationSectionNo' | 'name' | 'enabled';

/** Search-highlight split so the template needs no innerHTML (ELO pattern). */
export interface Highlighted {
  pre: string;
  match: string;
  post: string;
}

/** `query` is already lower-cased by the caller. */
export function highlight(text: string, query: string): Highlighted {
  const index = query ? text.toLowerCase().indexOf(query) : -1;
  if (index < 0) return { pre: text, match: '', post: '' };
  return { pre: text.slice(0, index), match: text.slice(index, index + query.length), post: text.slice(index + query.length) };
}

interface RoomRow {
  room: AreaRoomDto;
  no: Highlighted | null;
  name: Highlighted;
}

/** The read-only rows of the «Detailansicht Schiessplatz» (B1 Abbildung 26), key → what to render. */
interface DetailRow {
  key: string;
  kind: 'text' | 'yesno' | 'check' | 'option' | 'muted';
  value: string | boolean | null;
  /** Locale group of the option label (`options.<group>.<value>`). */
  group?: string;
  emptyKey?: string;
}

/**
 * 5.15 Datenverwaltung › Schiessplatz › Allgemein › Übersicht (`slm 14`,
 * `slm 15`): the Detailansicht of the Schiessplatz (Kerndaten, Berechnungsart,
 * Klassierung, Baujahr of the current state, the Stände) and the table of the
 * Stellungsräume with free-text search over every shown column, sortable,
 * with the count of rooms without a Koordinationsabschnitts-Nr. Data from
 * `DataAreaFacade` (loaded by the tab host).
 */
@Component({
  selector: 'app-dm-area-general-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './dm-area-general-overview.component.html',
  styleUrl: './dm-area-general-overview.component.scss',
})
export class DmAreaGeneralOverviewComponent extends ComponentBase {
  private readonly facade = inject(DataAreaFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  readonly areaId = areaIdSignal(this.route);

  protected readonly general = this.facade.general;
  protected readonly area = this.facade.area;
  protected readonly loading = this.facade.loading;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_AREA);
  protected readonly masterDataLink = computed(() => APP_ROUTES.admin.dataManagement.area.masterDataOf(this.areaId()));

  protected readonly query = signal('');
  protected readonly sortKey = signal<RoomSortKey>('name');
  protected readonly sortAsc = signal(true);

  protected readonly columns: { key: RoomSortKey; label: string }[] = [
    { key: 'coordinationSectionNo', label: 'col_room_no' },
    { key: 'name', label: 'col_room_name' },
    { key: 'enabled', label: 'col_active' },
  ];

  /** Rows of the Detailansicht (B1 Abbildung 26), in the order of the mock. */
  protected readonly details = computed<DetailRow[]>(() => {
    const g = this.general();
    if (!g) return [];
    const a = g.area;
    return [
      { key: 'coordination_no', kind: 'text', value: a.coordinationSectionNo },
      { key: 'sectoral_plan_no', kind: a.sectoralPlanNo ? 'text' : 'muted', value: a.sectoralPlanNo, emptyKey: 'not_in_sectoral_plan' },
      { key: 'active', kind: 'yesno', value: a.enabled },
      { key: 'calculation_kind', kind: 'check', value: a.annex7Overall },
      { key: 'classification', kind: 'option', value: a.classification, group: 'classification' },
      { key: 'build_year', kind: g.buildYearClass ? 'option' : 'muted', value: g.buildYearClass, group: 'build_year', emptyKey: 'no_state' },
      { key: 'recalculation_state', kind: 'option', value: a.recalculationState, group: 'recalculation_state' },
      { key: 'remediation_project_state', kind: 'option', value: a.remediationProjectState, group: 'remediation_project_state' },
      { key: 'spm_state', kind: 'option', value: a.spmState, group: 'spm_state' },
      { key: 'noise_remediation_state', kind: 'option', value: a.noiseRemediationState, group: 'noise_remediation_state' },
      { key: 'project_state', kind: 'option', value: a.projectState, group: 'project_state' },
    ];
  });

  protected readonly rooms = this.facade.rooms;
  protected readonly withoutNumber = computed(() => this.rooms().filter((r) => !r.coordinationSectionNo).length);

  /** Free-text search over Nr., Bezeichnung and Aktiv (`slm 15`), then sort; rooms without a number always last. */
  protected readonly rows = computed<RoomRow[]>(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortAsc() ? 1 : -1;
    const yes = this.translateYesNo(true).toLowerCase();
    const no = this.translateYesNo(false).toLowerCase();
    return this.rooms()
      .filter(
        (r) =>
          !q ||
          (r.coordinationSectionNo ?? '').toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.enabled ? yes : no).includes(q),
      )
      .sort((a, b) => {
        if (key === 'enabled') return (Number(b.enabled) - Number(a.enabled)) * dir || a.name.localeCompare(b.name, 'de-CH');
        const x = (a[key] ?? '').toLowerCase();
        const y = (b[key] ?? '').toLowerCase();
        if (x === '' && y !== '') return 1;
        if (y === '' && x !== '') return -1;
        return x.localeCompare(y, 'de-CH', { numeric: true }) * dir;
      })
      .map((room) => ({
        room,
        no: room.coordinationSectionNo ? highlight(room.coordinationSectionNo, q) : null,
        name: highlight(room.name, q),
      }));
  });

  protected sortBy(key: RoomSortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  protected clearQuery(input: HTMLInputElement): void {
    this.query.set('');
    input.focus();
  }

  /** The Aktiv column is searchable by its label (Ja/Nein in the current language), like the mock. */
  private translateYesNo(value: boolean): string {
    return this.translate.translate(value ? 'common.yes' : 'common.no');
  }

  /** The tab host loads the read model; nothing to fetch here. */
  override getData(): void {
    // intentionally empty — DataAreaFacade is loaded by DmAreaGeneralComponent
  }
}
