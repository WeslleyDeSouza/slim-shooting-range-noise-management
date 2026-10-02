import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TableSort } from '../core/table/table-sort';

/**
 * Column title that sorts its table (B1 5.5.2, slm 3):
 * `<th appSort="name" [sort]="sort">…</th>`. The first click sorts ascending,
 * the next one descending; the state is announced with `aria-sort`.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- a table cell cannot be wrapped in an element of its own
  selector: 'th[appSort]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-sort]': 'ariaSort()' },
  template: `
    <button type="button" class="slim-table__sort" [class.slim-table__sort--active]="active()" (click)="sort().toggle(appSort())">
      <ng-content />
      <span class="slim-table__sort-mark" aria-hidden="true">{{ mark() }}</span>
    </button>
  `,
})
export class TableSortHeaderComponent<K extends string = string> {
  /** Key of the column in the `TableSort` of the table. */
  readonly appSort = input.required<K>();
  readonly sort = input.required<TableSort<K>>();

  protected readonly active = computed(() => this.sort().state().key === this.appSort());
  protected readonly ariaSort = computed(() => (this.active() ? (this.sort().state().asc ? 'ascending' : 'descending') : null));
  protected readonly mark = computed(() => (this.active() ? (this.sort().state().asc ? '▴' : '▾') : ''));
}
