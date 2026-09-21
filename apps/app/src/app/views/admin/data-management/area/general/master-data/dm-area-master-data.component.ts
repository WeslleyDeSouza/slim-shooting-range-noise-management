import { DecimalPipe } from '@angular/common';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type { AreaQuotaDto, AreaResultDto, AreaUpdateDto, QuotaCombinationOptionDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataAreaFacade } from '../../../../../../core/data-area/data-area.facade';
import { HasUnsavedChanges } from '../../../../_common/unsaved-changes.guard';
import { areaIdSignal } from '../../_context/area-id';

const I18N = 'admin.dm_area_general';
const TOAST_MS = 5000;

/** `Validators.required` accepts blanks; a Bezeichnung or a key of spaces is no value. */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

/** Pick lists of the Stammdaten mask (B1 Abbildung 27) — codes of the API enums, labels in `options.<group>.<code>`. */
export const MASTER_DATA_OPTIONS = {
  classification: ['unproblematic', 'problematic', 'remediation_needed'],
  recalculation_state: ['not_required', 'in_progress', 'completed'],
  remediation_project_state: ['not_started', 'concept', 'design', 'implementation', 'completed'],
  spm_state: ['open', 'in_progress', 'completed'],
  noise_remediation_state: ['reassessment_needed', 'assessed', 'remediated'],
  project_state: ['not_started', 'ongoing', 'completed'],
} as const;

type OptionGroup = keyof typeof MASTER_DATA_OPTIONS;

/** Select fields of the mask in the order of the mock, with the form control they bind to. */
export const SELECT_FIELDS: { group: OptionGroup; control: keyof MasterDataForm; section: 'general' | 'states' }[] = [
  { group: 'classification', control: 'classification', section: 'general' },
  { group: 'recalculation_state', control: 'recalculationState', section: 'general' },
  { group: 'remediation_project_state', control: 'remediationProjectState', section: 'general' },
  { group: 'spm_state', control: 'spmState', section: 'states' },
  { group: 'noise_remediation_state', control: 'noiseRemediationState', section: 'states' },
  { group: 'project_state', control: 'projectState', section: 'states' },
];

interface MasterDataForm {
  name: FormControl<string>;
  coordinationSectionNo: FormControl<string>;
  sectoralPlanNo: FormControl<string>;
  enabled: FormControl<'yes' | 'no'>;
  annex7Overall: FormControl<boolean>;
  classification: FormControl<string>;
  recalculationState: FormControl<string>;
  remediationProjectState: FormControl<string>;
  spmState: FormControl<string>;
  noiseRemediationState: FormControl<string>;
  projectState: FormControl<string>;
  planningApproval: FormControl<string>;
}

interface Toast {
  key: string;
  params?: Record<string, unknown>;
}

/** Combination option of the quota dialog, grouped like the select shows it. */
interface QuotaOptionGroup {
  key: 'assigned' | 'others';
  options: QuotaCombinationOptionDto[];
}

/**
 * 5.16 Datenverwaltung › Schiessplatz › Allgemein › Stammdaten (`slm 16`):
 * the Kerndaten of the Schiessplatz (Bezeichnung, Koordinationsabschnitts-Nr.
 * or own key, Sachplan-Nr., Aktiv, Berechnungsart Anhang 7, Klassierung, the
 * Stände) as a reactive form with dirty tracking, unsaved-changes guard and
 * a sticky action bar, plus the Kontingente gemäss Plangenehmigung: table
 * with row actions, a dialog for create / edit (combinations that are allowed
 * on the Schiessplatz first), delete with confirmation and a hint for allowed
 * combinations without a Kontingent (Soll 0 → red light, B1 5.10). Roles
 * without the write right see everything disabled. Data: `DataAreaFacade`.
 */
@Component({
  selector: 'app-dm-area-master-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DecimalPipe],
  templateUrl: './dm-area-master-data.component.html',
  styleUrl: './dm-area-master-data.component.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DmAreaMasterDataComponent extends ComponentBase implements HasUnsavedChanges {
  private readonly facade = inject(DataAreaFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly prefix = I18N;
  protected readonly options = MASTER_DATA_OPTIONS;
  protected readonly selectFields = SELECT_FIELDS;
  readonly areaId = areaIdSignal(this.route);

  protected readonly area = this.facade.area;
  protected readonly general = this.facade.general;
  protected readonly quotas = this.facade.quotas;
  protected readonly combinations = this.facade.combinations;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_AREA);
  protected readonly readonly = computed(() => !this.canWrite());

  // --- Stammdaten form -------------------------------------------------------

  readonly form = new FormGroup<MasterDataForm>({
    name: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(120)] }),
    coordinationSectionNo: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(20)] }),
    sectoralPlanNo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    enabled: new FormControl<'yes' | 'no'>('yes', { nonNullable: true }),
    annex7Overall: new FormControl(false, { nonNullable: true }),
    classification: new FormControl('', { nonNullable: true }),
    recalculationState: new FormControl('', { nonNullable: true }),
    remediationProjectState: new FormControl('', { nonNullable: true }),
    spmState: new FormControl('', { nonNullable: true }),
    noiseRemediationState: new FormControl('', { nonNullable: true }),
    projectState: new FormControl('', { nonNullable: true }),
    planningApproval: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  /** Mirrors `form.dirty` as a signal so the template and the guard react to edits. */
  protected readonly dirty = signal(false);
  private submitted = signal(false);
  protected readonly confirmDiscard = signal(false);
  private discardResolver: ((leave: boolean) => void) | null = null;

  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // --- Kontingente -----------------------------------------------------------

  protected readonly quotaDialog = signal<{ quota: AreaQuotaDto | null } | null>(null);
  readonly quotaForm = new FormGroup({
    combinationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    shotsPerYear: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.001)] }),
    basis: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
  });
  private quotaSubmitted = signal(false);
  protected readonly pendingDelete = signal<AreaQuotaDto | null>(null);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** Allowed combinations (5.17) that still lack a Kontingent — Soll 0 for the quota light (B1 5.10). */
  protected readonly missingQuotas = computed(() => this.combinations().filter((c) => c.assigned && !c.hasQuota && c.enabled));

  /** Options of the quota dialog: allowed combinations first, the edited one always selectable. */
  protected readonly quotaOptionGroups = computed<QuotaOptionGroup[]>(() => {
    const editing = this.quotaDialog()?.quota?.combinationId ?? null;
    const selectable = this.combinations().filter((c) => c.id === editing || (!c.hasQuota && (c.enabled || c.assigned)));
    return [
      { key: 'assigned', options: selectable.filter((c) => c.assigned) },
      { key: 'others', options: selectable.filter((c) => !c.assigned) },
    ].filter((g) => g.options.length) as QuotaOptionGroup[];
  });

  /** Unit of the combination picked in the dialog (Stück / kg), for the input step and the label. */
  private readonly quotaCombinationId = toSignal(this.quotaForm.controls.combinationId.valueChanges, { initialValue: '' });
  protected readonly quotaUnit = computed(() => {
    const id = this.quotaCombinationId();
    return this.combinations().find((c) => c.id === id)?.quantityUnit ?? 'shots';
  });

  constructor() {
    super();
    // Fill the form from the read model whenever it changes, but never over
    // unsaved edits (a DATA_RELOAD after a save of another mask must not wipe them).
    effect(() => {
      const area = this.area();
      if (!area) return;
      untracked(() => {
        if (!this.dirty()) this.fill(area);
      });
    });
    effect(() => {
      // The mask is read-only for roles without the write right (B1 8.1.2).
      const readonly = this.readonly();
      untracked(() => (readonly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.dirty.set(this.form.dirty));
    this.destroyRef.onDestroy(() => this.dismissToast());
  }

  /** The tab host loads the read model; nothing to fetch here. */
  override getData(): void {
    // intentionally empty — DataAreaFacade is loaded by DmAreaGeneralComponent
  }

  // --- Stammdaten ------------------------------------------------------------

  protected invalid(control: keyof MasterDataForm): boolean {
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
    const body: AreaUpdateDto = {
      name: v.name.trim(),
      coordinationSectionNo: v.coordinationSectionNo.trim(),
      sectoralPlanNo: v.sectoralPlanNo.trim() || null,
      enabled: v.enabled === 'yes',
      annex7Overall: v.annex7Overall,
      classification: (v.classification || null) as AreaUpdateDto['classification'],
      recalculationState: (v.recalculationState || null) as AreaUpdateDto['recalculationState'],
      remediationProjectState: (v.remediationProjectState || null) as AreaUpdateDto['remediationProjectState'],
      spmState: (v.spmState || null) as AreaUpdateDto['spmState'],
      noiseRemediationState: (v.noiseRemediationState || null) as AreaUpdateDto['noiseRemediationState'],
      projectState: (v.projectState || null) as AreaUpdateDto['projectState'],
      planningApproval: v.planningApproval.trim() || null,
    };
    const saved = await this.facade.updateArea(this.areaId(), body);
    if (!saved) return;
    this.fill(saved);
    this.submitted.set(false);
    this.showToast({ key: `${I18N}.toast_saved` });
    // The list (context bar, switcher, «Schiessplätze verwalten») shows the new name / state.
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  /** «Abbrechen»: back to the values of the read model (after a confirmation when edited). */
  protected async cancel(): Promise<void> {
    if (this.dirty() && !(await this.askDiscard())) return;
    const area = this.area();
    if (area) this.fill(area);
    void this.router.navigateByUrl(APP_ROUTES.admin.dataManagement.area.generalOf(this.areaId()));
  }

  /** Route guard: leaving with unsaved edits asks first. */
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
      const area = this.area();
      if (area) this.fill(area);
    }
    resolve?.(leave);
  }

  private askDiscard(): Promise<boolean> {
    this.confirmDiscard.set(true);
    return new Promise<boolean>((resolve) => (this.discardResolver = resolve));
  }

  private fill(area: AreaResultDto): void {
    this.form.reset(
      {
        name: area.name,
        coordinationSectionNo: area.coordinationSectionNo,
        sectoralPlanNo: area.sectoralPlanNo ?? '',
        enabled: area.enabled ? 'yes' : 'no',
        annex7Overall: area.annex7Overall,
        classification: area.classification ?? '',
        recalculationState: area.recalculationState ?? '',
        remediationProjectState: area.remediationProjectState ?? '',
        spmState: area.spmState ?? '',
        noiseRemediationState: area.noiseRemediationState ?? '',
        projectState: area.projectState ?? '',
        planningApproval: area.planningApproval ?? '',
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  // --- Kontingente -----------------------------------------------------------

  protected openQuota(quota: AreaQuotaDto | null, combinationId = ''): void {
    if (this.readonly()) return;
    this.facade.clearError();
    this.quotaSubmitted.set(false);
    this.quotaForm.reset({
      combinationId: quota?.combinationId ?? combinationId,
      shotsPerYear: quota?.shotsPerYear ?? null,
      basis: quota?.basis ?? '',
    });
    this.quotaDialog.set({ quota });
  }

  protected closeQuota(): void {
    this.quotaDialog.set(null);
  }

  protected quotaInvalid(control: 'combinationId' | 'shotsPerYear'): boolean {
    const c = this.quotaForm.controls[control];
    return c.invalid && (c.touched || this.quotaSubmitted());
  }

  protected async saveQuota(): Promise<void> {
    this.quotaSubmitted.set(true);
    if (this.quotaForm.invalid || this.saving()) {
      this.quotaForm.markAllAsTouched();
      return;
    }
    const dialog = this.quotaDialog();
    const v = this.quotaForm.getRawValue();
    const shots = Number(v.shotsPerYear);
    const basis = v.basis.trim() || null;
    const result = dialog?.quota
      ? await this.facade.updateQuota(this.areaId(), dialog.quota.id, { combinationId: v.combinationId, shotsPerYear: shots, basis })
      : await this.facade.createQuota(this.areaId(), { combinationId: v.combinationId, shotsPerYear: shots, basis });
    if (!result) return; // error shown inside the dialog
    this.quotaDialog.set(null);
    this.showToast({ key: `${I18N}.${dialog?.quota ? 'toast_quota_updated' : 'toast_quota_created'}` });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected askDeleteQuota(quota: AreaQuotaDto): void {
    if (this.readonly()) return;
    this.facade.clearError();
    this.pendingDelete.set(quota);
  }

  protected async confirmDeleteQuota(): Promise<void> {
    const quota = this.pendingDelete();
    if (!quota) return;
    const ok = await this.facade.deleteQuota(this.areaId(), quota.id);
    this.pendingDelete.set(null);
    if (!ok) return;
    this.showToast({ key: `${I18N}.toast_quota_deleted`, params: { name: quota.name } });
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

  /** Keeps the option list readable when the value is long. */
  protected optionLabel(c: QuotaCombinationOptionDto): string {
    return c.enabled ? c.name : `${c.name} ·`;
  }

  /** `formValue` is read so the template re-evaluates on every edit (dirty badge, live summary). */
  protected readonly titleArea = computed(() => {
    const a = this.area();
    void this.formValue();
    return a ? `${a.coordinationSectionNo} ${a.name}` : '…';
  });
}
