import { computed, Signal, signal } from '@angular/core';

/**
 * Selection of several rows of a table (B1 5.5.3, slm 3): single rows one
 * after the other (checkbox, or Ctrl + click on the row) and a range with
 * Shift. An action that works on a selection — the export — takes the marked
 * rows, or all rows shown while nothing is marked.
 */
export class TableSelection {
  private readonly marked = signal<ReadonlySet<string>>(new Set());
  /** The row marked or unmarked last: start of a range with Shift. */
  private anchor: string | null = null;

  readonly ids: Signal<ReadonlySet<string>> = this.marked.asReadonly();
  readonly count = computed(() => this.marked().size);

  has(id: string): boolean {
    return this.marked().has(id);
  }

  /**
   * Marks or unmarks one row. With `range` (Shift) every row shown between
   * the row chosen last and this one gets the new state of this row.
   */
  toggle(id: string, shown: readonly string[], range = false): void {
    const on = !this.marked().has(id);
    const from = range && this.anchor !== null ? shown.indexOf(this.anchor) : -1;
    const to = shown.indexOf(id);
    const ids = from >= 0 && to >= 0 ? shown.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    this.marked.update((set) => {
      const next = new Set(set);
      for (const each of ids) {
        if (on) next.add(each);
        else next.delete(each);
      }
      return next;
    });
    this.anchor = id;
  }

  /** Marks or unmarks every row shown; marks of rows hidden by a filter stay. */
  toggleAll(shown: readonly string[], on: boolean): void {
    this.marked.update((set) => {
      const next = new Set(set);
      for (const id of shown) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    this.anchor = null;
  }

  /** Every row shown is marked (and there is at least one). */
  allMarked(shown: readonly string[]): boolean {
    const set = this.marked();
    return shown.length > 0 && shown.every((id) => set.has(id));
  }

  clear(): void {
    this.marked.set(new Set());
    this.anchor = null;
  }

  /**
   * What an action on the table works with: the marked rows among the rows
   * shown, in the order shown — or all rows shown while none of them is marked.
   */
  pick<T>(rows: readonly T[], id: (row: T) => string): { rows: T[]; selection: boolean } {
    const set = this.marked();
    const picked = set.size ? rows.filter((row) => set.has(id(row))) : [];
    return picked.length ? { rows: picked, selection: true } : { rows: [...rows], selection: false };
  }
}
