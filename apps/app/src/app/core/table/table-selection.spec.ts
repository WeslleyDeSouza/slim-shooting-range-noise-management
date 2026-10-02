import { TableSelection } from './table-selection';

const SHOWN = ['a', 'b', 'c', 'd', 'e'];
const marked = (selection: TableSelection) => [...selection.ids()].sort();

describe('table selection (B1 5.5.3, slm 3)', () => {
  it('marks single rows one after the other and unmarks them again', () => {
    const selection = new TableSelection();
    selection.toggle('b', SHOWN);
    selection.toggle('d', SHOWN);
    expect(marked(selection)).toEqual(['b', 'd']);
    expect(selection.count()).toBe(2);
    selection.toggle('b', SHOWN);
    expect(marked(selection)).toEqual(['d']);
    expect(selection.has('d')).toBe(true);
  });

  it('marks the range between the row chosen last and the row chosen with Shift, in both directions', () => {
    const selection = new TableSelection();
    selection.toggle('b', SHOWN);
    selection.toggle('d', SHOWN, true);
    expect(marked(selection)).toEqual(['b', 'c', 'd']);
    selection.clear();
    selection.toggle('e', SHOWN);
    selection.toggle('c', SHOWN, true);
    expect(marked(selection)).toEqual(['c', 'd', 'e']);
  });

  it('takes the range over the rows as they are shown (sorted, filtered)', () => {
    const selection = new TableSelection();
    const sorted = ['e', 'a', 'c'];
    selection.toggle('e', sorted);
    selection.toggle('c', sorted, true);
    expect(marked(selection)).toEqual(['a', 'c', 'e']);
  });

  it('unmarks a range when the row chosen with Shift was marked', () => {
    const selection = new TableSelection();
    selection.toggleAll(SHOWN, true);
    selection.toggle('b', SHOWN);
    selection.toggle('d', SHOWN, true);
    expect(marked(selection)).toEqual(['a', 'e']);
  });

  it('marks only this row with Shift while no row was chosen before', () => {
    const selection = new TableSelection();
    selection.toggle('c', SHOWN, true);
    expect(marked(selection)).toEqual(['c']);
  });

  it('marks and unmarks all rows shown and keeps the marks of hidden rows', () => {
    const selection = new TableSelection();
    selection.toggle('e', SHOWN);
    const filtered = ['a', 'b'];
    expect(selection.allMarked(filtered)).toBe(false);
    selection.toggleAll(filtered, true);
    expect(selection.allMarked(filtered)).toBe(true);
    expect(marked(selection)).toEqual(['a', 'b', 'e']);
    selection.toggleAll(filtered, false);
    expect(marked(selection)).toEqual(['e']);
    expect(selection.allMarked([])).toBe(false);
  });

  it('hands the marked rows to an action in the order shown, or all rows while none is marked', () => {
    const selection = new TableSelection();
    const rows = SHOWN.map((id) => ({ id }));
    expect(selection.pick(rows, (row) => row.id)).toEqual({ rows, selection: false });
    selection.toggle('d', SHOWN);
    selection.toggle('a', SHOWN);
    expect(selection.pick(rows, (row) => row.id)).toEqual({ rows: [{ id: 'a' }, { id: 'd' }], selection: true });
    // A filter hides every marked row: the action works on what is shown.
    expect(selection.pick([{ id: 'b' }], (row) => row.id)).toEqual({ rows: [{ id: 'b' }], selection: false });
  });
});
