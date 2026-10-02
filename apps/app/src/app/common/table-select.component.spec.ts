import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableSelection } from '../core/table/table-selection';
import { TableSort } from '../core/table/table-sort';
import { TableSelectComponent, TableSelectRowDirective } from './table-select.component';
import { TableSortHeaderComponent } from './table-sort-header.component';

interface Row {
  id: string;
  name: string;
  shots: number;
}

/** A table as the pages build it: sortable titles, a box per row, Ctrl/Shift on the row. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableSelectComponent, TableSelectRowDirective, TableSortHeaderComponent],
  template: `
    <table>
      <thead>
        <tr>
          <th><app-table-select testId="all" label="Alle" [selection]="selection" [shown]="shown()" /></th>
          <th appSort="name" [sort]="sort" data-testid="th-name">Name</th>
          <th appSort="shots" [sort]="sort" data-testid="th-shots">Schuss</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr [appSelectRow]="row.id" [selection]="selection" [shown]="shown()" [attr.data-row]="row.id" (click)="opened.push(row.id)">
            <td><app-table-select label="Zeile" [testId]="'box-' + row.id" [selection]="selection" [shown]="shown()" [rowId]="row.id" /></td>
            <td class="name">{{ row.name }}</td>
            <td><button type="button" [attr.data-testid]="'action-' + row.id">…</button></td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
class HostComponent {
  readonly selection = new TableSelection();
  readonly sort = new TableSort<'name' | 'shots'>();
  /** Clicks that reach the row itself. */
  readonly opened: string[] = [];
  private readonly data: Row[] = [
    { id: 'a', name: 'Geissalp', shots: 300 },
    { id: 'b', name: 'Bière', shots: 900 },
    { id: 'c', name: 'Thun', shots: 100 },
    { id: 'd', name: 'Andermatt', shots: 500 },
  ];
  readonly rows = computed(() => this.sort.apply(this.data, { name: (row) => row.name, shots: (row) => row.shots }));
  readonly shown = computed(() => this.rows().map((row) => row.id));
}

describe('table functions in a mask: sorting and multi-selection (B1 5.5.2, 5.5.3, slm 3)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = <T extends HTMLElement = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const order = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('data-row'));
  const marked = () => [...host.selection.ids()].sort();
  const click = (selector: string, keys: MouseEventInit = {}) => {
    el(selector).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...keys }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sorts by the column whose title is clicked, then the other way round, and announces it', () => {
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    expect(el('[data-testid="th-name"]').getAttribute('aria-sort')).toBeNull();
    click('[data-testid="th-name"] button');
    expect(order()).toEqual(['d', 'b', 'a', 'c']);
    expect(el('[data-testid="th-name"]').getAttribute('aria-sort')).toBe('ascending');
    click('[data-testid="th-name"] button');
    expect(order()).toEqual(['c', 'a', 'b', 'd']);
    expect(el('[data-testid="th-name"]').getAttribute('aria-sort')).toBe('descending');
    click('[data-testid="th-shots"] button');
    expect(order()).toEqual(['c', 'a', 'd', 'b']);
    expect(el('[data-testid="th-name"]').getAttribute('aria-sort')).toBeNull();
    expect(el('[data-testid="th-shots"] button').classList).toContain('slim-table__sort--active');
  });

  it('marks rows with their box and shows the mark on the row', () => {
    click('[data-testid="box-b"]');
    click('[data-testid="box-d"]');
    expect(marked()).toEqual(['b', 'd']);
    expect(el('[data-row="b"]').classList).toContain('slim-table__row--selected');
    expect(el('[data-row="a"]').classList).not.toContain('slim-table__row--selected');
    expect(el<HTMLInputElement>('[data-testid="box-b"]').checked).toBe(true);
    // The box only marks: the click of the row itself is not triggered.
    expect(host.opened).toEqual([]);
  });

  it('marks a range with Shift over the rows as sorted', () => {
    click('[data-testid="th-name"] button'); // d, b, a, c
    click('[data-testid="box-d"]');
    click('[data-testid="box-a"]', { shiftKey: true });
    expect(marked()).toEqual(['a', 'b', 'd']);
  });

  it('marks with Ctrl + click and Shift + click anywhere on the row, but not on its buttons', () => {
    click('[data-row="a"] .name', { ctrlKey: true });
    click('[data-row="c"] .name', { shiftKey: true });
    expect(marked()).toEqual(['a', 'b', 'c']);
    click('[data-row="b"] .name', { ctrlKey: true });
    expect(marked()).toEqual(['a', 'c']);
    click('[data-testid="action-d"]', { ctrlKey: true });
    expect(marked()).toEqual(['a', 'c']);
    // A plain click on the row marks nothing.
    click('[data-row="d"] .name');
    expect(marked()).toEqual(['a', 'c']);
  });

  it('marks and unmarks all rows shown with the box in the title', () => {
    const all = el<HTMLInputElement>('[data-testid="all"]');
    expect(all.checked).toBe(false);
    click('[data-testid="all"]');
    expect(marked()).toEqual(['a', 'b', 'c', 'd']);
    expect(all.checked).toBe(true);
    click('[data-testid="box-c"]');
    expect(all.checked).toBe(false);
    click('[data-testid="all"]');
    click('[data-testid="all"]');
    expect(marked()).toEqual([]);
  });
});
