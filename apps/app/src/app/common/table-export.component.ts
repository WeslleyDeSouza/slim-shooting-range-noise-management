import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { ExportFormat, TableExportData } from '../core/table/table-export';
import { TableExportFacade } from '../core/table/table-export.facade';

/** How long the message of a failed export stays. */
const ERROR_MS = 6000;

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
        [class.slim-btn--loading]="busy()"
        [disabled]="disabled() || busy()"
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

    @if (failed()) {
      <div class="slim-toasts">
        <div class="slim-toast slim-toast--danger" role="alert" [attr.data-testid]="testId() + '-error'">
          <div class="slim-toast__body">{{ 'common.export.failed' | translate }}</div>
        </div>
      </div>
    }
  `,
})
export class TableExportComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly facade = inject(TableExportFacade);

  /** Describes the table at the moment of the click. */
  readonly source = input.required<() => TableExportData>();
  readonly disabled = input(false);
  readonly small = input(false);
  readonly testId = input('table-export');
  readonly exported = output<{ format: ExportFormat; rows: number }>();

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  /** What the export will hold, shown in the menu: number of rows, and whether they are the selected ones. */
  protected readonly rows = signal(0);
  protected readonly selection = signal(false);
  private failedTimer: ReturnType<typeof setTimeout> | null = null;

  protected toggle(): void {
    if (!this.open()) {
      const data = this.source()();
      this.rows.set(data.rows.length);
      this.selection.set(!!data.selection);
    }
    this.open.update((open) => !open);
  }

  protected async run(format: ExportFormat): Promise<void> {
    const data = this.source()();
    this.open.set(false);
    this.busy.set(true);
    const ok = await this.facade.download(data, format);
    this.busy.set(false);
    if (ok) {
      this.exported.emit({ format, rows: data.rows.length });
      return;
    }
    this.failed.set(true);
    if (this.failedTimer) clearTimeout(this.failedTimer);
    this.failedTimer = setTimeout(() => this.failed.set(false), ERROR_MS);
  }

  protected closeFromOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
