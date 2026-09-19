import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminDataAreaService,
  AreaGeneralDto,
  AreaQuotaDto,
  AreaQuotaInputDto,
  AreaQuotaUpdateDto,
  AreaResultDto,
  AreaUpdateDto,
} from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface DataAreaState {
  /** Schiessplatz the read model belongs to ('' before the first load). */
  areaId: string;
  general: AreaGeneralDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 Übersicht, 5.16
 * Stammdaten) of one Schiessplatz: read model, Stammdaten update and the
 * Kontingent CRUD over the generated `AdminDataAreaService`. Pages read the
 * signals; every mutation patches the read model from the API's answer so
 * the tables never show stale rows.
 */
@Injectable({ providedIn: 'root' })
export class DataAreaFacade extends SignalStore<DataAreaState> {
  private readonly api = inject(AdminDataAreaService);

  readonly areaId = this.select((s) => s.areaId);
  readonly general = this.select((s) => s.general);
  readonly area = this.select((s) => s.general?.area ?? null);
  readonly rooms = this.select((s) => s.general?.rooms ?? []);
  readonly quotas = this.select((s) => s.general?.quotas ?? []);
  readonly combinations = this.select((s) => s.general?.combinations ?? []);
  readonly loading = this.select((s) => s.loading);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ areaId: '', general: null, loading: false, saving: false, error: null });
  }

  /** Always fetches (ComponentBase `getData()` on init and every DATA_RELOAD); a switch of the area clears the old model first. */
  async load(areaId: string): Promise<void> {
    if (!areaId) return;
    if (this.snapshot().areaId !== areaId) this.patch({ areaId, general: null });
    this.patch({ loading: true, error: null });
    try {
      const general = await firstValueFrom(this.api.adminDataAreaGeneral({ areaId }));
      this.patch({ general, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  /** 5.16 Stammdaten. Resolves to the saved area or null (error kept in `error`). */
  async updateArea(areaId: string, body: AreaUpdateDto): Promise<AreaResultDto | null> {
    this.patch({ saving: true, error: null });
    try {
      const area = await firstValueFrom(this.api.adminDataAreaUpdate({ areaId, body }));
      this.update((s) => ({ ...s, saving: false, general: s.general ? { ...s.general, area } : s.general }));
      return area;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  async createQuota(areaId: string, body: AreaQuotaInputDto): Promise<AreaQuotaDto | null> {
    this.patch({ saving: true, error: null });
    try {
      const quota = await firstValueFrom(this.api.adminDataAreaCreateQuota({ areaId, body }));
      await this.load(areaId);
      this.patch({ saving: false });
      return quota;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  async updateQuota(areaId: string, id: string, body: AreaQuotaUpdateDto): Promise<AreaQuotaDto | null> {
    this.patch({ saving: true, error: null });
    try {
      const quota = await firstValueFrom(this.api.adminDataAreaUpdateQuota({ areaId, id, body }));
      await this.load(areaId);
      this.patch({ saving: false });
      return quota;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  async deleteQuota(areaId: string, id: string): Promise<boolean> {
    this.patch({ saving: true, error: null });
    try {
      await firstValueFrom(this.api.adminDataAreaDeleteQuota({ areaId, id }));
      await this.load(areaId);
      this.patch({ saving: false });
      return true;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return false;
    }
  }

  clearError(): void {
    this.patch({ error: null });
  }
}
