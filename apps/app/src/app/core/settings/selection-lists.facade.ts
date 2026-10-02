import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AdminDataSystemService, AdminSettingsService } from '@ui-slim/apiClient';
import type { SelectionListDto, SelectionListValueCreateDto, SelectionListValueDto, SelectionListValueUpdateDto } from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

/** Keys of the Auswahllisten the API maintains (`SELECTION_LIST_KEYS` in the API). */
export type SelectionListKey =
  | 'classification'
  | 'recalculation_state'
  | 'remediation_project_state'
  | 'spm_state'
  | 'noise_remediation_state'
  | 'project_state'
  | 'civil_usage_kind';

interface SelectionListsState {
  lists: SelectionListDto[];
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Auswahllisten (B1 5.3, slm 1): the values the pick lists of the masks
 * offer and their labels in the language of the user. Loaded by the admin
 * layout for every signed-in user; maintained by the
 * Applikationsadministrator in the erweiterte Konfiguration.
 */
@Injectable({ providedIn: 'root' })
export class SelectionListsFacade extends SignalStore<SelectionListsState> {
  private readonly api = inject(AdminSettingsService);
  private readonly admin = inject(AdminDataSystemService);
  private readonly translate = inject(TranslateService);

  readonly lists = this.select((s) => s.lists);
  readonly loaded = this.select((s) => s.loaded);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ lists: [], loaded: false, loading: false, saving: false, error: null });
  }

  async load(): Promise<void> {
    if (this.snapshot().loading) return;
    this.patch({ loading: true, error: null });
    try {
      this.patch({ lists: await firstValueFrom(this.api.adminSettingsLists()), loaded: true, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  /** All values of a list, active and inactive, in the order of the selection. */
  values(key: SelectionListKey): SelectionListValueDto[] {
    return this.lists().find((l) => l.key === key)?.values ?? [];
  }

  /**
   * What a select offers: the active values — plus the value a record
   * already carries (`current`) when that one has been set inactive since.
   */
  options(key: SelectionListKey, current?: string | null): SelectionListValueDto[] {
    return this.values(key).filter((v) => v.enabled || v.code === current);
  }

  /** Label of a value in the language of the user; German when that language has none, the code when the value is unknown. */
  label(key: SelectionListKey, code: string | null | undefined): string {
    if (!code) return '';
    const value = this.values(key).find((v) => v.code === code);
    return value ? labelOf(value, this.translate.lang) : code;
  }

  /** Mask «Auswahllisten»: adds a value. */
  async create(key: SelectionListKey, body: SelectionListValueCreateDto): Promise<boolean> {
    return this.mutate(() => firstValueFrom(this.admin.adminDataSystemCreateListValue({ list: key, body })));
  }

  /** Mask «Auswahllisten»: changes labels, position or the active flag of a value. */
  async updateValue(key: SelectionListKey, code: string, body: SelectionListValueUpdateDto): Promise<boolean> {
    return this.mutate(() => firstValueFrom(this.admin.adminDataSystemUpdateListValue({ list: key, code, body })));
  }

  private async mutate(run: () => Promise<SelectionListDto>): Promise<boolean> {
    this.patch({ saving: true, error: null });
    try {
      const list = await run();
      this.patch({ saving: false, lists: this.snapshot().lists.map((l) => (l.key === list.key ? list : l)) });
      return true;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return false;
    }
  }
}

/** The label of a value for a language (`de`, `fr`, `it`, `en`), German as fallback. */
export function labelOf(value: SelectionListValueDto, lang: string | null | undefined): string {
  const own = lang === 'fr' ? value.labelFr : lang === 'it' ? value.labelIt : lang === 'en' ? value.labelEn : value.labelDe;
  return own || value.labelDe;
}
