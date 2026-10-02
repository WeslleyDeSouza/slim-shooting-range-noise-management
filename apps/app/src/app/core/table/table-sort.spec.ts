import { sortRows, TableSort } from './table-sort';

interface Row {
  name: string;
  no: string | null;
  shots: number | null;
  active: boolean;
}

const ROWS: Row[] = [
  { name: 'Stellungsrm 10', no: '1104.020.10', shots: 500, active: true },
  { name: 'stellungsrm 2', no: null, shots: null, active: false },
  { name: 'Stellungsrm 1', no: '1104.020.01', shots: 1200, active: true },
  { name: 'Zielhang', no: '', shots: 500, active: false },
];
const names = (rows: Row[]) => rows.map((row) => row.name);

describe('table sort (B1 5.5.2, slm 3)', () => {
  it('sorts texts without regard to case and numbers inside texts by their value', () => {
    expect(names(sortRows(ROWS, (row) => row.name))).toEqual(['Stellungsrm 1', 'stellungsrm 2', 'Stellungsrm 10', 'Zielhang']);
    expect(names(sortRows(ROWS, (row) => row.name, false))).toEqual(['Zielhang', 'Stellungsrm 10', 'stellungsrm 2', 'Stellungsrm 1']);
  });

  it('sorts numbers by value and keeps the order of equal rows', () => {
    expect(names(sortRows(ROWS, (row) => row.shots))).toEqual(['Stellungsrm 10', 'Zielhang', 'Stellungsrm 1', 'stellungsrm 2']);
    expect(names(sortRows(ROWS, (row) => row.shots, false))).toEqual(['Stellungsrm 1', 'Stellungsrm 10', 'Zielhang', 'stellungsrm 2']);
  });

  it('puts rows without a value last in both directions', () => {
    expect(names(sortRows(ROWS, (row) => row.no)).slice(2)).toEqual(['stellungsrm 2', 'Zielhang']);
    expect(names(sortRows(ROWS, (row) => row.no, false)).slice(2)).toEqual(['stellungsrm 2', 'Zielhang']);
  });

  it('sorts yes/no columns: «no» first ascending', () => {
    expect(sortRows(ROWS, (row) => row.active).map((row) => row.active)).toEqual([false, false, true, true]);
  });

  it('does not change the rows handed in', () => {
    const before = names(ROWS);
    sortRows(ROWS, (row) => row.name);
    expect(names(ROWS)).toEqual(before);
  });

  describe('TableSort', () => {
    const values = { name: (row: Row) => row.name, shots: (row: Row) => row.shots };

    it('keeps the order given until a column is chosen', () => {
      const sort = new TableSort<'name' | 'shots'>();
      expect(sort.state()).toEqual({ key: null, asc: true });
      expect(names(sort.apply(ROWS, values))).toEqual(names(ROWS));
    });

    it('sorts ascending at the first click on a column and descending at the second', () => {
      const sort = new TableSort<'name' | 'shots'>();
      sort.toggle('name');
      expect(sort.state()).toEqual({ key: 'name', asc: true });
      expect(names(sort.apply(ROWS, values))[0]).toBe('Stellungsrm 1');
      sort.toggle('name');
      expect(sort.state()).toEqual({ key: 'name', asc: false });
      expect(names(sort.apply(ROWS, values))[0]).toBe('Zielhang');
      // The third click gives the order of the mask back.
      sort.toggle('name');
      expect(sort.state()).toEqual({ key: null, asc: true });
      expect(names(sort.apply(ROWS, values))).toEqual(names(ROWS));
      // Another column starts ascending again.
      sort.toggle('name');
      sort.toggle('shots');
      expect(sort.state()).toEqual({ key: 'shots', asc: true });
    });

    it('starts with the order of the mask when one is given', () => {
      const sort = new TableSort<'name' | 'shots'>({ key: 'shots', asc: false });
      expect(names(sort.apply(ROWS, values))[0]).toBe('Stellungsrm 1');
      // Its own column only changes the direction; another column comes back to it.
      sort.toggle('shots');
      expect(sort.state()).toEqual({ key: 'shots', asc: true });
      sort.toggle('shots');
      expect(sort.state()).toEqual({ key: 'shots', asc: false });
      sort.toggle('name');
      sort.toggle('name');
      sort.toggle('name');
      expect(sort.state()).toEqual({ key: 'shots', asc: false });
    });
  });
});
