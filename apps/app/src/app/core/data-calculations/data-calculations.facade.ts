import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminDataCalculationsService,
  CalculationsOverviewDto,
  DeliveryCreateDto,
  DeliveryDto,
  DeliveryUpdateDto,
  ImportReportDto,
  ImportValidationDto,
  OperatingDataUploadDto,
  ShotYearsDto,
  StateCreateDto,
  StateDetailsDto,
  StateFileImportDto,
  StateSummaryDto,
  StateUpdateDto,
  UploadResultDto,
  WlrUploadDto,
} from '@ui-slim/apiClient';
import { apiErrorBody, apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface DataCalculationsState {
  areaId: string;
  overview: CalculationsOverviewDto | null;
  details: StateDetailsDto | null;
  detailsStateId: string | null;
  years: ShotYearsDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Findings of an import that the API refused (400 with the staging findings). */
  importFindings: string[];
}

/**
 * Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18–5.21): the
 * deliveries with their states, the pointer / edit / delete calls, the
 * validated import with its uploads, the exports and the per-room details —
 * all over the generated `AdminDataCalculationsService`. Every mutation
 * reloads the overview so the tables and the pointers never go stale.
 */
@Injectable({ providedIn: 'root' })
export class DataCalculationsFacade extends SignalStore<DataCalculationsState> {
  private readonly api = inject(AdminDataCalculationsService);

  readonly areaId = this.select((s) => s.areaId);
  readonly overview = this.select((s) => s.overview);
  readonly deliveries = this.select((s) => s.overview?.deliveries ?? []);
  readonly states = this.select((s) => (s.overview?.deliveries ?? []).flatMap((d) => d.states.map((state) => ({ ...state, delivery: d }))));
  readonly currentStateId = this.select((s) => s.overview?.currentStateId ?? null);
  readonly mgdmStateId = this.select((s) => s.overview?.mgdmStateId ?? null);
  readonly details = this.select((s) => s.details);
  readonly detailsStateId = this.select((s) => s.detailsStateId);
  readonly years = this.select((s) => s.years?.years ?? []);
  readonly loading = this.select((s) => s.loading);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);
  readonly importFindings = this.select((s) => s.importFindings);

  constructor() {
    super({ areaId: '', overview: null, details: null, detailsStateId: null, years: null, loading: false, saving: false, error: null, importFindings: [] });
  }

  /** Overview of the Schiessplatz (5.18); a switch of the area clears the old data first. */
  async load(areaId: string): Promise<void> {
    if (!areaId) return;
    if (this.snapshot().areaId !== areaId) this.patch({ areaId, overview: null, details: null, detailsStateId: null, years: null });
    this.patch({ loading: true, error: null });
    try {
      const overview = await firstValueFrom(this.api.adminDataCalculationsOverview({ areaId }));
      this.patch({ overview, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  async loadDetails(areaId: string, stateId: string): Promise<void> {
    this.patch({ loading: true, error: null, detailsStateId: stateId });
    try {
      const details = await firstValueFrom(this.api.adminDataCalculationsDetails({ areaId, stateId }));
      if (this.snapshot().detailsStateId !== stateId) return;
      this.patch({ details, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  async loadYears(areaId: string): Promise<void> {
    try {
      const years = await firstValueFrom(this.api.adminDataCalculationsShotYears({ areaId }));
      this.patch({ years });
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
    }
  }

  // --- 5.18 ------------------------------------------------------------------

  createDelivery(areaId: string, body: DeliveryCreateDto): Promise<DeliveryDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsCreateDelivery({ areaId, body })));
  }

  updateDelivery(areaId: string, id: string, body: DeliveryUpdateDto): Promise<DeliveryDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsUpdateDelivery({ areaId, id, body })));
  }

  async deleteDelivery(areaId: string, id: string): Promise<boolean> {
    return (await this.mutate(areaId, async () => {
      await firstValueFrom(this.api.adminDataCalculationsDeleteDelivery({ areaId, id }));
      return true;
    })) === true;
  }

  createState(areaId: string, body: StateCreateDto): Promise<StateSummaryDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsCreateState({ areaId, body })));
  }

  updateState(areaId: string, stateId: string, body: StateUpdateDto): Promise<StateSummaryDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsUpdateState({ areaId, stateId, body })));
  }

  setPointer(areaId: string, stateId: string, pointer: 'current' | 'mgdm'): Promise<StateSummaryDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsSetPointer({ areaId, stateId, body: { pointer } })));
  }

  // --- 5.19 ------------------------------------------------------------------

  async validateImport(areaId: string, body: StateFileImportDto): Promise<ImportValidationDto | null> {
    this.patch({ saving: true, error: null, importFindings: [] });
    try {
      const result = await firstValueFrom(this.api.adminDataCalculationsValidate({ areaId, body }));
      this.patch({ saving: false });
      return result;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  async importFile(areaId: string, body: StateFileImportDto): Promise<ImportReportDto | null> {
    this.patch({ saving: true, error: null, importFindings: [] });
    try {
      const report = await firstValueFrom(this.api.adminDataCalculationsImportFile({ areaId, body }));
      await this.reload(areaId);
      this.patch({ saving: false });
      return report;
    } catch (error) {
      const parsed = apiErrorBody(error);
      const findings = parsed && typeof parsed === 'object' && Array.isArray(parsed['findings']) ? (parsed['findings'] as string[]) : [];
      this.patch({ saving: false, error: findings.length ? null : apiErrorMessage(error), importFindings: findings });
      return null;
    }
  }

  uploadWlr(areaId: string, stateId: string, body: WlrUploadDto): Promise<UploadResultDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsUploadWlr({ areaId, stateId, body })));
  }

  uploadOperatingData(areaId: string, stateId: string, body: OperatingDataUploadDto): Promise<UploadResultDto | null> {
    return this.mutate(areaId, () => firstValueFrom(this.api.adminDataCalculationsUploadOperatingData({ areaId, stateId, body })));
  }

  // --- 5.20 ------------------------------------------------------------------

  async exportStates(areaId: string, stateIds: string[]): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.api.adminDataCalculationsExportStates({ areaId, body: { stateIds } }));
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
      return null;
    }
  }

  async exportShots(areaId: string, years: number[]): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.api.adminDataCalculationsExportShots({ areaId, body: { years } }));
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
      return null;
    }
  }

  clearError(): void {
    this.patch({ error: null, importFindings: [] });
  }

  private async mutate<T>(areaId: string, run: () => Promise<T>): Promise<T | null> {
    this.patch({ saving: true, error: null });
    try {
      const result = await run();
      await this.reload(areaId);
      this.patch({ saving: false });
      return result;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  private async reload(areaId: string): Promise<void> {
    const overview = await firstValueFrom(this.api.adminDataCalculationsOverview({ areaId }));
    this.patch({ overview });
    const stateId = this.snapshot().detailsStateId;
    if (stateId && overview.deliveries.some((d) => d.states.some((s) => s.id === stateId))) {
      const details = await firstValueFrom(this.api.adminDataCalculationsDetails({ areaId, stateId }));
      this.patch({ details });
    }
  }
}
