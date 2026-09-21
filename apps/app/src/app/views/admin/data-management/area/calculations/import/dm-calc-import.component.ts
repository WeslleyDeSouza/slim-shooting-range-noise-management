import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { SLIM_APP_ID } from '@slim/shared';
import type { ImportValidationDto, StateImportDto, StateSummaryDto, UploadResultDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import {
  annexFromFileName,
  checkStateFile,
  detailTabCounts,
  roomDetailRows,
  StateFileSummary,
  timeGroupFromFileName,
} from '../../../../../../core/data-calculations/calculations.logic';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { areaIdSignal } from '../../_context/area-id';

const I18N = 'admin.dm_calc';
const TOAST_MS = 6000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The four uploads of a state (B1 Abbildung 30 «Zustand abc»). */
export type UploadKind = 'wlr_day' | 'wlr_night' | 'a9' | 'a7';
export const UPLOAD_KINDS: readonly UploadKind[] = ['wlr_day', 'wlr_night', 'a9', 'a7'];

interface Toast {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * 5.19 Datenverwaltung › Schiessplatz › Berechnungen › Import (`slm 19`,
 * B1 Abbildung 30): the Berechnungsdatei (validated FGDB as JSON) is read
 * in the browser, checked structurally (`checkStateFile`), then validated
 * by the API without writing (findings / warnings / counts) and imported
 * only after a clean validation. The states of the Schiessplatz are listed
 * on the right; for the selected one the WLR files (DAY / NIGHT) and the
 * Betriebsdaten (Anhang 9 / 7) are uploaded and the result of each upload
 * is shown (applied, replaced, unknown, errors).
 */
@Component({
  selector: 'app-dm-calc-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './dm-calc-import.component.html',
  styleUrl: './dm-calc-import.component.scss',
})
export class DmCalcImportComponent extends ComponentBase {
  private readonly facade = inject(DataCalculationsFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly prefix = I18N;
  protected readonly uploadKinds = UPLOAD_KINDS;
  readonly areaId = areaIdSignal(this.route);

  protected readonly saving = this.facade.saving;
  protected readonly importFindings = this.facade.importFindings;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly readonly = computed(() => !this.canWrite());

  // --- Berechnungsdatei --------------------------------------------------------

  protected readonly fileName = signal<string | null>(null);
  protected readonly fileProblems = signal<string[]>([]);
  protected readonly summary = signal<StateFileSummary | null>(null);
  private parsed: StateImportDto | null = null;
  protected readonly validation = signal<ImportValidationDto | null>(null);
  protected readonly imported = signal<{ stateName: string } | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    supplier: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    deliveredAt: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DATE)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  private submitted = signal(false);

  /** Import allowed after a clean validation of the current file (a changed form invalidates it). */
  protected readonly canImport = computed(() => !!this.summary() && this.validation()?.valid === true && !this.readonly());

  // --- Zustände / uploads -------------------------------------------------------

  protected readonly states = this.facade.states;
  protected readonly selectedStateId = signal<string | null>(null);
  protected readonly selectedState = computed<StateSummaryDto | null>(() => this.states().find((s) => s.id === this.selectedStateId()) ?? null);
  protected readonly details = this.facade.details;
  protected readonly detailCounts = computed(() => {
    const d = this.details();
    return d && d.state.id === this.selectedStateId() ? detailTabCounts(roomDetailRows(d, null)) : null;
  });
  protected readonly uploadResults = signal<Partial<Record<UploadKind, UploadResultDto & { fileName: string }>>>({});
  protected readonly wlrGroupOverride = signal<Partial<Record<'wlr_day' | 'wlr_night', 'day' | 'eve'>>>({});
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    // Preselect the current state; keep the choice while the list reloads.
    effect(() => {
      const states = this.states();
      untracked(() => {
        if (!states.length) return;
        if (!this.selectedStateId() || !states.some((s) => s.id === this.selectedStateId())) {
          this.selectState((states.find((s) => s.isCurrent) ?? states[0]).id);
        }
      });
    });
    effect(() => {
      const readonly = this.readonly();
      untracked(() => (readonly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
    // Any edit of the delivery fields needs a new validation.
    this.form.valueChanges.subscribe(() => this.validation.set(null));
    this.destroyRef.onDestroy(() => this.dismissToast());
  }

  /** The tab host loads the overview; nothing to fetch here. */
  override getData(): void {
    // intentionally empty — DataCalculationsFacade is loaded by DmCalcComponent
  }

  // --- Berechnungsdatei --------------------------------------------------------

  protected async pickFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    this.readFile(file.name, text);
  }

  /** Public for the specs: the file content as text. */
  readFile(name: string, text: string): void {
    this.facade.clearError();
    this.validation.set(null);
    this.imported.set(null);
    this.fileName.set(name);
    const check = checkStateFile(text);
    this.fileProblems.set(check.problems);
    this.summary.set(check.summary);
    this.parsed = check.state;
    if (check.summary) {
      this.form.reset(
        { name: check.summary.deliveryName, supplier: check.summary.supplier, deliveredAt: check.summary.deliveredAt, description: '' },
        { emitEvent: false },
      );
    }
  }

  protected invalid(control: 'name' | 'deliveredAt'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted());
  }

  private payload(): StateImportDto | null {
    if (!this.parsed) return null;
    const v = this.form.getRawValue();
    return {
      ...this.parsed,
      calculation: {
        ...this.parsed.calculation,
        name: v.name.trim(),
        supplier: v.supplier.trim(),
        deliveredAt: v.deliveredAt,
        description: v.description.trim() || null,
        fileName: this.fileName(),
      },
    };
  }

  protected async validate(): Promise<void> {
    this.submitted.set(true);
    const state = this.payload();
    if (!state || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const result = await this.facade.validateImport(this.areaId(), { fileName: this.fileName() ?? undefined, state });
    this.validation.set(result);
  }

  protected async importNow(): Promise<void> {
    const state = this.payload();
    if (!state || !this.canImport()) return;
    const report = await this.facade.importFile(this.areaId(), { fileName: this.fileName() ?? undefined, state });
    if (!report) return; // findings from the API stay visible
    this.imported.set({ stateName: state.state.name });
    this.showToast({ key: `${I18N}.toast_imported`, params: { name: state.state.name, sources: report.counts.sources, wlr: report.counts.wlr } });
    this.selectState(report.stateId);
    this.reset();
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected reset(): void {
    this.fileName.set(null);
    this.fileProblems.set([]);
    this.summary.set(null);
    this.parsed = null;
    this.validation.set(null);
    this.form.reset({ name: '', supplier: '', deliveredAt: '', description: '' }, { emitEvent: false });
    this.submitted.set(false);
  }

  // --- Zustände / uploads -------------------------------------------------------

  protected selectState(id: string): void {
    this.selectedStateId.set(id);
    this.uploadResults.set({});
    void this.facade.loadDetails(this.areaId(), id);
  }

  protected async pickUpload(kind: UploadKind, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.upload(kind, file.name, await file.text());
  }

  /** Public for the specs. */
  async upload(kind: UploadKind, fileName: string, text: string): Promise<void> {
    const state = this.selectedState();
    // A state without model has no sources / points the rows could attach to (B1 5.19 uploads follow the import).
    if (!state || !state.hasModel || this.readonly()) return;
    let result: UploadResultDto | null;
    if (kind === 'wlr_day' || kind === 'wlr_night') {
      const detected = timeGroupFromFileName(fileName);
      const timeGroup = this.wlrGroupOverride()[kind] ?? detected ?? (kind === 'wlr_day' ? 'day' : 'eve');
      result = await this.facade.uploadWlr(this.areaId(), state.id, { timeGroup, text, fileName });
    } else {
      const annex = kind === 'a9' ? 9 : 7;
      const detected = annexFromFileName(fileName);
      result = await this.facade.uploadOperatingData(this.areaId(), state.id, { annex: (detected ?? annex) as 9 | 7, text, fileName });
    }
    if (!result) return;
    this.uploadResults.update((r) => ({ ...r, [kind]: { ...result, fileName } }));
    if (!result.errors.length) {
      this.showToast({ key: `${I18N}.toast_uploaded`, params: { applied: result.applied, rows: result.rows } });
      this.emit(EDataEmitterAction.DATA_RELOAD);
    }
  }

  protected setWlrGroup(kind: 'wlr_day' | 'wlr_night', value: 'day' | 'eve'): void {
    this.wlrGroupOverride.update((o) => ({ ...o, [kind]: value }));
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
