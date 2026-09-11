import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminUsageService,
  UsageCreateDto,
  UsageKpiDto,
  UsageResultDto,
  UsageRoomDto,
  UsageUpdateDto,
  UsageWeaponDto,
} from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface UsageState {
  areaId: string | null;
  year: number;
  kpi: UsageKpiDto | null;
  rooms: UsageRoomDto[];
  weapons: UsageWeaponDto[];
  usages: UsageResultDto[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Schiessplatz-Nutzungen of one area (5.11 «Schusszahlen»). Facade + own
 * signal store over the generated `AdminUsageService`; the page filters and
 * sorts the loaded year locally (the API returns one calendar year).
 */
@Injectable({ providedIn: 'root' })
export class UsageFacade extends SignalStore<UsageState> {
  private readonly api = inject(AdminUsageService);

  readonly areaId = this.select((s) => s.areaId);
  readonly year = this.select((s) => s.year);
  readonly kpi = this.select((s) => s.kpi);
  readonly rooms = this.select((s) => s.rooms);
  readonly weapons = this.select((s) => s.weapons);
  readonly usages = this.select((s) => s.usages);
  readonly loading = this.select((s) => s.loading);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({
      areaId: null,
      year: new Date().getFullYear(),
      kpi: null,
      rooms: [],
      weapons: [],
      usages: [],
      loading: false,
      saving: false,
      error: null,
    });
  }

  /** Loads rooms, weapons, KPIs and the usages of `year` for the area. */
  async load(areaId: string, year = this.snapshot().year): Promise<void> {
    this.patch({ areaId, year, loading: true, error: null });
    try {
      const overview = await firstValueFrom(this.api.adminUsageOverview({ areaId, year: String(year) }));
      // A stale response of a previous area / year must not overwrite the newer one.
      const state = this.snapshot();
      if (state.areaId !== areaId || state.year !== year) return;
      this.patch({ ...overview, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  async create(dto: UsageCreateDto): Promise<UsageResultDto | null> {
    return this.mutate(async (areaId) => {
      const created = await firstValueFrom(this.api.adminUsageCreate({ areaId, body: dto }));
      await this.reload();
      return created;
    });
  }

  /** Named `updateUsage`: `update(reducer)` is the protected store method of SignalStore. */
  async updateUsage(id: string, dto: UsageUpdateDto): Promise<UsageResultDto | null> {
    return this.mutate(async (areaId) => {
      const updated = await firstValueFrom(this.api.adminUsageUpdate({ areaId, id, body: dto }));
      await this.reload();
      return updated;
    });
  }

  /** Soft delete; returns the ids actually removed (for the undo toast). */
  async remove(ids: string[]): Promise<string[]> {
    const result = await this.mutate(async (areaId) => {
      const removed = await firstValueFrom(this.api.adminUsageRemove({ areaId, body: { ids } }));
      await this.reload();
      return removed.ids;
    });
    return result ?? [];
  }

  async restore(ids: string[]): Promise<string[]> {
    const result = await this.mutate(async (areaId) => {
      const restored = await firstValueFrom(this.api.adminUsageRestore({ areaId, body: { ids } }));
      await this.reload();
      return restored.ids;
    });
    return result ?? [];
  }

  private async reload(): Promise<void> {
    const { areaId, year } = this.snapshot();
    if (areaId) await this.load(areaId, year);
  }

  private async mutate<T>(action: (areaId: string) => Promise<T>): Promise<T | null> {
    const areaId = this.snapshot().areaId;
    if (!areaId) return null;
    this.patch({ saving: true, error: null });
    try {
      return await action(areaId);
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
      return null;
    } finally {
      this.patch({ saving: false });
    }
  }
}
