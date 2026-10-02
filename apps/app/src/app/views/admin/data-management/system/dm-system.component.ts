import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { SLIM_APP_ID } from '@slim/shared';
import type { SystemSettingsDto, SystemSettingsUpdateDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../core/access/access.facade';
import { saveBlob, SettingsFacade } from '../../../../core/settings/settings.facade';
import { HasUnsavedChanges } from '../../_common/unsaved-changes.guard';
import { DmSelectionListsComponent } from './dm-selection-lists.component';

const I18N = 'admin.dm_system';
const TOAST_MS = 6000;
/** Largest Benutzerhandbuch the API stores (`MANUAL_MAX_BYTES`). */
const MANUAL_MAX_BYTES = 15 * 1024 * 1024;

/** Thresholds of B1 5.10 — what «Standard wiederherstellen» puts back. */
export const THRESHOLD_DEFAULTS = { quotaGreenMaxPercent: 100, quotaOrangeMaxPercent: 125, noiseGreenMaxDb: -5, noiseOrangeMaxDb: 0 } as const;

/**
 * Ampel colours of the design (tokens `success` / `warning` / `danger`, light
 * theme): what the colour fields show while no own colour is set. A spec
 * keeps them in step with `_tokens.scss`.
 */
export const AMPEL_DEFAULT_COLORS = { colorOk: '#1e7a3c', colorWarn: '#8a6100', colorOver: '#c71624' } as const;

type ColorField = keyof typeof AMPEL_DEFAULT_COLORS;
const TEXT_FIELDS = ['specialistName', 'specialistPhone', 'specialistEmail', 'sysadminName', 'sysadminPhone', 'sysadminEmail'] as const;

/** Each Ampel needs «orange» at or above «grün», otherwise orange could never show. */
function thresholdOrder(group: AbstractControl): ValidationErrors | null {
  const v = group.value as Record<string, number | null>;
  const errors: ValidationErrors = {};
  if (v['quotaGreenMaxPercent'] !== null && v['quotaOrangeMaxPercent'] !== null && Number(v['quotaOrangeMaxPercent']) < Number(v['quotaGreenMaxPercent'])) errors['quotaOrder'] = true;
  if (v['noiseGreenMaxDb'] !== null && v['noiseOrangeMaxDb'] !== null && Number(v['noiseOrangeMaxDb']) < Number(v['noiseGreenMaxDb'])) errors['noiseOrder'] = true;
  return Object.keys(errors).length ? errors : null;
}

/**
 * Datenverwaltung › Erweiterte Konfiguration (B1 5.28, Abbildung 40, slm 27):
 * Sperrdatum der Schusszahlenerfassung, Benutzerhandbuch (PDF), Schwellenwerte
 * und Farben der Ampeln — Kontingent Plangenehmigung in Prozent, Empfangspunkte
 * in dB (FAQ 166) — the contacts of the main menu (B1 5.9) and the
 * Auswahllisten (B1 5.3, slm 1; `DmSelectionListsComponent`). Only the
 * Applikationsadministrator may change it. Data: SettingsFacade.
 */
@Component({
  selector: 'app-dm-system',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, DmSelectionListsComponent],
  templateUrl: './dm-system.component.html',
  styleUrl: './dm-system.component.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DmSystemComponent extends ComponentBase implements HasUnsavedChanges {
  private readonly facade = inject(SettingsFacade);
  private readonly access = inject(AccessFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly prefix = I18N;
  protected readonly settings = this.facade.settings;
  protected readonly manual = this.facade.manual;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;

  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_SYSTEM);
  /** Read-only until the rights are known to allow writing. */
  protected readonly readonly = computed(() => !this.canWrite());

  protected readonly colorFields: readonly { field: ColorField; state: 'ok' | 'warn' | 'over' }[] = [
    { field: 'colorOk', state: 'ok' },
    { field: 'colorWarn', state: 'warn' },
    { field: 'colorOver', state: 'over' },
  ];

  protected readonly form = this.fb.group(
    {
      usageLockDate: this.fb.control<string>(''),
      quotaGreenMaxPercent: this.fb.control<number | null>(THRESHOLD_DEFAULTS.quotaGreenMaxPercent, [Validators.required, Validators.min(1), Validators.max(1000)]),
      quotaOrangeMaxPercent: this.fb.control<number | null>(THRESHOLD_DEFAULTS.quotaOrangeMaxPercent, [Validators.required, Validators.min(1), Validators.max(1000)]),
      noiseGreenMaxDb: this.fb.control<number | null>(THRESHOLD_DEFAULTS.noiseGreenMaxDb, [Validators.required, Validators.min(-50), Validators.max(50)]),
      noiseOrangeMaxDb: this.fb.control<number | null>(THRESHOLD_DEFAULTS.noiseOrangeMaxDb, [Validators.required, Validators.min(-50), Validators.max(50)]),
      colorOk: this.fb.control<string | null>(null),
      colorWarn: this.fb.control<string | null>(null),
      colorOver: this.fb.control<string | null>(null),
      specialistName: this.fb.control<string>('', Validators.maxLength(200)),
      specialistPhone: this.fb.control<string>('', Validators.maxLength(60)),
      specialistEmail: this.fb.control<string>('', [Validators.email, Validators.maxLength(200)]),
      sysadminName: this.fb.control<string>('', Validators.maxLength(200)),
      sysadminPhone: this.fb.control<string>('', Validators.maxLength(60)),
      sysadminEmail: this.fb.control<string>('', [Validators.email, Validators.maxLength(200)]),
    },
    { validators: thresholdOrder },
  );

  protected readonly dirty = signal(false);
  protected readonly submitted = signal(false);
  protected readonly manualError = signal<string | null>(null);
  protected readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly confirmDiscard = signal(false);
  private discardResolver: ((leave: boolean) => void) | null = null;

  constructor() {
    super();
    this.form.valueChanges.subscribe(() => this.dirty.set(this.form.dirty));

    // Loaded or saved settings fill the form — unless the user is in the middle of a change.
    effect(() => {
      const settings = this.settings();
      if (settings) untracked(() => !this.dirty() && this.fill(settings));
    });
    // The form follows the right to write (known only after the rights are loaded).
    effect(() => {
      const readonly = this.readonly();
      untracked(() => (readonly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    void this.facade.load();
    void this.access.load();
  }

  protected invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  /** The colour a field shows: the own colour, else the colour of the design. */
  protected colorOf(field: ColorField): string {
    return this.form.controls[field].value ?? AMPEL_DEFAULT_COLORS[field];
  }

  protected pickColor(field: ColorField, value: string): void {
    this.form.controls[field].setValue(value.toLowerCase());
    this.form.controls[field].markAsDirty();
    this.dirty.set(true);
  }

  protected resetColor(field: ColorField): void {
    this.form.controls[field].setValue(null);
    this.form.controls[field].markAsDirty();
    this.dirty.set(true);
  }

  /** «Standard wiederherstellen»: the thresholds of B1 5.10 and the colours of the design. */
  protected restoreDefaults(): void {
    if (this.readonly()) return;
    this.form.patchValue({ ...THRESHOLD_DEFAULTS, colorOk: null, colorWarn: null, colorOver: null });
    this.form.markAsDirty();
    this.dirty.set(true);
  }

  protected clearLockDate(): void {
    this.form.controls.usageLockDate.setValue('');
    this.form.controls.usageLockDate.markAsDirty();
    this.dirty.set(true);
  }

  protected async save(): Promise<void> {
    if (this.readonly() || this.saving()) return;
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SystemSettingsUpdateDto = {
      usageLockDate: v.usageLockDate || null,
      quotaGreenMaxPercent: v.quotaGreenMaxPercent,
      quotaOrangeMaxPercent: v.quotaOrangeMaxPercent,
      noiseGreenMaxDb: v.noiseGreenMaxDb,
      noiseOrangeMaxDb: v.noiseOrangeMaxDb,
      colorOk: v.colorOk,
      colorWarn: v.colorWarn,
      colorOver: v.colorOver,
    };
    for (const field of TEXT_FIELDS) body[field] = v[field]?.trim() || null;
    if (!(await this.facade.save(body))) return;
    this.form.markAsPristine();
    this.dirty.set(false);
    this.submitted.set(false);
    const saved = this.settings();
    if (saved) this.fill(saved);
    this.showToast(`${I18N}.toast_saved`);
    // Sperrdatum, lights and menu of the other pages follow.
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected cancel(): void {
    const settings = this.settings();
    if (settings) this.fill(settings);
  }

  // ----- Benutzerhandbuch ----------------------------------------------------

  protected async pickManual(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.readonly()) return;
    this.manualError.set(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.manualError.set(`${I18N}.manual_not_pdf`);
      return;
    }
    if (file.size > MANUAL_MAX_BYTES) {
      this.manualError.set(`${I18N}.manual_too_large`);
      return;
    }
    if (await this.facade.uploadManual(file)) {
      this.showToast(`${I18N}.toast_manual_uploaded`);
      this.emit(EDataEmitterAction.DATA_RELOAD);
    }
  }

  protected async removeManual(): Promise<void> {
    if (this.readonly()) return;
    if (await this.facade.removeManual()) {
      this.showToast(`${I18N}.toast_manual_removed`);
      this.emit(EDataEmitterAction.DATA_RELOAD);
    }
  }

  protected async downloadManual(): Promise<void> {
    const manual = this.manual();
    if (!manual) return;
    const blob = await this.facade.manualFile();
    if (blob) saveBlob(blob, manual.fileName);
  }

  // ----- leaving with unsaved changes ------------------------------------------

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.dirty()) return true;
    this.confirmDiscard.set(true);
    return new Promise<boolean>((resolve) => (this.discardResolver = resolve));
  }

  protected resolveDiscard(leave: boolean): void {
    this.confirmDiscard.set(false);
    const resolve = this.discardResolver;
    this.discardResolver = null;
    if (leave) {
      this.form.markAsPristine();
      this.dirty.set(false);
    }
    resolve?.(leave);
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  protected dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.set(null);
  }

  private showToast(key: string): void {
    this.toast.set(key);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }

  private fill(settings: SystemSettingsDto): void {
    this.form.reset(
      {
        usageLockDate: settings.usageLockDate ?? '',
        quotaGreenMaxPercent: settings.quotaGreenMaxPercent,
        quotaOrangeMaxPercent: settings.quotaOrangeMaxPercent,
        noiseGreenMaxDb: settings.noiseGreenMaxDb,
        noiseOrangeMaxDb: settings.noiseOrangeMaxDb,
        colorOk: settings.colorOk,
        colorWarn: settings.colorWarn,
        colorOver: settings.colorOver,
        specialistName: settings.specialistName ?? '',
        specialistPhone: settings.specialistPhone ?? '',
        specialistEmail: settings.specialistEmail ?? '',
        sysadminName: settings.sysadminName ?? '',
        sysadminPhone: settings.sysadminPhone ?? '',
        sysadminEmail: settings.sysadminEmail ?? '',
      },
      { emitEvent: false },
    );
    this.dirty.set(false);
    this.submitted.set(false);
  }
}
