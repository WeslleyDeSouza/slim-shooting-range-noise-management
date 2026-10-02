import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { saveBlob } from '../core/download';
import { exportBlob, exportFileName, ExportFormat, TableExportData } from '../core/table/table-export';

/**
 * «Exportieren» of a table (B1 5.5.5, slm 3): a button with the two formats
 * Excel and CSV. The page hands over a function that describes the table
 * (`tableExport(...)`); it is called at the click, so the file holds the rows
 * as shown (filter and sorting applied) or the selected rows (5.5.3).
 */
@Component({
  selector: 'app-table-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: {
    '(document:click)': 'closeFromOutside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <div class="slim-dropdown" [class.slim-dropdown--open]="open()">
      <button
        type="button"
        class="slim-btn"
        [class.slim-btn--sm]="small()"
        [disabled]="disabled()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.data-testid]="testId()"
        (click)="toggle()"
      >
        <svg class="slim-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v8M8 10l-3-3M8 10l3-3M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="slim-btn__label">{{ 'common.export.label' | translate }}</span>
      </button>
      <div class="slim-dropdown__panel">
        <div class="slim-menu" role="menu">
          <div class="slim-menu__heading" [attr.data-testid]="testId() + '-scope'">
            {{ (selection() ? 'common.export.rows_selected' : 'common.export.rows_shown') | translate: { n: rows() } }}
          </div>
          <button type="button" class="slim-menu__item" role="menuitem" [attr.data-testid]="testId() + '-xlsx'" (click)="run('xlsx')">
            {{ 'common.export.xlsx' | translate }}
          </button>
          <button type="button" class="slim-menu__item" role="menuitem" [attr.data-testid]="testId() + '-csv'" (click)="run('csv')">
            {{ 'common.export.csv' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class TableExportComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Describes the table at the moment of the click. */
  readonly source = input.required<() => TableExportData>();
  readonly disabled = input(false);
  readonly small = input(false);
  /** The rows of `source` are the selected ones, not all shown ones (says so in the menu). */
  readonly selection = input(false);
  readonly testId = input('table-export');
  readonly exported = output<{ format: ExportFormat; rows: number }>();

  protected readonly open = signal(false);
  /** Number of rows the export will hold, shown in the menu. */
  protected readonly rows = signal(0);

  protected toggle(): void {
    if (!this.open()) this.rows.set(this.source()().rows.length);
    this.open.update((open) => !open);
  }

  protected run(format: ExportFormat): void {
    const data = this.source()();
    saveBlob(exportBlob(data, format), exportFileName(data.fileName, format));
    this.open.set(false);
    this.exported.emit({ format, rows: data.rows.length });
  }

  protected closeFromOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
