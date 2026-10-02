import * as ExcelJS from 'exceljs';
import {
  addTableSheet,
  columnLetter,
  EXPORT_HEADER_ROWS,
  EXPORT_TITLE_ROW,
  ExportSheet,
  formatDateTime,
  sheetNameOf,
  tableCsv,
  tableXlsx,
} from './excel-export';

const SHEET: ExportSheet = {
  sheetName: 'Übersicht Schiessplätze',
  title: 'Übersicht Schiessplätze',
  header: ['Bezeichnung', 'Koordinationsabschnitt-Nr.', 'Kontingent', 'Jahr'],
  rows: [
    ['Geissalp', '1104.020', 'Eingehalten', 2026],
    ['Thun', '1101.010', 'Überschritten', 2026],
    ['Bière', '1203.005', null, 2026],
  ],
  filters: [
    { label: 'Suche', value: 'a' },
    { label: 'Kontingent', value: 'Alle' },
    { label: 'Lärmbelastung', value: 'Zu prüfen' },
  ],
  exportedBy: 'Anna Muster',
  exportedAt: new Date('2026-10-02T08:05:00Z'),
};

/** Reads a written file back, as Excel would. */
async function read(sheet: ExportSheet): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await tableXlsx(sheet)) as never);
  return workbook.worksheets[0];
}

describe('Excel export of a table (B1 5.5.5, slm 3) — layout of the ELO exports', () => {
  it('writes the fixed block on top: title, selection, filters, export date and user', async () => {
    const ws = await read(SHEET);
    expect(ws.name).toBe('Übersicht Schiessplätze');
    expect(ws.getCell('A1').value).toBe('Übersicht Schiessplätze');
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.getCell('A2').value).toBe('Auswahl:');
    expect(ws.getCell('B2').value).toBe('3 angezeigte Zeilen');
    expect(ws.getCell('A3').value).toBe('Filter');
    // Two filters per row: A/B and C/D.
    expect([ws.getCell('A4').value, ws.getCell('B4').value, ws.getCell('C4').value, ws.getCell('D4').value]).toEqual(['Suche:', 'a', 'Kontingent:', 'Alle']);
    expect([ws.getCell('A5').value, ws.getCell('B5').value]).toEqual(['Lärmbelastung:', 'Zu prüfen']);
    expect(ws.getCell('A7').value).toBe('Export Datum:');
    // 08:05 UTC is 10:05 in Zürich (summer time).
    expect(ws.getCell('B7').value).toBe('02.10.2026 10:05');
    expect(ws.getCell('A8').value).toBe('Exportiert von:');
    expect(ws.getCell('B8').value).toBe('Anna Muster');
    expect(ws.getRow(EXPORT_HEADER_ROWS + 1).values).toEqual([]);
  });

  it('puts the column titles in row 10 and the rows below, numbers as numbers', async () => {
    const ws = await read(SHEET);
    expect(EXPORT_TITLE_ROW).toBe(10);
    expect((ws.getRow(10).values as unknown[]).slice(1)).toEqual(SHEET.header);
    expect(ws.getCell('A10').font?.bold).toBe(true);
    expect((ws.getRow(11).values as unknown[]).slice(1)).toEqual(['Geissalp', '1104.020', 'Eingehalten', 2026]);
    expect(typeof ws.getCell('D11').value).toBe('number');
    // An empty cell stays empty, the columns keep their place.
    expect(ws.getCell('C13').value).toBeNull();
    expect(ws.getCell('D13').value).toBe(2026);
    expect(ws.rowCount).toBe(EXPORT_TITLE_ROW + SHEET.rows.length);
  });

  it('keeps the block and the column titles in place when scrolling (fixed header)', async () => {
    const ws = await read(SHEET);
    expect(ws.views).toHaveLength(1);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 0, ySplit: 10, topLeftCell: 'A11' });
  });

  it('sets a filter on the column titles over all rows', async () => {
    const ws = await read(SHEET);
    expect(ws.autoFilter).toBe('A10:D13');
  });

  it('groups the block so it can be folded away, and keeps its row heights', async () => {
    const ws = await read(SHEET);
    for (let row = 1; row <= EXPORT_HEADER_ROWS; row++) expect(ws.getRow(row).outlineLevel).toBe(1);
    expect(ws.getRow(EXPORT_TITLE_ROW).outlineLevel ?? 0).toBe(0);
    expect(ws.getRow(1).height).toBe(25);
    expect(ws.getRow(2).height).toBe(18);
  });

  it('says so when no filter is set, when rows are selected, and in the language asked for', async () => {
    const ws = await read({ ...SHEET, filters: [], selection: true, lang: 'fr' });
    expect(ws.getCell('A2').value).toBe('Sélection:');
    expect(ws.getCell('B2').value).toBe('3 lignes sélectionnées');
    expect(ws.getCell('A3').value).toBe('Filtres');
    expect(ws.getCell('B4').value).toBe('(aucun filtre)');
    expect(ws.getCell('A8').value).toBe('Exporté par:');
  });

  it('shows the subtitle next to the title', async () => {
    const ws = await read({ ...SHEET, subtitle: '1104.020 Geissalp' });
    const value = ws.getCell('A1').value as ExcelJS.CellRichTextValue;
    expect(value.richText.map((part) => part.text)).toEqual(['Übersicht Schiessplätze', '  1104.020 Geissalp']);
  });

  it('writes a table without rows: block, column titles, filter on the titles', async () => {
    const ws = await read({ ...SHEET, rows: [] });
    expect(ws.getCell('B2').value).toBe('0 angezeigte Zeilen');
    expect((ws.getRow(10).values as unknown[]).slice(1)).toEqual(SHEET.header);
    expect(ws.autoFilter).toBe('A10:D10');
  });

  it('keeps a text that looks like a formula as text', async () => {
    const ws = await read({ ...SHEET, rows: [['=1+1', '+41', '-5 dB', 1]] });
    expect(ws.getCell('A11').value).toBe('=1+1');
    expect(ws.getCell('A11').type).toBe(ExcelJS.ValueType.String);
  });

  it('adds several sheets to one workbook', () => {
    const workbook = new ExcelJS.Workbook();
    addTableSheet(workbook, SHEET);
    addTableSheet(workbook, { ...SHEET, sheetName: 'Waffen: Kaliber [aktiv]' });
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['Übersicht Schiessplätze', 'Waffen Kaliber aktiv']);
  });
});

describe('helpers of the export', () => {
  it('names columns like Excel', () => {
    expect([1, 26, 27, 52, 53, 702, 703].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('makes a sheet name Excel accepts', () => {
    expect(sheetNameOf('a/b\\c?d*e[f]g:h')).toBe('a b c d e f g h');
    expect(sheetNameOf('x'.repeat(40))).toHaveLength(31);
    expect(sheetNameOf(' / ')).toBe('Export');
  });

  it('formats the export date in the time zone of the application', () => {
    expect(formatDateTime(new Date('2026-01-15T23:30:00Z'), 'Europe/Zurich')).toBe('16.01.2026 00:30');
  });
});

describe('CSV export of a table (slm 39)', () => {
  const csv = (rows: (string | number | null)[][]) => tableCsv(['Name', 'Wert'], rows).toString('utf8');

  it('writes semicolon-separated lines with CRLF and a byte order mark', () => {
    expect(csv([['Geissalp', 12.5], ['Thun', null]])).toBe('﻿Name;Wert\r\nGeissalp;12.5\r\nThun;\r\n');
  });

  it('quotes cells with separator, quote or line break', () => {
    expect(csv([['a;b', 1], ['say "hi"', 2], ['two\nlines', 3]])).toBe('﻿Name;Wert\r\n"a;b";1\r\n"say ""hi""";2\r\n"two\nlines";3\r\n');
  });

  it('makes a text that would run as a formula harmless, numbers stay numbers', () => {
    expect(csv([['=SUM(A1)', -4.4], ['@cmd', 0], ['+41 31', 1], ['-5 dB', 2]])).toBe("﻿Name;Wert\r\n'=SUM(A1);-4.4\r\n'@cmd;0\r\n'+41 31;1\r\n'-5 dB;2\r\n");
  });
});
