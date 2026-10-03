import { Injectable, signal } from '@angular/core';

interface DetailSelection {
  calculationId: string | null;
  from: string | null;
  to: string | null;
  yearsText: string;
  yearsInvalid: boolean;
  years: string | null;
}

const EMPTY: Readonly<DetailSelection> = {
  calculationId: null, from: null, to: null, yearsText: '', yearsInvalid: false, years: null,
};

/** Provided by /admin/area/:id, not root or individual tabs.
 * Angular reuses that route for different ids, so selections are keyed by area.
 * Deliberately in memory: a browser reload starts with the default selection.
 */
@Injectable()
export class AreaViewStore {
  private readonly selections = signal<Record<string, Readonly<DetailSelection>>>({});

  selection(areaId: string): Readonly<DetailSelection> {
    return this.selections()[areaId] ?? EMPTY;
  }

  setCalculation(areaId: string, value: string): void {
    this.patch(areaId, { calculationId: value || null });
  }

  setDate(areaId: string, key: 'from' | 'to', value: string): void {
    this.patch(areaId, { [key]: value || null, yearsText: '', yearsInvalid: false, years: null });
  }

  setYears(areaId: string, value: string): void {
    if (!value.trim()) {
      this.patch(areaId, { yearsText: '', yearsInvalid: false, years: null });
      return;
    }
    const tokens = value.trim().split(/[,;\s]+/);
    const valid = tokens.length === 3 && new Set(tokens).size === 3 &&
      tokens.every(y => /^\d{4}$/.test(y) && +y >= 1900 && +y <= 2200);
    this.patch(areaId, { yearsText: value, yearsInvalid: !valid,
      ...(valid ? { years: tokens.map(Number).sort((a, b) => a - b).join(',') } : {}) });
  }

  private patch(areaId: string, value: Partial<DetailSelection>): void {
    this.selections.update(all => ({ ...all, [areaId]: { ...(all[areaId] ?? EMPTY), ...value } }));
  }
}
