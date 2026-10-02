import { Signal, signal } from '@angular/core';

/**
 * Sorting of a table (B1 5.5.2, slm 3): by any column, ascending or
 * descending. A page keeps one `TableSort` per table, puts `appSort` on the
 * column titles and hands the value of every column to `apply()`.
 */
export type SortValue = string | number | boolean | null | undefined;

export interface SortState<K extends string = string> {
  /** Column the table is sorted by; `null` = the order the rows come in. */
  key: K | null;
  asc: boolean;
}

/** «Stellungsrm 2» before «Stellungsrm 10», upper and lower case alike. */
const collator = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });

function isEmpty(value: SortValue): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

function compare(a: Exclude<SortValue, null | undefined>, b: Exclude<SortValue, null | undefined>): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/**
 * The rows sorted by one value. Rows without a value come last in both
 * directions; rows with the same value keep their order.
 */
export function sortRows<T>(rows: readonly T[], value: (row: T) => SortValue, asc = true): T[] {
  const direction = asc ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((x, y) => {
      const emptyX = isEmpty(x.value);
      const emptyY = isEmpty(y.value);
      if (emptyX || emptyY) return emptyX === emptyY ? x.index - y.index : emptyX ? 1 : -1;
      return compare(x.value as string | number | boolean, y.value as string | number | boolean) * direction || x.index - y.index;
    })
    .map((entry) => entry.row);
}

export class TableSort<K extends string = string> {
  private readonly current = signal<SortState<K>>({ key: null, asc: true });
  readonly state: Signal<SortState<K>> = this.current.asReadonly();

  /** `initial`: the order the mask opens with; without it the rows keep the order they come in. */
  constructor(private readonly initial: SortState<K> = { key: null, asc: true }) {
    this.current.set(initial);
  }

  /**
   * A click on a column title: ascending by this column, the next click
   * descending, the third one back to the order the mask opens with.
   */
  toggle(key: K): void {
    this.current.update((state) => {
      if (state.key !== key) return { key, asc: true };
      return state.asc ? { key, asc: false } : this.initial.key === key ? { key, asc: true } : this.initial;
    });
  }

  /** The rows in the chosen order; in the order given while no column is chosen. */
  apply<T>(rows: readonly T[], values: Partial<Record<K, (row: T) => SortValue>>): T[] {
    const { key, asc } = this.current();
    const value = key === null ? undefined : values[key];
    return value ? sortRows(rows, value, asc) : [...rows];
  }
}
