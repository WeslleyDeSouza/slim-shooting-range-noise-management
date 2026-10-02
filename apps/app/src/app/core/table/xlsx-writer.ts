/**
 * Writes a one-sheet .xlsx file (B1 5.5.5) without a library: the browser
 * build of exceljs calls `Function(...)`, which the Content-Security-Policy
 * of the API forbids. An .xlsx file is a ZIP of a few XML parts; the ZIP is
 * written uncompressed («stored»), which every spreadsheet program reads.
 */
export type CellValue = string | number | null | undefined;

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml';

/** Excel limits of a sheet name. */
const SHEET_NAME_MAX = 31;
const COLUMN_WIDTH_MIN = 8;
const COLUMN_WIDTH_MAX = 60;
/** Style index of the header row in `styles.xml` (bold). */
const STYLE_HEADER = 1;

/** One sheet: a bold, frozen header row with a filter, then the rows. */
export function buildXlsx(sheetName: string, header: readonly string[], rows: readonly (readonly CellValue[])[]): Uint8Array {
  const files: [string, string][] = [
    ['[Content_Types].xml', contentTypes()],
    ['_rels/.rels', relationships([['rId1', `${NS_REL}/officeDocument`, 'xl/workbook.xml']])],
    ['xl/workbook.xml', workbook(sheetName)],
    ['xl/_rels/workbook.xml.rels', relationships([['rId1', `${NS_REL}/worksheet`, 'worksheets/sheet1.xml'], ['rId2', `${NS_REL}/styles`, 'styles.xml']])],
    ['xl/styles.xml', styles()],
    ['xl/worksheets/sheet1.xml', worksheet(header, rows)],
  ];
  const encoder = new TextEncoder();
  return zipStore(files.map(([name, content]) => ({ name, data: encoder.encode(content) })));
}

/** Sheet name Excel accepts: no `: \ / ? * [ ]`, at most 31 characters, never empty. */
export function sheetNameOf(name: string): string {
  const clean = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SHEET_NAME_MAX).trim();
  return clean || 'Export';
}

/** Column letters of a 0-based index: 0 → A, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function contentTypes(): string {
  return (
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPE}.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/>` +
    '</Types>'
  );
}

function relationships(items: [id: string, type: string, target: string][]): string {
  const body = items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('');
  return `${XML}<Relationships xmlns="${NS_PACKAGE}">${body}</Relationships>`;
}

function workbook(sheetName: string): string {
  return (
    `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<bookViews><workbookView/></bookViews>' +
    `<sheets><sheet name="${escapeXml(sheetNameOf(sheetName))}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

function styles(): string {
  return (
    `${XML}<styleSheet xmlns="${NS_MAIN}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

function worksheet(header: readonly string[], rows: readonly (readonly CellValue[])[]): string {
  const widths = header.map((title, column) => {
    const longest = rows.reduce((max, row) => Math.max(max, String(row[column] ?? '').length), title.length);
    return Math.min(COLUMN_WIDTH_MAX, Math.max(COLUMN_WIDTH_MIN, longest + 2));
  });
  const cols = widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('');
  const lines = [rowXml(1, header, STYLE_HEADER), ...rows.map((row, i) => rowXml(i + 2, row))].join('');
  const last = `${columnName(Math.max(header.length, 1) - 1)}${rows.length + 1}`;
  return (
    `${XML}<worksheet xmlns="${NS_MAIN}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${lines}</sheetData>` +
    (header.length ? `<autoFilter ref="A1:${last}"/>` : '') +
    '</worksheet>'
  );
}

function rowXml(index: number, values: readonly CellValue[], style?: number): string {
  const cells = values.map((value, column) => cellXml(`${columnName(column)}${index}`, value, style)).join('');
  return `<row r="${index}">${cells}</row>`;
}

function cellXml(ref: string, value: CellValue, style?: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** XML 1.0 text: escapes the markup characters and drops the control characters XML does not allow. */
export function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- ZIP, method «stored» ---------------------------------------------------

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** UTF-8 file names. */
const ZIP_FLAGS = 0x0800;
const ZIP_VERSION = 20;
/** 01.01.1980 00:00 — a fixed stamp keeps the same table byte-identical. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

function zipStore(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, ZIP_VERSION, true);
    local.setUint16(6, ZIP_FLAGS, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, entry.data);

    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, ZIP_VERSION, true);
    record.setUint16(6, ZIP_VERSION, true);
    record.setUint16(8, ZIP_FLAGS, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, DOS_TIME, true);
    record.setUint16(14, DOS_DATE, true);
    record.setUint32(16, crc, true);
    record.setUint32(20, entry.data.length, true);
    record.setUint32(24, entry.data.length, true);
    record.setUint16(28, name.length, true);
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), name);
    offset += 30 + name.length + entry.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let position = 0;
  for (const part of [...parts, ...central, new Uint8Array(end.buffer)]) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
