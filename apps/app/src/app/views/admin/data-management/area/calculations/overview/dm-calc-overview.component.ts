import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type { DeliveryDto, StateSummaryDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import {
  deliveryDeleteBlocker,
  filterDeliveries,
  Pointer,
  pointerClickAllowed,
  sortDeliveries,
} from '../../../../../../core/data-calculations/calculations.logic';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { TableExportComponent } from '../../../../../../common/table-export.component';
import { TableSelectComponent } from '../../../../../../common/table-select.component';
import { TableSortHeaderComponent } from '../../../../../../common/table-sort-header.component';
import { tableExport, TableExportData } from '../../../../../../core/table/table-export';
import { TableSelection } from '../../../../../../core/table/table-selection';
import { SortValue, TableSort } from '../../../../../../core/table/table-sort';
import { HasUnsavedChanges } from '../../../../_common/unsaved-changes.guard';
import { areaIdSignal } from '../../_context/area-id';
import { notBlank } from '../../general/master-data/dm-area-master-data.component';

const I18N = 'admin.dm_calc';
const TOAST_MS = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Baujahr classes of a state (B1 7.7); labels shared with the Stammdaten mask. */
export const BUILD_YEAR_OPTIONS = ['before1985', 'after1985', 'mixed'] as const;

interface Toast {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * 5.18 Datenverwaltung › Schiessplatz › Berechnungen › Übersicht (`slm 18`,
 * B1 Abbildung 29): the table of the Immissionsberechnungen (Bezeichnung,
 * Lieferantin, Anzahl Zustände, Lieferdatum, Akt. Zustand, Stand MGDM) with
 * search and delete, and the Detailansicht of the selected one: Bezeichnung,
 * Lieferantin, Lieferdatum, Beschreibung, Berechnungsdatei, and the states
 * with Zustand ID, Bezeichnung, RefJahr, the pointers «aktueller Zustand» /
 * «Stand MGDM» (exactly one per Schiessplatz, set with a confirmation) and
 * the Baujahr of the Anlageteile per state. Rules live in
 * `calculations.logic.ts`; data in `DataCalculationsFacade`.
 */
/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'berechnungen';

type DeliverySortKey = 'name' | 'supplier' | 'states' | 'delivered' | 'current' | 'mgdm';

/** What the columns of the Berechnungen are sorted by (B1 5.5.2). */
const DELIVERY_SORT: Record<DeliverySortKey, (d: DeliveryDto) => SortValue> = {
  name: (d) => d.name,
  supplier: (d) => d.supplier,
  states: (d) => d.stateCount,
  delivered: (d) => d.deliveredAt,
  current: (d) => d.hasCurrent,
  mgdm: (d) => d.hasMgdm,
};

type StateSortKey = 'id' | 'name' | 'year' | 'current' | 'mgdm' | 'buildYear' | 'supplier' | 'delivered';

/** What the columns of a table of Berechnungszustände are sorted by (B1 5.5.2). */
const STATE_SORT: Partial<Record<StateSortKey, (s: StateSummaryDto) => SortValue>> = {
  id: (s) => s.externalId,
  name: (s) => s.name,
  year: (s) => s.referenceYear,
  current: (s) => s.isCurrent,
  mgdm: (s) => s.isMgdm,
  buildYear: (s) => s.buildYearClass,
};

@Component({
  selector: 'app-dm-calc-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, DatePipe, TableExportComponent, TableSelectComponent, TableSortHeaderComponent],
  templateUrl: './dm-calc-overview.component.html',
  styleUrl: './dm-calc-overview.component.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DmCalcOverviewComponent extends ComponentBase implements HasUnsavedChanges {
  private readonly facade = inject(DataCalculationsFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly buildYearOptions = BUILD_YEAR_OPTIONS;
  readonly areaId = areaIdSignal(this.route);

  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly readonly = computed(() => !this.canWrite());

  // --- Table -----------------------------------------------------------------

  protected readonly query = signal('');
  protected readonly all = computed(() => sortDeliveries(this.facade.deliveries()));
  protected readonly sort = new TableSort<DeliverySortKey>();
  /** The Berechnungen as shown: search applied, newest first, or in the order of the chosen column (B1 5.5.2). */
  protected readonly rows = computed(() => this.sort.apply(filterDeliveries(this.all(), this.query()), DELIVERY_SORT));
  /** Marked Berechnungen for the export (B1 5.5.3); a click on a row opens it. */
  protected readonly marked = new TableSelection();
  protected readonly shownIds = computed(() => this.rows().map((d) => d.id));

  /** The Berechnungen as shown, or the marked ones, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const yesNo = (value: boolean) => t(value ? 'common.yes' : 'common.no');
    const picked = this.marked.pick(this.rows(), (d) => d.id);
    return tableExport<DeliveryDto>({
      table: EXPORT_TABLE,
      title: t(`${I18N}.overview_title`),
      filters: [{ label: t('admin.export.search'), value: this.query().trim() }],
      columns: [
        { header: t(`${I18N}.col_name`), value: (d) => d.name },
        { header: t(`${I18N}.col_supplier`), value: (d) => d.supplier || null },
        { header: t(`${I18N}.col_states`), value: (d) => d.stateCount },
        { header: t(`${I18N}.col_delivered`), value: (d) => d.deliveredAt.slice(0, 10).split('-').reverse().join('.') },
        { header: t(`${I18N}.col_current`), value: (d) => yesNo(d.hasCurrent) },
        { header: t(`${I18N}.col_mgdm`), value: (d) => yesNo(d.hasMgdm) },
      ],
      rows: picked.rows,
      selection: picked.selection,
    });
  };

  protected readonly stateSort = new TableSort<StateSortKey>();
  /** The Zustände of the open Berechnung in the order of the API, or of the chosen column. */
  protected readonly stateRows = computed(() => this.stateSort.apply(this.selected()?.states ?? [], STATE_SORT));

  // --- Detail ----------------------------------------------------------------

  /** Selected delivery id, `'new'` while creating, null = nothing chosen. */
  protected readonly selection = signal<string | 'new' | null>(null);
  protected readonly selected = computed<DeliveryDto | null>(() => {
    const id = this.selection();
    return id && id !== 'new' ? (this.all().find((d) => d.id === id) ?? null) : null;
  });
  protected readonly isNew = computed(() => this.selection() === 'new');
  protected readonly detailOpen = computed(() => this.selection() !== null);
  protected readonly blocker = computed(() => (this.selected() ? deliveryDeleteBlocker(this.selected() as DeliveryDto) : null));

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(120)] }),
    supplier: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    deliveredAt: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DATE)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  protected readonly dirty = signal(false);
  private submitted = signal(false);
  protected readonly confirmDiscard = signal(false);
  private discardResolver: ((leave: boolean) => void) | null = null;

  protected readonly pendingPointer = signal<{ state: StateSummaryDto; pointer: Pointer } | null>(null);
  protected readonly pendingDelete = signal<DeliveryDto | null>(null);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    // First load: open the delivery that holds the current state (what the user works with).
    effect(() => {
      const all = this.all();
      untracked(() => {
        if (this.selection() === null && all.length) {
          const withCurrent = all.find((d) => d.hasCurrent) ?? all[0];
          this.selection.set(withCurrent.id);
          this.fill(withCurrent);
        }
      });
    });
    // Refill from the store after a reload, never over unsaved edits.
    effect(() => {
      const selected = this.selected();
      untracked(() => {
        if (selected && !this.dirty()) this.fill(selected);
      });
    });
    effect(() => {
      const readonly = this.readonly();
      untracked(() => (readonly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.dirty.set(this.form.dirty));
    this.destroyRef.onDestroy(() => this.dismissToast());
  }

  /** The tab host loads the overview; nothing to fetch here. */
  override getData(): void {
    // intentionally empty — DataCalculationsFacade is loaded by DmCalcComponent
  }

  // --- Table -----------------------------------------------------------------

  protected async select(delivery: DeliveryDto): Promise<void> {
    if (this.selected()?.id === delivery.id) return;
    if (this.dirty() && !(await this.askDiscard())) return;
    this.submitted.set(false);
    this.selection.set(delivery.id);
    this.fill(delivery);
  }

  protected async newDelivery(): Promise<void> {
    if (this.readonly()) return;
    if (this.dirty() && !(await this.askDiscard())) return;
    this.submitted.set(false);
    this.selection.set('new');
    this.form.reset({ name: '', supplier: '', deliveredAt: new Date().toISOString().slice(0, 10), description: '' }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  // --- Detail form -------------------------------------------------------------

  protected invalid(control: 'name' | 'deliveredAt'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted());
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.readonly() || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), supplier: v.supplier.trim(), deliveredAt: v.deliveredAt, description: v.description.trim() || null };
    const current = this.selected();
    const saved = current
      ? await this.facade.updateDelivery(this.areaId(), current.id, body)
      : await this.facade.createDelivery(this.areaId(), body);
    if (!saved) return;
    this.selection.set(saved.id);
    this.fill(saved);
    this.submitted.set(false);
    this.showToast({ key: `${I18N}.${current ? 'toast_saved' : 'toast_created'}` });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected async cancelEdit(): Promise<void> {
    if (this.dirty() && !(await this.askDiscard())) return;
    if (this.isNew()) {
      const first = this.all()[0] ?? null;
      this.selection.set(first?.id ?? null);
      if (first) this.fill(first);
    } else {
      const current = this.selected();
      if (current) this.fill(current);
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.dirty()) return true;
    return this.askDiscard();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  protected resolveDiscard(leave: boolean): void {
    this.confirmDiscard.set(false);
    const resolve = this.discardResolver;
    this.discardResolver = null;
    if (leave) {
      const current = this.selected();
      if (current) this.fill(current);
      else {
        this.form.markAsPristine();
        this.dirty.set(false);
      }
    }
    resolve?.(leave);
  }

  private askDiscard(): Promise<boolean> {
    this.confirmDiscard.set(true);
    return new Promise<boolean>((resolve) => (this.discardResolver = resolve));
  }

  private fill(d: DeliveryDto): void {
    this.form.reset({ name: d.name, supplier: d.supplier, deliveredAt: d.deliveredAt, description: d.description ?? '' }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  // --- States ------------------------------------------------------------------

  protected pointerAllowed(state: StateSummaryDto, pointer: Pointer): boolean {
    return !this.readonly() && pointerClickAllowed(state, pointer);
  }

  protected askPointer(state: StateSummaryDto, pointer: Pointer): void {
    if (!this.pointerAllowed(state, pointer)) return;
    this.pendingPointer.set({ state, pointer });
  }

  protected async confirmPointer(): Promise<void> {
    const pending = this.pendingPointer();
    if (!pending) return;
    const saved = await this.facade.setPointer(this.areaId(), pending.state.id, pending.pointer);
    this.pendingPointer.set(null);
    if (!saved) return;
    this.showToast({ key: `${I18N}.toast_pointer_${pending.pointer}`, params: { name: pending.state.name } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected async changeBuildYear(state: StateSummaryDto, value: string): Promise<void> {
    if (this.readonly() || value === state.buildYearClass) return;
    const saved = await this.facade.updateState(this.areaId(), state.id, { buildYearClass: value as StateSummaryDto['buildYearClass'] });
    if (!saved) return;
    this.showToast({ key: `${I18N}.toast_build_year`, params: { name: state.name } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected detailsLink(state: StateSummaryDto): { link: string; query: Record<string, string> } {
    return { link: APP_ROUTES.admin.dataManagement.area.calculationsDetailsOf(this.areaId()), query: { state: state.id } };
  }

  // --- Delete ------------------------------------------------------------------

  protected askDelete(delivery: DeliveryDto): void {
    if (this.readonly()) return;
    this.facade.clearError();
    this.pendingDelete.set(delivery);
  }

  protected async confirmDelete(): Promise<void> {
    const delivery = this.pendingDelete();
    if (!delivery || deliveryDeleteBlocker(delivery)) return;
    const ok = await this.facade.deleteDelivery(this.areaId(), delivery.id);
    if (!ok) return;
    this.pendingDelete.set(null);
    if (this.selected()?.id === delivery.id) {
      this.selection.set(null);
      this.form.markAsPristine();
      this.dirty.set(false);
    }
    this.showToast({ key: `${I18N}.toast_deleted`, params: { name: delivery.name } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected showToast(toast: Toast): void {
    this.toast.set(toast);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }

  protected dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.set(null);
  }
}
