import { computed, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminCalculationService,
  SimulationBaseDto,
  SimulationResultDto,
  SimulationRowDto,
} from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

/** Editable shot counts per Stellungsraum × Kombination, keyed by `rowKey(row)` (roomId|combinationId). */
export type SimulationValues = Record<string, { inside: number; outside: number }>;

/** Key of a simulation row: the permanent reference pair, not a source of the model. */
export function rowKey(row: Pick<SimulationRowDto, 'roomId' | 'combinationId'>): string {
  return `${row.roomId}|${row.combinationId}`;
}

interface SimulationState {
  areaId: string | null;
  year: number;
  calculationId: string | null;
  base: SimulationBaseDto | null;
  values: SimulationValues;
  result: SimulationResultDto | null;
  /** The values the result was computed with; differs from `values` → stale. */
  resultValues: SimulationValues | null;
  loading: boolean;
  running: boolean;
  error: string | null;
}

/**
 * 5.13 «Simulation»: the year's shot counts per source are the Ist; the user
 * overwrites them locally, runs the simulation on the API and compares.
 * A sandbox — nothing is persisted, `reset()` returns to the Ist.
 */
@Injectable({ providedIn: 'root' })
export class SimulationFacade extends SignalStore<SimulationState> {
  private readonly api = inject(AdminCalculationService);

  readonly areaId = this.select((s) => s.areaId);
  readonly year = this.select((s) => s.year);
  readonly base = this.select((s) => s.base);
  readonly rows = this.select((s) => s.base?.rows ?? []);
  readonly receivers = this.select((s) => s.base?.receivers ?? []);
  readonly values = this.select((s) => s.values);
  readonly result = this.select((s) => s.result);
  readonly loading = this.select((s) => s.loading);
  readonly running = this.select((s) => s.running);
  readonly error = this.select((s) => s.error);

  /** Number of edited cells versus the Ist. */
  readonly changedCount = computed(() => {
    const { base, values } = this.state();
    let n = 0;
    for (const row of base?.rows ?? []) {
      const v = values[rowKey(row)];
      if (!v) continue;
      if (v.inside !== row.inside) n++;
      if (v.outside !== row.outside) n++;
    }
    return n;
  });
  readonly dirty = computed(() => this.changedCount() > 0);
  /** True when the values changed after the last run. */
  readonly stale = computed(() => {
    const { result, resultValues, values } = this.state();
    if (!result || !resultValues) return false;
    return JSON.stringify(resultValues) !== JSON.stringify(values);
  });
  readonly totals = computed(() => {
    const { base, values } = this.state();
    const sum = (key: 'inside' | 'outside', source: SimulationValues) =>
      Object.values(source).reduce((total, v) => total + v[key], 0);
    const baseValues = toValues(base);
    return {
      inside: sum('inside', values),
      outside: sum('outside', values),
      baseInside: sum('inside', baseValues),
      baseOutside: sum('outside', baseValues),
    };
  });

  constructor() {
    super({
      areaId: null,
      year: new Date().getFullYear(),
      calculationId: null,
      base: null,
      values: {},
      result: null,
      resultValues: null,
      loading: false,
      running: false,
      error: null,
    });
  }

  async load(areaId: string, year = this.snapshot().year, calculationId?: string): Promise<void> {
    this.patch({ areaId, year, calculationId: calculationId ?? null, loading: true, error: null });
    try {
      const base = await firstValueFrom(
        this.api.adminCalculationSimulationBase({ areaId, year: String(year), calculationId }),
      );
      const state = this.snapshot();
      if (state.areaId !== areaId || state.year !== year) return;
      this.patch({ base, values: toValues(base), result: null, resultValues: null, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  setValue(id: string, key: 'inside' | 'outside', value: number): void {
    // Quantities are decimal (kg of explosive, B1 6.2): keep three decimals.
    const clean = Number.isFinite(value) ? Math.max(0, Math.round(value * 1000) / 1000) : 0;
    this.update((s) => ({
      ...s,
      values: { ...s.values, [id]: { ...(s.values[id] ?? { inside: 0, outside: 0 }), [key]: clean } },
    }));
  }

  /** Multiplies every value by `factor` (quick buttons −20 % … +50 %). */
  scaleAll(factor: number): void {
    this.update((s) => ({
      ...s,
      values: Object.fromEntries(
        Object.entries(s.values).map(([id, v]) => [
          id,
          { inside: Math.round(v.inside * factor * 1000) / 1000, outside: Math.round(v.outside * factor * 1000) / 1000 },
        ]),
      ),
    }));
  }

  /** Back to the Ist; drops the result. */
  reset(): void {
    this.update((s) => ({ ...s, values: toValues(s.base), result: null, resultValues: null }));
  }

  async run(): Promise<SimulationResultDto | null> {
    const { areaId, year, calculationId, values } = this.snapshot();
    if (!areaId) return null;
    this.patch({ running: true, error: null });
    try {
      const result = await firstValueFrom(
        this.api.adminCalculationSimulate({
          areaId,
          body: {
            year,
            calculationId: calculationId ?? undefined,
            rows: Object.entries(values).map(([id, v]) => {
              const [roomId, combinationId] = id.split('|');
              return { roomId, combinationId, inside: v.inside, outside: v.outside };
            }),
          },
        }),
      );
      this.patch({ result, resultValues: copyValues(values), running: false });
      return result;
    } catch (error) {
      this.patch({ running: false, error: apiErrorMessage(error) });
      return null;
    }
  }
}

/** Deep-enough copy (jsdom has no structuredClone). */
function copyValues(values: SimulationValues): SimulationValues {
  return Object.fromEntries(Object.entries(values).map(([id, v]) => [id, { ...v }]));
}

function toValues(base: SimulationBaseDto | null): SimulationValues {
  const values: SimulationValues = {};
  for (const row of base?.rows ?? []) values[rowKey(row)] = { inside: row.inside, outside: row.outside };
  return values;
}
