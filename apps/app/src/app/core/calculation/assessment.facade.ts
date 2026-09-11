import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminCalculationService, AssessmentDto } from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

export interface AssessmentQuery {
  calculationId?: string;
  from?: string;
  to?: string;
}

interface AssessmentState {
  areaId: string | null;
  query: AssessmentQuery;
  assessment: AssessmentDto | null;
  loading: boolean;
  error: string | null;
}

/**
 * 5.12 «Details»: the receivers of an area assessed against the LSV limits
 * for a calculation state and a period. Everything is computed by the API
 * (`AdminCalculationService.adminCalculationAssess`); this store only keeps
 * the last result and the query that produced it.
 */
@Injectable({ providedIn: 'root' })
export class AssessmentFacade extends SignalStore<AssessmentState> {
  private readonly api = inject(AdminCalculationService);

  readonly areaId = this.select((s) => s.areaId);
  readonly query = this.select((s) => s.query);
  readonly assessment = this.select((s) => s.assessment);
  readonly receivers = this.select((s) => s.assessment?.receivers ?? []);
  readonly calculations = this.select((s) => s.assessment?.calculations ?? []);
  readonly loading = this.select((s) => s.loading);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ areaId: null, query: {}, assessment: null, loading: false, error: null });
  }

  async load(areaId: string, query: AssessmentQuery = this.snapshot().query): Promise<void> {
    this.patch({ areaId, query, loading: true, error: null });
    try {
      const assessment = await firstValueFrom(
        this.api.adminCalculationAssess({ areaId, ...query }),
      );
      const state = this.snapshot();
      if (state.areaId !== areaId || state.query !== query) return;
      this.patch({ assessment, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  /**
   * Re-runs the last query for a new state / period. (Named `refine`:
   * `select` is the protected selector helper of SignalStore.)
   */
  async refine(query: AssessmentQuery): Promise<void> {
    const areaId = this.snapshot().areaId;
    if (areaId) await this.load(areaId, { ...this.snapshot().query, ...query });
  }
}
