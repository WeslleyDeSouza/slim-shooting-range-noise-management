import { buildXlsx, CellValue } from './xlsx-writer';

/**
 * Export of a table to Excel or CSV (B1 5.5.5, slm 3). A page describes its
 * table with `tableExport()` at the moment of the click, so the file holds
 * the rows as they are shown: filtered and sorted, or the selected rows.
 */
export type ExportFormat = 'xlsx' | 'csv';

export interface ExportColumn<T> {
  /** Column title, already translated. */
  header: string;
  /** Cell value: numbers stay numbers, texts are already translated. */
  value: (row: T) => CellValue;
}

/** A table ready to be written: titles and cell values. */
export interface TableExportData {
  /** File name without date and extension, e.g. `schiessplaetze`. */
  fileName: string;
  /** Name of the sheet (Excel). */
  sheet: string;
  header: string[];
  rows: CellValue[][];
}

export function tableExport<T>(definition: { fileName: string; sheet: string; columns: readonly ExportColumn<T>[]; rows: readonly T[] }): TableExportData {
  return {
    fileName: definition.fileName,
    sheet: definition.sheet,
    header: definition.columns.map((column) => column.header),
    rows: definition.rows.map((row) => definition.columns.map((column) => column.value(row))),
  };
}

const CSV_SEPARATOR = ';';
const CSV_LINE_END = '\r\n';
/** Byte order mark: Excel reads the file as UTF-8 only with it. */
const CSV_BOM = '﻿';

/** CSV as Excel in Switzerland opens it: semicolon, CRLF, UTF-8 with BOM. */
export function toCsv(data: TableExportData): string {
  const lines = [data.header, ...data.rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join(CSV_LINE_END) + CSV_LINE_END;
}

function csvCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = guardFormula(value);
  return /[";\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A text that starts with `=`, `+`, `-` or `@` would be run as a formula when
 * the CSV is opened in a spreadsheet; an apostrophe in front makes it text.
 */
function guardFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toXlsx(data: TableExportData): Uint8Array {
  return buildXlsx(data.sheet, data.header, data.rows);
}

/** `<name>_<YYYY-MM-DD>.<format>`, as the other exports of the application. */
export function exportFileName(name: string, format: ExportFormat, date = new Date()): string {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return `${name}_${day}.${format}`;
}

const MIME: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
};

export function exportBlob(data: TableExportData, format: ExportFormat): Blob {
  const content: BlobPart = format === 'xlsx' ? (toXlsx(data) as BlobPart) : toCsv(data);
  return new Blob([content], { type: MIME[format] });
}
