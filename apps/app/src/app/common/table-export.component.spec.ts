import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { TableExportData } from '../core/table/table-export';
import { TableExportFacade } from '../core/table/table-export.facade';
import { TableExportComponent } from './table-export.component';

/** Keys pass through; interpolation like the real pipe (`{{n}}`). */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    return Object.entries(params ?? {}).reduce((text, [k, v]) => `${text} ${k}=${v}`, key);
  }
}

const table = (rows: (string | number | null)[][], selection = false): TableExportData => ({
  table: 'schiessplaetze',
  title: 'Übersicht Schiessplätze',
  filters: [],
  selection,
  header: ['Bezeichnung'],
  rows,
});

describe('TableExportComponent — «Exportieren» of a table (B1 5.5.5, slm 3)', () => {
  let fixture: ComponentFixture<TableExportComponent>;
  let facade: { download: jest.Mock };
  /** What the page shows right now; the export must take it at the click. */
  let current: TableExportData;

  const el = <T extends HTMLElement = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const settle = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    facade = { download: jest.fn().mockResolvedValue(true) };
    current = table([['Geissalp'], ['Thun'], ['Bière']]);
    await TestBed.configureTestingModule({ imports: [TableExportComponent], providers: [{ provide: TableExportFacade, useValue: facade }] })
      .overrideComponent(TableExportComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(TableExportComponent);
    fixture.componentRef.setInput('source', () => current);
    fixture.componentRef.setInput('testId', 'area-export');
    fixture.detectChanges();
  });

  it('offers Excel and CSV and says how many rows the file will hold', () => {
    const dropdown = fixture.nativeElement.querySelector('.slim-dropdown') as HTMLElement;
    expect(dropdown.classList).not.toContain('slim-dropdown--open');
    el('area-export').click();
    fixture.detectChanges();
    expect(dropdown.classList).toContain('slim-dropdown--open');
    expect(el('area-export').getAttribute('aria-expanded')).toBe('true');
    expect(el('area-export-scope').textContent).toContain('common.export.rows_shown n=3');
    expect(el('area-export-xlsx').textContent).toContain('common.export.xlsx');
    expect(el('area-export-csv').textContent).toContain('common.export.csv');
  });

  it('exports the table as it is at the click, not as it was when the page opened', async () => {
    // The user filters after the page was rendered.
    current = table([['Thun']]);
    el('area-export').click();
    fixture.detectChanges();
    expect(el('area-export-scope').textContent).toContain('n=1');

    const exported: unknown[] = [];
    fixture.componentInstance.exported.subscribe((event) => exported.push(event));
    el('area-export-xlsx').click();
    await settle();
    expect(facade.download).toHaveBeenCalledWith(current, 'xlsx');
    expect(exported).toEqual([{ format: 'xlsx', rows: 1 }]);
    expect(fixture.nativeElement.querySelector('.slim-dropdown').classList).not.toContain('slim-dropdown--open');
  });

  it('exports as CSV', async () => {
    el('area-export').click();
    fixture.detectChanges();
    el('area-export-csv').click();
    await settle();
    expect(facade.download).toHaveBeenCalledWith(current, 'csv');
  });

  it('says so when the rows are the selected ones (B1 5.5.3)', () => {
    current = table([['Geissalp'], ['Thun']], true);
    el('area-export').click();
    fixture.detectChanges();
    expect(el('area-export-scope').textContent).toContain('common.export.rows_selected n=2');
  });

  it('shows a message when the export fails', async () => {
    facade.download.mockResolvedValue(false);
    const exported: unknown[] = [];
    fixture.componentInstance.exported.subscribe((event) => exported.push(event));
    el('area-export').click();
    fixture.detectChanges();
    el('area-export-xlsx').click();
    await settle();
    expect(el('area-export-error').textContent).toContain('common.export.failed');
    expect(exported).toEqual([]);
  });

  it('is busy while the file is written, so a second click starts no second export', async () => {
    let finish: (ok: boolean) => void = () => undefined;
    facade.download.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    el('area-export').click();
    fixture.detectChanges();
    el('area-export-xlsx').click();
    fixture.detectChanges();
    expect(el<HTMLButtonElement>('area-export').disabled).toBe(true);
    finish(true);
    await settle();
    expect(el<HTMLButtonElement>('area-export').disabled).toBe(false);
    expect(facade.download).toHaveBeenCalledTimes(1);
  });

  it('closes the menu on a click outside and on Escape, and stays shut when disabled', () => {
    el('area-export').click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.slim-dropdown').classList).not.toContain('slim-dropdown--open');

    el('area-export').click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.slim-dropdown').classList).not.toContain('slim-dropdown--open');

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(el<HTMLButtonElement>('area-export').disabled).toBe(true);
  });
});
