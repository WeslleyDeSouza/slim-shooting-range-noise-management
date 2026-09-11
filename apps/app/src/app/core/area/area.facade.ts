import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminAreaService,
  AreaResultDto,
  AreaSummaryDto,
  DashboardDto,
} from '@ui-slim/apiClient';
import { SignalStore } from '../store/signal-store';

/** Traffic-light status as the API declares it (generated model). */
export type AreaStatus = AreaResultDto['quotaStatus'];

export const NEEDS_ATTENTION: readonly AreaStatus[] = ['warn', 'over'];

export function needsAttention(
  area: Pick<AreaResultDto, 'quotaStatus' | 'noiseStatus'>,
): boolean {
  return (
    NEEDS_ATTENTION.includes(area.quotaStatus) ||
    NEEDS_ATTENTION.includes(area.noiseStatus)
  );
}

interface AreaState {
  areas: AreaResultDto[];
  summary: AreaSummaryDto;
  dashboard: DashboardDto | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY_SUMMARY: AreaSummaryDto = {
  total: 0,
  ok: 0,
  warn: 0,
  over: 0,
  none: 0,
  attention: 0,
};

/**
 * Areas (Schiessplätze) of the signed-in tenant. Facade + own signal store
 * (ELO pattern, no NgRx) over the generated `AdminAreaService`
 * (`@ui-slim/apiClient`). Models come from the API — nothing is typed by
 * hand here.
 */
@Injectable({ providedIn: 'root' })
export class AreaFacade extends SignalStore<AreaState> {
  private readonly api = inject(AdminAreaService);

  readonly areas = this.select((s) => s.areas);
  readonly summary = this.select((s) => s.summary);
  readonly dashboard = this.select((s) => s.dashboard);
  readonly attention = this.select((s) => s.areas.filter(needsAttention));
  readonly loaded = this.select((s) => s.loaded);
  readonly loading = this.select((s) => s.loading);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({
      areas: [],
      summary: EMPTY_SUMMARY,
      dashboard: null,
      loaded: false,
      loading: false,
      error: null,
    });
  }

  /**
   * Loads list, summary and dashboard counts. Called from `getData()` of the
   * pages (ComponentBase: on init and on every DATA_RELOAD, e.g. after a
   * tenant switch), so it always fetches; concurrent calls are deduplicated.
   */
  async load(): Promise<void> {
    if (this.snapshot().loading) return;
    this.patch({ loading: true, error: null });
    try {
      const [areas, summary, dashboard] = await Promise.all([
        firstValueFrom(this.api.adminAreaList()),
        firstValueFrom(this.api.adminAreaSummary()),
        firstValueFrom(this.api.adminAreaDashboard()),
      ]);
      this.patch({ areas, summary, dashboard, loaded: true, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: toMessage(error) });
    }
  }

  byId(id: string): AreaResultDto | undefined {
    return this.snapshot().areas.find((a) => a.id === id);
  }
}

function toMessage(error: unknown): string {
  const err = error as {
    error?: { message?: string | string[] };
    message?: string;
  };
  const body = err?.error?.message;
  if (Array.isArray(body)) return body.join(' · ');
  return body || err?.message || 'Unknown error';
}
