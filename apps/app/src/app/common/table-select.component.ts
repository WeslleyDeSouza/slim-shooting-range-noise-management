import { ChangeDetectionStrategy, Component, computed, Directive, input } from '@angular/core';
import { TableSelection } from '../core/table/table-selection';

/**
 * Checkbox of the multi-selection of a table (B1 5.5.3, slm 3). With `rowId`
 * it marks this row — with Shift the range since the row chosen last —,
 * without it marks every row shown (column title).
 */
@Component({
  selector: 'app-table-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="checkbox"
      class="slim-check__input"
      [checked]="checked()"
      [disabled]="disabled() || !shown().length"
      [attr.aria-label]="label()"
      [attr.data-testid]="testId()"
      (click)="toggle($event)"
    />
  `,
})
export class TableSelectComponent {
  readonly selection = input.required<TableSelection>();
  /** Ids of the rows shown, in the order shown. */
  readonly shown = input.required<readonly string[]>();
  /** Id of the row; `null` for the box in the column title. */
  readonly rowId = input<string | null>(null);
  /** Translated name of the box for screen readers. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly testId = input<string | null>(null);

  protected readonly checked = computed(() => {
    const id = this.rowId();
    return id === null ? this.selection().allMarked(this.shown()) : this.selection().ids().has(id);
  });

  protected toggle(event: MouseEvent): void {
    // The row may have a click of its own (open, navigate): the box only marks.
    event.stopPropagation();
    const id = this.rowId();
    if (id === null) this.selection().toggleAll(this.shown(), (event.target as HTMLInputElement).checked);
    else this.selection().toggle(id, this.shown(), event.shiftKey);
  }
}

/** Elements of a row that keep their own click. */
const INTERACTIVE = 'a, button, input, select, textarea, label';

/**
 * A row of a table with multi-selection: shows the mark and takes
 * Ctrl + click (this row) and Shift + click (range) anywhere on the row.
 */
@Directive({
  selector: 'tr[appSelectRow]',
  host: {
    '[class.slim-table__row--selected]': 'marked()',
    '(click)': 'click($event)',
    '(mousedown)': 'keepText($event)',
  },
})
export class TableSelectRowDirective {
  /** Id of the row. */
  readonly appSelectRow = input.required<string>();
  readonly selection = input.required<TableSelection>();
  readonly shown = input.required<readonly string[]>();

  protected readonly marked = computed(() => this.selection().ids().has(this.appSelectRow()));

  protected click(event: MouseEvent): void {
    if (!(event.ctrlKey || event.metaKey || event.shiftKey)) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    this.selection().toggle(this.appSelectRow(), this.shown(), event.shiftKey);
  }

  /** Shift + click would mark the text between the two rows. */
  protected keepText(event: MouseEvent): void {
    if (event.shiftKey && !(event.target as HTMLElement).closest(INTERACTIVE)) event.preventDefault();
  }
}
