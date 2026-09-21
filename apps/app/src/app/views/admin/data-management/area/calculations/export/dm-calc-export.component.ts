import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { SLIM_APP_ID } from '@slim/shared';
import type { StateSummaryDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { toggleSelection } from '../../../../../../core/data-calculations/calculations.logic';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { areaIdSignal } from '../../_context/area-id';
import { BUILD_YEAR_OPTIONS } from '../overview/dm-calc-overview.component';

const I18N = 'admin.dm_calc';
const TOAST_MS = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Value of the delivery select that means «new Immissionsberechnung». */
const NEW_DELIVERY = '__new__';

interface Toast {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * 5.20 Datenverwaltung › Schiessplatz › Berechnungen › Export (`slm 20`,
 * B1 Abbildung 31): the states of the Schiessplatz with a selection for
 * the export («Export GeoDB» → JSON bundle in the structure of the
 * Berechnungsdatei, importable again), «Neuen Berechnungszustand anlegen»
 * (an empty state with a new ZustandID, optionally in a new delivery), and
 * the calendar years with Schusszahlen for the CSV export.
 */
@Component({
  selector: 'app-dm-calc-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, DecimalPipe],
  templateUrl: './dm-calc-export.component.html',
  styleUrl: './dm-calc-export.component.scss',
})
export class DmCalcExportComponent extends ComponentBase {
  private readonly facade = inject(DataCalculationsFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly prefix = I18N;
  protected readonly buildYearOptions = BUILD_YEAR_OPTIONS;
  protected readonly newDeliveryValue = NEW_DELIVERY;
  readonly areaId = areaIdSignal(this.route);

  protected readonly states = this.facade.states;
  protected readonly deliveries = this.facade.deliveries;
  protected readonly years = this.facade.years;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly readonly = computed(() => !this.canWrite());

  protected readonly selectedStates = signal<string[]>([]);
  protected readonly selectedYears = signal<number[]>([]);
  protected readonly allStatesSelected = computed(() => this.states().length > 0 && this.selectedStates().length === this.states().length);

  // --- Neuer Berechnungszustand -------------------------------------------------

  protected readonly stateDialog = signal(false);
  readonly stateForm = new FormGroup({
    calculationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    deliveryName: new FormControl('', { nonNullable: true }),
    deliveredAt: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.pattern(DATE)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    referenceYear: new FormControl<number>(new Date().getFullYear() + 1, { nonNullable: true, validators: [Validators.required, Validators.min(1900)] }),
    buildYearClass: new FormControl<'before1985' | 'after1985' | 'mixed'>('mixed', { nonNullable: true }),
  });
  private stateSubmitted = signal(false);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.destroyRef.onDestroy(() => this.dismissToast());
  }

  /** The years come only from this tab; the overview is loaded by the host. */
  override getData(): void {
    void this.facade.loadYears(this.areaId());
  }

  // --- Selection ------------------------------------------------------------------

  protected toggleState(id: string): void {
    this.selectedStates.update((s) => toggleSelection(s, id));
  }

  protected toggleAllStates(): void {
    this.selectedStates.set(this.allStatesSelected() ? [] : this.states().map((s) => s.id));
  }

  protected toggleYear(year: number): void {
    this.selectedYears.update((s) => toggleSelection(s, year));
  }

  protected isSelected(id: string): boolean {
    return this.selectedStates().includes(id);
  }

  // --- Exports --------------------------------------------------------------------

  protected async exportStates(): Promise<void> {
    const ids = this.selectedStates();
    if (!ids.length || this.readonly()) return;
    const blob = await this.facade.exportStates(this.areaId(), ids);
    if (!blob) return;
    this.download(blob, `berechnungszustaende_${new Date().toISOString().slice(0, 10)}.json`);
    this.showToast({ key: `${I18N}.toast_exported`, params: { n: ids.length } });
  }

  protected async exportShots(): Promise<void> {
    const years = this.selectedYears();
    if (!years.length || this.readonly()) return;
    const blob = await this.facade.exportShots(this.areaId(), years);
    if (!blob) return;
    this.download(blob, `schusszahlen_${[...years].sort().join('-')}.csv`);
    this.showToast({ key: `${I18N}.toast_exported`, params: { n: years.length } });
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Neuer Berechnungszustand -------------------------------------------------

  protected openStateDialog(): void {
    if (this.readonly()) return;
    this.facade.clearError();
    this.stateSubmitted.set(false);
    const first = this.deliveries()[0];
    this.stateForm.reset({
      calculationId: first?.id ?? NEW_DELIVERY,
      deliveryName: '',
      deliveredAt: new Date().toISOString().slice(0, 10),
      name: '',
      referenceYear: new Date().getFullYear() + 1,
      buildYearClass: 'mixed',
    });
    this.stateDialog.set(true);
  }

  protected stateInvalid(control: 'name' | 'referenceYear' | 'deliveryName'): boolean {
    const c = this.stateForm.controls[control];
    if (control === 'deliveryName') return this.stateSubmitted() && this.stateForm.controls.calculationId.value === NEW_DELIVERY && !String(c.value).trim();
    return c.invalid && (c.touched || this.stateSubmitted());
  }

  protected async createState(): Promise<void> {
    this.stateSubmitted.set(true);
    const v = this.stateForm.getRawValue();
    const needsDelivery = v.calculationId === NEW_DELIVERY;
    if (this.stateForm.invalid || (needsDelivery && !v.deliveryName.trim()) || this.saving()) {
      this.stateForm.markAllAsTouched();
      return;
    }
    let calculationId = v.calculationId;
    if (needsDelivery) {
      const delivery = await this.facade.createDelivery(this.areaId(), { name: v.deliveryName.trim(), deliveredAt: v.deliveredAt, supplier: '' });
      if (!delivery) return;
      calculationId = delivery.id;
    }
    const created: StateSummaryDto | null = await this.facade.createState(this.areaId(), {
      calculationId,
      name: v.name.trim(),
      referenceYear: Number(v.referenceYear),
      buildYearClass: v.buildYearClass,
    });
    if (!created) return;
    this.stateDialog.set(false);
    this.selectedStates.update((s) => [...s, created.id]);
    this.showToast({ key: `${I18N}.toast_state_created`, params: { name: created.name, id: created.externalId ?? '' } });
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
