import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AdminExportService } from '@ui-slim/apiClient';
import * as download from '../download';
import { exportFileName, tableExport } from './table-export';
import { TableExportFacade } from './table-export.facade';

interface Row {
  name: string;
  shots: number | null;
  note?: string;
}

const ROWS: Row[] = [
  { name: 'Geissalp', shots: 1200 },
  { name: 'Thun', shots: null, note: 'gesperrt' },
];

describe('tableExport — a table as the export takes it (B1 5.5.5, slm 3)', () => {
  const definition = {
    table: 'schiessplaetze',
    title: 'Übersicht Schiessplätze',
    columns: [
      { header: 'Bezeichnung', value: (r: Row) => r.name },
      { header: 'Anzahl Schuss', value: (r: Row) => r.shots },
      { header: 'Bemerkung', value: (r: Row) => r.note },
    ],
    rows: ROWS,
  };

  it('writes the titles and one line of cells per row, in the order given', () => {
    const data = tableExport(definition);
    expect(data.header).toEqual(['Bezeichnung', 'Anzahl Schuss', 'Bemerkung']);
    expect(data.rows).toEqual([
      ['Geissalp', 1200, null],
      ['Thun', null, 'gesperrt'],
    ]);
    // Numbers stay numbers, so the spreadsheet can sum them.
    expect(typeof data.rows[0][1]).toBe('number');
    expect(data.selection).toBe(false);
  });

  it('keeps only the filters that are set', () => {
    const data = tableExport({
      ...definition,
      filters: [
        { label: 'Suche', value: '  ' },
        { label: 'Jahr', value: 2026 },
        { label: 'Kontingent', value: null },
        { label: 'Lärmbelastung', value: 'Zu prüfen' },
        { label: 'Handlungsbedarf', value: undefined },
      ],
    });
    expect(data.filters).toEqual([
      { label: 'Jahr', value: '2026' },
      { label: 'Lärmbelastung', value: 'Zu prüfen' },
    ]);
  });

  it('takes the soft hyphens of the column titles out', () => {
    const data = tableExport({ ...definition, title: 'Schuss­zahlen', columns: [{ header: 'Stellungs­raum', value: (r: Row) => r.name }], filters: [{ label: 'Nutzungs­einheit', value: 'K1' }] });
    expect(data.title).toBe('Schusszahlen');
    expect(data.header).toEqual(['Stellungsraum']);
    expect(data.filters?.[0].label).toBe('Nutzungseinheit');
  });

  it('marks an export of selected rows', () => {
    expect(tableExport({ ...definition, selection: true, rows: [ROWS[1]] })).toMatchObject({ selection: true, rows: [['Thun', null, 'gesperrt']] });
  });

  it('names the file after the table and the day', () => {
    expect(exportFileName('schiessplaetze', 'xlsx', new Date(2026, 9, 2))).toBe('schiessplaetze_2026-10-02.xlsx');
    expect(exportFileName('schusszahlen', 'csv', new Date(2026, 0, 5))).toBe('schusszahlen_2026-01-05.csv');
  });
});

describe('TableExportFacade — asks the API for the file and hands it to the browser', () => {
  const data = tableExport({ table: 'schiessplaetze', title: 'Übersicht Schiessplätze', columns: [{ header: 'Bezeichnung', value: (r: Row) => r.name }], rows: ROWS });
  let api: { adminExportTable: jest.Mock };
  let saveBlob: jest.SpyInstance;

  function setup(lang: string): TableExportFacade {
    api = { adminExportTable: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminExportService, useValue: api },
        { provide: TranslateService, useValue: { lang } },
      ],
    });
    saveBlob = jest.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    return TestBed.inject(TableExportFacade);
  }

  afterEach(() => saveBlob.mockRestore());

  it('sends the table with the format and the language of the user, then saves the file', async () => {
    const facade = setup('fr');
    const blob = new Blob(['x']);
    api.adminExportTable.mockReturnValue(of(blob));

    await expect(facade.download(data, 'xlsx')).resolves.toBe(true);
    expect(api.adminExportTable).toHaveBeenCalledWith({ body: { ...data, format: 'xlsx', lang: 'fr' } });
    expect(saveBlob).toHaveBeenCalledTimes(1);
    expect(saveBlob.mock.calls[0][0]).toBe(blob);
    expect(saveBlob.mock.calls[0][1]).toMatch(/^schiessplaetze_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('falls back to German for a language the export does not know', async () => {
    const facade = setup('rm');
    api.adminExportTable.mockReturnValue(of(new Blob(['x'])));
    await facade.download(data, 'csv');
    expect(api.adminExportTable.mock.calls[0][0].body).toMatchObject({ format: 'csv', lang: 'de' });
    expect(saveBlob.mock.calls[0][1]).toMatch(/\.csv$/);
  });

  it('saves nothing and says so when the API fails', async () => {
    const facade = setup('de');
    api.adminExportTable.mockReturnValue(throwError(() => new Error('500')));
    await expect(facade.download(data, 'xlsx')).resolves.toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
