import type { TableExportDto, TableExportFilterDto } from '@ui-slim/apiClient';

/**
 * Export of a table to Excel or CSV (B1 5.5.5, slm 3). A page describes its
 * table with `tableExport()` at the moment of the click, so the file holds
 * the rows as they are shown: filtered and sorted, or the selected rows
 * (5.5.3). The file itself is written by the API (`admin/export/table`,
 * layout of the ELO exports) and the export is logged there.
 */
export type ExportFormat = TableExportDto['format'];
export type CellValue = string | number | null | undefined;

export interface ExportColumn<T> {
  /** Column title, already translated. */
  header: string;
  /** Cell value: numbers stay numbers, texts are already translated. */
  value: (row: T) => CellValue;
}

/** A table as the API takes it, without the format. */
export type TableExportData = Omit<TableExportDto, 'format' | 'lang'>;

export interface TableExportDefinition<T> {
  /** Id of the table = file name without date and extension, e.g. `schiessplaetze`. */
  table: string;
  /** Title in the block on top of the sheet, already translated. */
  title: string;
  /** Addition to the title, e.g. the Schiessplatz. */
  subtitle?: string | null;
  /** Filters that are set; entries without a value are left out. */
  filters?: readonly { label: string; value: string | number | null | undefined }[];
  /** `rows` are the selected rows, not all rows shown. */
  selection?: boolean;
  columns: readonly ExportColumn<T>[];
  rows: readonly T[];
}

/** The API shows at most this many filters in the block. */
const MAX_FILTERS = 6;

export function tableExport<T>(definition: TableExportDefinition<T>): TableExportData {
  const filters: TableExportFilterDto[] = (definition.filters ?? [])
    .filter((filter) => filter.value !== null && filter.value !== undefined && String(filter.value).trim() !== '')
    .slice(0, MAX_FILTERS)
    .map((filter) => ({ label: plain(filter.label), value: String(filter.value) }));
  return {
    table: definition.table,
    title: plain(definition.title),
    subtitle: definition.subtitle ?? null,
    filters,
    selection: !!definition.selection,
    header: definition.columns.map((column) => plain(column.header)),
    rows: definition.rows.map((row) => definition.columns.map((column) => column.value(row) ?? null)),
  };
}

/** Titles of the masks carry soft hyphens for narrow columns; a file must not. */
function plain(text: string): string {
  return text.replace(/\u00AD/g, '');
}

/** `<table>_<YYYY-MM-DD>.<format>`, as the other exports of the application. */
export function exportFileName(table: string, format: ExportFormat, date = new Date()): string {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return `${table}_${day}.${format}`;
}
