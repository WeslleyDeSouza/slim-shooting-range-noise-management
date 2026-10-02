import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminDataSystemService, AdminSettingsService } from '@ui-slim/apiClient';
import type { SystemSettingsDto, SystemSettingsUpdateDto } from '@ui-slim/apiClient';
import { SlimThemeService } from '@ui-slim/design-system';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface SettingsState {
  settings: SystemSettingsDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Erweiterte Konfiguration (B1 5.28): Sperrdatum, Schwellenwerte und Farben
 * der Ampeln, Kontakte, Benutzerhandbuch. Read by every signed-in user
 * (`AdminSettingsService`, loaded by the admin layout) and changed by the
 * Applikationsadministrator (`AdminDataSystemService`, mask 5.28). The
 * Ampel colours are applied to the design tokens `success` / `warning` /
 * `danger` as soon as they are known.
 */
@Injectable({ providedIn: 'root' })
export class SettingsFacade extends SignalStore<SettingsState> {
  private readonly api = inject(AdminSettingsService);
  private readonly admin = inject(AdminDataSystemService);
  private readonly theme = inject(SlimThemeService);

  readonly settings = this.select((s) => s.settings);
  readonly loaded = this.select((s) => s.settings !== null);
  /** Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD) or null. */
  readonly usageLockDate = this.select((s) => s.settings?.usageLockDate ?? null);
  readonly manual = this.select((s) => s.settings?.manual ?? null);
  readonly loading = this.select((s) => s.loading);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ settings: null, loading: false, saving: false, error: null });
  }

  async load(): Promise<void> {
    if (this.snapshot().loading) return;
    this.patch({ loading: true, error: null });
    try {
      this.apply(await firstValueFrom(this.api.adminSettingsGet()));
      this.patch({ loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  /** Mask 5.28: saves the given fields; `null` resets a field to its default. */
  async update(body: SystemSettingsUpdateDto): Promise<boolean> {
    return this.mutate(async () => this.apply(await firstValueFrom(this.admin.adminDataSystemUpdate({ body }))));
  }

  /** Uploads the Benutzerhandbuch (PDF); it replaces the stored one. */
  async uploadManual(file: Blob): Promise<boolean> {
    return this.mutate(async () => {
      const manual = await firstValueFrom(this.admin.adminDataSystemUploadManual({ body: { file } }));
      const settings = this.snapshot().settings;
      if (settings) this.patch({ settings: { ...settings, manual } });
    });
  }

  async removeManual(): Promise<boolean> {
    return this.mutate(async () => {
      await firstValueFrom(this.admin.adminDataSystemRemoveManual());
      const settings = this.snapshot().settings;
      if (settings) this.patch({ settings: { ...settings, manual: null } });
    });
  }

  /** The stored PDF, for the download of the main menu and of the mask. */
  async manualFile(): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.api.adminSettingsManual());
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
      return null;
    }
  }

  private async mutate(run: () => Promise<void>): Promise<boolean> {
    this.patch({ saving: true, error: null });
    try {
      await run();
      this.patch({ saving: false });
      return true;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return false;
    }
  }

  private apply(settings: SystemSettingsDto): void {
    this.patch({ settings });
    // The Ampel colours are the tokens every light, pin and meter uses; an unset colour falls back to the design.
    this.theme.resetColors();
    const colors: Record<string, string> = {};
    if (settings.colorOk) colors['success'] = settings.colorOk;
    if (settings.colorWarn) colors['warning'] = settings.colorWarn;
    if (settings.colorOver) colors['danger'] = settings.colorOver;
    if (Object.keys(colors).length) this.theme.setColors(colors);
  }
}

/** Hands a file to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
