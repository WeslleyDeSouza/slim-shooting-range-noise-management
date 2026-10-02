import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminCalculationService, QuotaOverviewDto } from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface QuotaState {
  /** `<areaId>|<year>` of the last request ('' before the first load). */
  key: string;
  overview: QuotaOverviewDto | null;
  loading: boolean;
  error: string | null;
}

/**
 * Kontingentvergleich of one Schiessplatz (B1 5.10 «Übersicht Kontingente
 * gemäss Plangenehmigung»): Soll, Ist of the year and Ø of three years per
 * Waffe/Kaliber, and the light that follows from the rows.
 */
@Injectable({ providedIn: 'root' })
export class QuotaFacade extends SignalStore<QuotaState> {
  private readonly api = inject(AdminCalculationService);

  readonly overview = this.select((s) => s.overview);
  readonly loading = this.select((s) => s.loading);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ key: '', overview: null, loading: false, error: null });
  }

  /** `year` null = the current year (decided by the API in the time zone of the application). */
  async load(areaId: string, year: number | null = null): Promise<void> {
    const key = `${areaId}|${year ?? ''}`;
    // Another Schiessplatz: the rows of the previous one must not stay on screen.
    if (!this.snapshot().key.startsWith(`${areaId}|`)) this.patch({ overview: null });
    this.patch({ key, loading: true, error: null });
    try {
      const overview = await firstValueFrom(this.api.adminCalculationQuota({ areaId, ...(year ? { year } : {}) }));
      // A stale answer of a previous area / year must not overwrite the newer one.
      if (this.snapshot().key !== key) return;
      this.patch({ overview, loading: false });
    } catch (error) {
      if (this.snapshot().key !== key) return;
      this.patch({ overview: null, loading: false, error: apiErrorMessage(error) });
    }
  }
}
