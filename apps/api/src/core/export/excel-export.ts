import * as ExcelJS from 'exceljs';

/**
 * Excel sheet of a table (B1 5.5.5, slm 3) in the layout of the ELO exports
 * (`ExcelFormattingService` there): a fixed block of eight rows on top that
 * says what was exported (title, selection, filters, when, by whom), a
 * separator row, then the column titles and the rows. The block and the
 * column titles stay in place when scrolling (freeze panes); the block can be
 * folded away with the outline control of Excel.
 */
export type ExportCell = string | number | null;
export type ExportLang = 'de' | 'fr' | 'it' | 'en';

export interface ExportFilter {
  label: string;
  value: string;
}

export interface ExportSheet {
  sheetName: string;
  title: string;
  subtitle?: string | null;
  /** Filters that were active when the table was exported (at most `EXPORT_MAX_FILTERS`). */
  filters?: ExportFilter[];
  /** The rows are the selected ones (B1 5.5.3), not all rows shown. */
  selection?: boolean;
  header: string[];
  rows: ExportCell[][];
  exportedBy: string;
  exportedAt?: Date;
  lang?: ExportLang;
  timeZone?: string;
}

/** Rows 1–8 are the block, row 9 separates, the column titles are row 10. */
export const EXPORT_HEADER_ROWS = 8;
export const EXPORT_TITLE_ROW = EXPORT_HEADER_ROWS + 2;
/** Three rows of the block (4–6) hold the filters, two per row. */
export const EXPORT_MAX_FILTERS = 6;
export const EXPORT_TIME_ZONE = 'Europe/Zurich';

const FILTER_FIRST_ROW = 4;
const FILTERS_PER_ROW = 2;
/** The block needs at least the columns A–D (two label / value pairs). */
const MIN_SPAN = 4;
const COLOR = { header: 'E8E8E8', label: 'F5F5F5', columnTitle: 'F2F2F2', border: '000000' } as const;
const WIDTH = { min: 12, max: 60, label: 20 } as const;

const TEXT: Record<ExportLang, { scope: string; shown: string; selected: string; filters: string; noFilter: string; exportedAt: string; exportedBy: string }> = {
  de: { scope: 'Auswahl', shown: '{n} angezeigte Zeilen', selected: '{n} ausgewählte Zeilen', filters: 'Filter', noFilter: '(kein Filter)', exportedAt: 'Export Datum', exportedBy: 'Exportiert von' },
  fr: { scope: 'Sélection', shown: '{n} lignes affichées', selected: '{n} lignes sélectionnées', filters: 'Filtres', noFilter: '(aucun filtre)', exportedAt: "Date d'export", exportedBy: 'Exporté par' },
  it: { scope: 'Selezione', shown: '{n} righe visualizzate', selected: '{n} righe selezionate', filters: 'Filtri', noFilter: '(nessun filtro)', exportedAt: 'Data di esportazione', exportedBy: 'Esportato da' },
  en: { scope: 'Selection', shown: '{n} rows shown', selected: '{n} rows selected', filters: 'Filters', noFilter: '(no filter)', exportedAt: 'Export date', exportedBy: 'Exported by' },
};

const BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR.border } };
const BORDERS: Partial<ExcelJS.Borders> = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Adds the sheet to the workbook and returns it. */
export function addTableSheet(workbook: ExcelJS.Workbook, sheet: ExportSheet): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetNameOf(sheet.sheetName));
  const columns = Math.max(sheet.header.length, 1);
  addExportHeader(worksheet, sheet, columns);

  const titles = worksheet.getRow(EXPORT_TITLE_ROW);
  sheet.header.forEach((title, index) => {
    const cell = titles.getCell(index + 1);
    cell.value = title;
    cell.font = { bold: true };
    cell.fill = fill(COLOR.columnTitle);
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });

  sheet.rows.forEach((values, rowIndex) => {
    const row = worksheet.getRow(EXPORT_TITLE_ROW + 1 + rowIndex);
    for (let column = 0; column < columns; column++) {
      const cell = row.getCell(column + 1);
      cell.value = values[column] ?? null;
      cell.border = BORDERS;
    }
  });

  // Widths from the table only: the texts of the block are merged over the columns.
  for (let column = 0; column < columns; column++) {
    const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[column] ?? '').length), (sheet.header[column] ?? '').length);
    const width = Math.min(WIDTH.max, Math.max(column === 0 ? WIDTH.label : WIDTH.min, longest + 2));
    worksheet.getColumn(column + 1).width = width;
  }
  for (let column = columns; column < MIN_SPAN; column++) worksheet.getColumn(column + 1).width = WIDTH.label;

  applyFreezePanes(worksheet, 0, EXPORT_TITLE_ROW);
  worksheet.autoFilter = {
    from: { row: EXPORT_TITLE_ROW, column: 1 },
    to: { row: EXPORT_TITLE_ROW + sheet.rows.length, column: columns },
  };
  return worksheet;
}

/** The block of eight rows; the table starts at `EXPORT_TITLE_ROW`. */
export function addExportHeader(worksheet: ExcelJS.Worksheet, sheet: ExportSheet, columnCount: number): void {
  const t = TEXT[sheet.lang ?? 'de'] ?? TEXT.de;
  const span = Math.max(columnCount, MIN_SPAN);

  const label = (row: number, column: number, text: string) => {
    const cell = worksheet.getCell(row, column);
    cell.value = `${text}:`;
    cell.font = { bold: true, size: 10 };
    cell.fill = fill(COLOR.label);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDERS;
  };
  const value = (row: number, column: number, text: string, mergeTo?: number) => {
    const cell = worksheet.getCell(row, column);
    cell.value = text;
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDERS;
    if (mergeTo && mergeTo > column) worksheet.mergeCells(row, column, row, mergeTo);
  };
  const band = (row: number, text: ExcelJS.CellValue, size: number) => {
    const cell = worksheet.getCell(row, 1);
    cell.value = text;
    cell.font = { bold: true, size };
    cell.fill = fill(COLOR.header);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = BORDERS;
    worksheet.mergeCells(row, 1, row, span);
  };

  // Row 1: title, with the subtitle in a smaller font on the same line.
  band(
    1,
    sheet.subtitle
      ? { richText: [{ text: sheet.title, font: { bold: true, size: 16 } }, { text: `  ${sheet.subtitle}`, font: { bold: false, size: 10 } }] }
      : sheet.title,
    16,
  );

  // Row 2: which rows the file holds.
  label(2, 1, t.scope);
  value(2, 2, (sheet.selection ? t.selected : t.shown).replace('{n}', String(sheet.rows.length)), span);

  // Rows 3–6: the filters, two per row.
  band(3, t.filters, 11);
  const filters = (sheet.filters ?? []).slice(0, EXPORT_MAX_FILTERS);
  if (!filters.length) value(FILTER_FIRST_ROW, 2, t.noFilter, span);
  filters.forEach((filter, index) => {
    const row = FILTER_FIRST_ROW + Math.floor(index / FILTERS_PER_ROW);
    const column = 1 + (index % FILTERS_PER_ROW) * 2;
    const lastOfRow = index % FILTERS_PER_ROW === FILTERS_PER_ROW - 1 || index === filters.length - 1;
    label(row, column, filter.label);
    value(row, column + 1, filter.value, lastOfRow ? span : undefined);
  });

  // Rows 7–8: when and by whom.
  label(7, 1, t.exportedAt);
  value(7, 2, formatDateTime(sheet.exportedAt ?? new Date(), sheet.timeZone ?? EXPORT_TIME_ZONE), span);
  label(8, 1, t.exportedBy);
  value(8, 2, sheet.exportedBy || '-', span);

  // Fixed heights; rows 1–8 are one outline group so the block can be folded away in Excel.
  worksheet.getRow(1).height = 25;
  for (let row = 2; row <= EXPORT_HEADER_ROWS; row++) worksheet.getRow(row).height = 18;
  for (let row = 1; row <= EXPORT_HEADER_ROWS; row++) worksheet.getRow(row).outlineLevel = 1;
  worksheet.getRow(EXPORT_HEADER_ROWS + 1).height = 8;
  worksheet.properties.outlineLevelRow = Math.max(worksheet.properties.outlineLevelRow ?? 0, 1);
  worksheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
}

/** Fixed header: the columns 1–`freezeColumn` and the rows 1–`freezeRow` stay in place when scrolling. */
export function applyFreezePanes(worksheet: ExcelJS.Worksheet, freezeColumn: number, freezeRow: number, zoomScale = 100): void {
  const topLeftCell = `${columnLetter(freezeColumn + 1)}${freezeRow + 1}`;
  worksheet.views = [{ state: 'frozen', xSplit: freezeColumn, ySplit: freezeRow, topLeftCell, activeCell: topLeftCell, zoomScale, zoomScaleNormal: zoomScale }];
}

/** 1 → A, 27 → AA. */
export function columnLetter(columnNumber: number): string {
  let letter = '';
  for (let n = columnNumber; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
}

/** Sheet name Excel accepts: no `: \ / ? * [ ]`, at most 31 characters, never empty. */
export function sheetNameOf(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31).trim() || 'Export';
}

/** `DD.MM.YYYY HH:mm` in the time zone of the application. */
export function formatDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('de-CH', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

export async function tableXlsx(sheet: ExportSheet): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addTableSheet(workbook, sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const CSV_SEPARATOR = ';';
const CSV_LINE_END = '\r\n';
/** Byte order mark: Excel reads the file as UTF-8 only with it. */
const CSV_BOM = '﻿';

/** CSV (slm 39) as Excel in Switzerland opens it: semicolon, CRLF, UTF-8 with BOM; column titles and rows only. */
export function tableCsv(header: string[], rows: ExportCell[][]): Buffer {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return Buffer.from(CSV_BOM + lines.join(CSV_LINE_END) + CSV_LINE_END, 'utf8');
}

function csvCell(value: ExportCell | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  // A text that starts with = + - @ would run as a formula in a spreadsheet: the apostrophe makes it text.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}
