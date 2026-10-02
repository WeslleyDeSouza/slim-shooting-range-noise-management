import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminCalculationService, MapPlantPartDto } from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface MapState {
  /** `<areaId>|<calculationId>` the objects belong to ('' before the first load). */
  key: string;
  plantParts: MapPlantPartDto[];
  loading: boolean;
  error: string | null;
}

/**
 * Map objects of one Zustand for the GIS-Kartenviewer (slm 2, B1 5.10): the
 * Anlagenteile with their LV95 geometry over
 * `AdminCalculationService.adminCalculationMap`. The Empfangspunkte come with
 * the assessment / simulation of the page that shows the map.
 */
@Injectable({ providedIn: 'root' })
export class MapFacade extends SignalStore<MapState> {
  private readonly api = inject(AdminCalculationService);

  readonly plantParts = this.select((s) => s.plantParts);
  readonly loading = this.select((s) => s.loading);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ key: '', plantParts: [], loading: false, error: null });
  }

  /** Always fetches; another area or state clears the old objects first so the map never mixes two states. */
  async load(areaId: string, calculationId?: string | null): Promise<void> {
    if (!areaId) return;
    const key = `${areaId}|${calculationId ?? ''}`;
    if (this.snapshot().key !== key) this.patch({ key, plantParts: [] });
    this.patch({ loading: true, error: null });
    try {
      const map = await firstValueFrom(this.api.adminCalculationMap({ areaId, ...(calculationId ? { calculationId } : {}) }));
      if (this.snapshot().key !== key) return;
      this.patch({ plantParts: map.plantParts, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }
}
