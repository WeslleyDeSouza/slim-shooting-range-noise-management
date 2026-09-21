import { Injectable } from '@nestjs/common';
import { ANNEX7_CATEGORY, Annex7CategoryCode } from '../area/entities';
import { ImportSourceDataA7Dto, ImportSourceDataA9Dto, ImportWlrDto, StateImportDto } from '../calculation/dto';
import { ReceiverType, SensitivityLevelCode, TimeGroup } from '../calculation/entities';

/**
 * File formats of Datenverwaltung › Schiessplatz › Berechnungen (B1 5.19
 * Import, 5.20 Export), free of the database so every rule is unit-tested:
 *
 * - sonARMS WLR files (`day.wlr` / `eve.wlr`, B1.2 4.5): one line per
 *   Empfänger × Quelle with LAE / LAFmax and the partial levels (Abbildung 32/33).
 * - Betriebsdaten Anhang 9 (`BetriebA9.txt`, B1.2 catalogue C5–C8) and
 *   Anhang 7 (D5–D10) per QuellenID.
 * - Schusszahlen as CSV (5.20 «Export Schusszahlen»).
 * - Berechnungszustände as a JSON bundle in the shape of `StateImportDto`,
 *   so an export round-trips through the import (5.20 «Export GeoDB» —
 *   the FGDB itself needs GDAL, see umsetzungsstand.md).
 *
 * Column names are matched case-insensitively over the aliases below, so
 * the German catalogue names, the sonARMS headers and English keys all work.
 */
@Injectable()
export class CalculationFilesService {
  // ---------------------------------------------------------------------------
  // Delimited text
  // ---------------------------------------------------------------------------

  /** Splits a text file into header + rows; the delimiter (tab, `;`, `,`) is detected on the header. */
  parseDelimited(text: string): ParsedTable {
    const lines = text
      .replace(/^\uFEFF/, '') // strip a UTF-8 BOM
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
    if (!lines.length) return { header: [], rows: [], delimiter: ';' };
    const delimiter = detectDelimiter(lines[0]);
    const header = splitLine(lines[0], delimiter).map((h) => h.trim());
    const rows = lines.slice(1).map((line, i) => ({ line: i + 2, cells: splitLine(line, delimiter).map((c) => c.trim()) }));
    return { header, rows, delimiter };
  }

  // ---------------------------------------------------------------------------
  // WLR (5.19, 5.21)
  // ---------------------------------------------------------------------------

  /**
   * Parses a WLR file of one Zeitgruppe. Required columns: Empfänger, Quelle,
   * LAE, LAFmax; optional: Elevation, LAE(MK), LAE(GK), LAE(Det); Gebäude and
   * Waffe are display columns and ignored. A line with a missing required
   * value or a non-numeric level is reported and skipped.
   */
  parseWlr(text: string, timeGroup: TimeGroup): ParsedWlr {
    const table = this.parseDelimited(text);
    const errors: string[] = [];
    const col = columnIndex(table.header, WLR_COLUMNS);
    for (const required of ['point', 'source', 'lae', 'lafmax'] as const) {
      if (col[required] === undefined) errors.push(`Spalte «${WLR_COLUMNS[required][0]}» fehlt in der Kopfzeile`);
    }
    if (errors.length) return { rows: [], errors, skipped: table.rows.length };

    const rows: ImportWlrDto[] = [];
    let skipped = 0;
    for (const r of table.rows) {
      const point = cell(r.cells, col['point']);
      const source = cell(r.cells, col['source']);
      const lae = num(cell(r.cells, col['lae']));
      const lafmax = num(cell(r.cells, col['lafmax']));
      const problems: string[] = [];
      if (!point) problems.push('Empfänger fehlt');
      if (!source) problems.push('Quelle fehlt');
      if (lae === null) problems.push('LAE fehlt oder ist keine Zahl');
      if (lafmax === null) problems.push('LAFmax fehlt oder ist keine Zahl');
      if (problems.length) {
        errors.push(`Zeile ${r.line}: ${problems.join(', ')}`);
        skipped++;
        continue;
      }
      rows.push({
        point: point as string,
        source: source as string,
        timeGroup,
        lae: lae as number,
        lafmax: lafmax as number,
        laeMk: num(cell(r.cells, col['laeMk'])),
        laeGk: num(cell(r.cells, col['laeGk'])),
        laeDet: num(cell(r.cells, col['laeDet'])),
        elevation: num(cell(r.cells, col['elevation'])),
      });
    }
    // The same Empfänger × Quelle twice in one file is a broken export, not two levels.
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.point}|${row.source}`;
      if (seen.has(key)) errors.push(`${row.point} × ${row.source} ist doppelt in der Datei`);
      seen.add(key);
    }
    return { rows, errors, skipped };
  }

  // ---------------------------------------------------------------------------
  // Betriebsdaten (5.19, 5.21)
  // ---------------------------------------------------------------------------

  /** Parses Betriebsdaten Anhang 9 (BetriebA9): QuellenID, A9_M1, A9_M2, Schätzung, Jahr, Bemerkung. */
  parseOperatingA9(text: string): ParsedOperating<ImportSourceDataA9Dto> {
    const table = this.parseDelimited(text);
    const errors: string[] = [];
    const col = columnIndex(table.header, A9_COLUMNS);
    for (const required of ['sourceId', 'shotsInside', 'shotsOutside'] as const) {
      if (col[required] === undefined) errors.push(`Spalte «${A9_COLUMNS[required][0]}» fehlt in der Kopfzeile`);
    }
    if (errors.length) return { rows: [], errors, skipped: table.rows.length };
    const rows: OperatingRow<ImportSourceDataA9Dto>[] = [];
    let skipped = 0;
    for (const r of table.rows) {
      const sourceId = cell(r.cells, col['sourceId']);
      const shotsInside = int(cell(r.cells, col['shotsInside']));
      const shotsOutside = int(cell(r.cells, col['shotsOutside']));
      const problems: string[] = [];
      if (!sourceId) problems.push('QuellenID fehlt');
      if (shotsInside === null || shotsInside < 0) problems.push('A9_M1 fehlt oder ist keine ganze Zahl ≥ 0');
      if (shotsOutside === null || shotsOutside < 0) problems.push('A9_M2 fehlt oder ist keine ganze Zahl ≥ 0');
      if (problems.length) {
        errors.push(`Zeile ${r.line}: ${problems.join(', ')}`);
        skipped++;
        continue;
      }
      rows.push({
        sourceId: sourceId as string,
        data: {
          shotsInside: shotsInside as number,
          shotsOutside: shotsOutside as number,
          estimated: bool(cell(r.cells, col['estimated'])),
          year: int(cell(r.cells, col['year'])),
          remark: cell(r.cells, col['remark']) || null,
        },
      });
    }
    errors.push(...duplicates(rows.map((r) => r.sourceId)));
    return { rows, errors, skipped };
  }

  /** Parses Betriebsdaten Anhang 7: QuellenID, Kategorie (a–f), Halbtag_Wo, Halbtag_So, Zahl_Wo, Zahl_So, Schätzung, Jahr, Bemerkung. */
  parseOperatingA7(text: string): ParsedOperating<ImportSourceDataA7Dto> {
    const table = this.parseDelimited(text);
    const errors: string[] = [];
    const col = columnIndex(table.header, A7_COLUMNS);
    for (const required of ['sourceId', 'halfDaysWork', 'halfDaysSunday', 'shotsWork'] as const) {
      if (col[required] === undefined) errors.push(`Spalte «${A7_COLUMNS[required][0]}» fehlt in der Kopfzeile`);
    }
    if (errors.length) return { rows: [], errors, skipped: table.rows.length };
    const rows: OperatingRow<ImportSourceDataA7Dto>[] = [];
    let skipped = 0;
    for (const r of table.rows) {
      const sourceId = cell(r.cells, col['sourceId']);
      const halfDaysWork = num(cell(r.cells, col['halfDaysWork']));
      const halfDaysSunday = num(cell(r.cells, col['halfDaysSunday']));
      const shotsWork = int(cell(r.cells, col['shotsWork']));
      const categoryRaw = (cell(r.cells, col['category']) ?? '').toLowerCase();
      const problems: string[] = [];
      if (!sourceId) problems.push('QuellenID fehlt');
      if (halfDaysWork === null || halfDaysWork < 0) problems.push('Halbtag_Wo fehlt oder ist keine Zahl ≥ 0');
      if (halfDaysSunday === null || halfDaysSunday < 0) problems.push('Halbtag_So fehlt oder ist keine Zahl ≥ 0');
      if (shotsWork === null || shotsWork < 0) problems.push('Zahl_Wo fehlt oder ist keine ganze Zahl ≥ 0');
      if (categoryRaw && !ANNEX7_CATEGORY.includes(categoryRaw as Annex7CategoryCode)) problems.push(`Kategorie «${categoryRaw}» ist keine Waffenkategorie a–f nach Anhang 7`);
      if (problems.length) {
        errors.push(`Zeile ${r.line}: ${problems.join(', ')}`);
        skipped++;
        continue;
      }
      rows.push({
        sourceId: sourceId as string,
        data: {
          category: (categoryRaw || undefined) as Annex7CategoryCode | undefined,
          halfDaysWork: halfDaysWork as number,
          halfDaysSunday: halfDaysSunday as number,
          shotsWork: shotsWork as number,
          shotsSunday: int(cell(r.cells, col['shotsSunday'])),
          estimated: bool(cell(r.cells, col['estimated'])),
          year: int(cell(r.cells, col['year'])),
          remark: cell(r.cells, col['remark']) || null,
        },
      });
    }
    errors.push(...duplicates(rows.map((r) => r.sourceId)));
    return { rows, errors, skipped };
  }

  // ---------------------------------------------------------------------------
  // Exports (5.20)
  // ---------------------------------------------------------------------------

  /** Schusszahlen as CSV (semicolon, CRLF, UTF-8 with BOM for Excel): one line per Nutzungsposition. */
  shotsCsv(rows: ShotCsvRow[]): string {
    const header = [
      'Datum', 'Von', 'Bis', 'Stellungsraum', 'Koordinationsabschnitts-Nr.', 'Einheit', 'Nutzungskategorie',
      'Zivile Nutzungsart', 'Waffe / Kaliber', 'Menge', 'Mengeneinheit', 'Personen', 'Erfasser', 'Quelle',
    ];
    const lines = [header.map(csvCell).join(';')];
    for (const r of rows) {
      lines.push(
        [
          r.date, r.timeFrom, r.timeTo, r.roomName, r.roomNo ?? '', r.unit, r.usageType, r.civilUsageKind ?? '',
          r.combinationName, formatNumber(r.quantity), r.quantityUnit, r.personCount ?? '', r.recordedBy, r.source,
        ]
          .map(csvCell)
          .join(';'),
      );
    }
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  /**
   * States as one JSON bundle. Every entry is a `StateImportDto`, so the
   * bundle can be handed to a contractor and imported again (round trip).
   */
  stateBundle(input: StateBundleInput): StateBundle {
    return {
      format: 'slim-state-export',
      version: 1,
      exportedAt: input.exportedAt.toISOString(),
      area: { coordinationSectionNo: input.area.coordinationSectionNo, name: input.area.name },
      states: input.states.map((s) => this.toImportDto(s)),
    };
  }

  /** One state of the database as the import expects it. */
  toImportDto(m: StateExportModel): StateImportDto {
    const partNoById = new Map(m.plantParts.map((p) => [p.id, p.coordinationSectionNo]));
    const pointCode = new Map(m.points.map((p) => [p.id, p.sonarmsId]));
    const sourceKey = new Map(m.sources.map((s) => [s.id, s.sourceId]));
    return {
      calculation: {
        name: m.calculation.name,
        supplier: m.calculation.supplier,
        deliveredAt: m.calculation.deliveredAt,
        description: m.calculation.description ?? null,
        fileName: m.calculation.fileName ?? null,
      },
      state: {
        externalId: m.state.externalId,
        name: m.state.name,
        referenceYear: m.state.referenceYear,
        isCurrent: m.state.isCurrent,
        isMgdm: m.state.isMgdm,
      },
      plantParts: m.plantParts.map((p) => ({
        coordinationSectionNo: p.coordinationSectionNo,
        name: p.name,
        type: p.type,
        remark: p.remark ?? null,
        builtAfter1985: p.builtAfter1985,
        geometry: p.geometry ?? null,
        roomName: p.roomName ?? null,
      })),
      sources: m.sources.map((s) => ({
        sourceId: s.sourceId,
        plantPartNo: partNoById.get(s.plantPartId) ?? '',
        weaponSystem: s.weaponSystem,
        remarkGeom: s.remarkGeom ?? null,
        geometry: s.geometry ?? null,
        a9: s.a9
          ? { shotsInside: s.a9.shotsInside, shotsOutside: s.a9.shotsOutside, estimated: s.a9.estimated, year: s.a9.year, remark: s.a9.remark, planCategory: s.a9.planCategory }
          : null,
        a7: s.a7
          ? { category: s.a7.category, halfDaysWork: s.a7.halfDaysWork, halfDaysSunday: s.a7.halfDaysSunday, shotsWork: s.a7.shotsWork, shotsSunday: s.a7.shotsSunday, estimated: s.a7.estimated, year: s.a7.year, remark: s.a7.remark, planCategory: s.a7.planCategory }
          : null,
      })),
      immissionPoints: m.points.map((p) => ({
        sonarmsId: p.sonarmsId,
        code: p.code,
        egid: p.egid,
        egrid: p.egrid ?? null,
        address: p.address,
        municipality: p.municipality,
        type: p.type,
        sensitivityLevel: p.sensitivityLevel,
        east: p.east,
        north: p.north,
        height: p.height,
        mapX: p.mapX,
        mapY: p.mapY,
        sortOrder: p.sortOrder,
        geometry: p.geometry ?? null,
      })),
      wlr: m.wlr
        .filter((w) => pointCode.has(w.immissionPointId) && sourceKey.has(w.sourceLineId))
        .map((w) => ({
          point: pointCode.get(w.immissionPointId) as string,
          source: sourceKey.get(w.sourceLineId) as string,
          timeGroup: w.timeGroup,
          lae: w.lae,
          lafmax: w.lafmax,
          laeMk: w.laeMk,
          laeGk: w.laeGk,
          laeDet: w.laeDet,
          elevation: w.elevation,
        })),
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTable {
  header: string[];
  rows: { line: number; cells: string[] }[];
  delimiter: string;
}

export interface ParsedWlr {
  rows: ImportWlrDto[];
  errors: string[];
  skipped: number;
}

export interface OperatingRow<T> {
  sourceId: string;
  data: T;
}

export interface ParsedOperating<T> {
  rows: OperatingRow<T>[];
  errors: string[];
  skipped: number;
}

export interface ShotCsvRow {
  date: string;
  timeFrom: string;
  timeTo: string;
  roomName: string;
  roomNo: string | null;
  unit: string;
  usageType: string;
  civilUsageKind: string | null;
  combinationName: string;
  quantity: number;
  quantityUnit: string;
  personCount: number | null;
  recordedBy: string;
  source: string;
}

/** What `toImportDto` needs of a state — plain fields, no entities, so tests build it by hand. */
export interface StateExportModel {
  calculation: { name: string; supplier: string; deliveredAt: string; description?: string | null; fileName?: string | null };
  state: { externalId: string | null; name: string; referenceYear: number; isCurrent: boolean; isMgdm: boolean };
  plantParts: { id: string; coordinationSectionNo: string; name: string; type: string; remark?: string | null; builtAfter1985: boolean; geometry?: string | null; roomName?: string | null }[];
  sources: {
    id: string;
    sourceId: string;
    plantPartId: string;
    weaponSystem: string;
    remarkGeom?: string | null;
    geometry?: string | null;
    a9: { shotsInside: number; shotsOutside: number; estimated: boolean; year: number | null; remark: string | null; planCategory: string } | null;
    a7: { category: Annex7CategoryCode; halfDaysWork: number; halfDaysSunday: number; shotsWork: number; shotsSunday: number | null; estimated: boolean; year: number | null; remark: string | null; planCategory: string } | null;
  }[];
  points: {
    id: string;
    sonarmsId: string;
    code: string;
    egid: string | null;
    egrid?: string | null;
    address: string;
    municipality: string | null;
    type: ReceiverType;
    sensitivityLevel: SensitivityLevelCode;
    east: number | null;
    north: number | null;
    height: number | null;
    mapX: number;
    mapY: number;
    sortOrder: number;
    geometry?: string | null;
  }[];
  wlr: { immissionPointId: string; sourceLineId: string; timeGroup: TimeGroup; lae: number; lafmax: number; laeMk: number | null; laeGk: number | null; laeDet: number | null; elevation: number | null }[];
}

export interface StateBundleInput {
  exportedAt: Date;
  area: { coordinationSectionNo: string; name: string };
  states: StateExportModel[];
}

export interface StateBundle {
  format: 'slim-state-export';
  version: 1;
  exportedAt: string;
  area: { coordinationSectionNo: string; name: string };
  states: StateImportDto[];
}

// ---------------------------------------------------------------------------
// Column aliases (lower-case, without spaces) and helpers
// ---------------------------------------------------------------------------

const WLR_COLUMNS = {
  point: ['Empfänger', 'Empfaenger', 'Empfanger', 'Receiver', 'Point', 'sonARMS_ID', 'EP'],
  source: ['Quelle', 'QuellenID', 'Source', 'Quellen_ID'],
  lae: ['LAE', 'LAE_total', 'LAEtot'],
  lafmax: ['LAFmax', 'LAF_max', 'LAFMAX'],
  laeMk: ['LAE(MK)', 'LAE_MK', 'LAEMK'],
  laeGk: ['LAE(GK)', 'LAE_GK', 'LAEGK'],
  laeDet: ['LAE(Det)', 'LAE_Det', 'LAEDet', 'LAE(DET)'],
  elevation: ['Elevation', 'Elev'],
} as const;

const A9_COLUMNS = {
  sourceId: ['QuellenID', 'Quelle', 'Source', 'Quellen_ID', 'SourceId'],
  shotsInside: ['A9_M1', 'Schuss_innerhalb', 'shotsInside', 'M1'],
  shotsOutside: ['A9_M2', 'Schuss_ausserhalb', 'shotsOutside', 'M2'],
  estimated: ['Schätzung', 'Schaetzung', 'Schatzung', 'estimated', 'Schaetz'],
  year: ['Jahr', 'Erhebungsjahr', 'year'],
  remark: ['Bemerkung', 'remark'],
} as const;

const A7_COLUMNS = {
  sourceId: ['QuellenID', 'Quelle', 'Source', 'Quellen_ID', 'SourceId'],
  category: ['Kategorie', 'Waffenkategorie', 'category', 'Kat'],
  halfDaysWork: ['Halbtag_Wo', 'HalbtagWo', 'halfDaysWork'],
  halfDaysSunday: ['Halbtag_So', 'HalbtagSo', 'halfDaysSunday'],
  shotsWork: ['Zahl_Wo', 'ZahlWo', 'shotsWork'],
  shotsSunday: ['Zahl_So', 'ZahlSo', 'shotsSunday'],
  estimated: ['Schätzung', 'Schaetzung', 'Schatzung', 'estimated'],
  year: ['Jahr', 'Erhebungsjahr', 'year'],
  remark: ['Bemerkung', 'remark'],
} as const;

function normalise(name: string): string {
  return name.toLowerCase().replace(/[\s_\-().]/g, '').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

/** Index of every known column in the header (by alias), missing ones stay undefined. */
function columnIndex(header: string[], aliases: Record<string, readonly string[]>): Record<string, number | undefined> {
  const normalised = header.map(normalise);
  const out: Record<string, number | undefined> = {};
  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const i = normalised.indexOf(normalise(name));
      if (i >= 0) {
        out[key] = i;
        break;
      }
    }
  }
  return out;
}

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [
    ['\t', (line.match(/\t/g) ?? []).length],
    [';', (line.match(/;/g) ?? []).length],
    [',', (line.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

/** Splits one line, honouring double quotes ("a;b" stays one cell, "" is an escaped quote). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function cell(cells: string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const value = cells[index];
  return value === undefined ? undefined : value.trim();
}

/** Number with `.` or `,` as decimal separator; empty / `-` / `NaN` → null. */
function num(value: string | undefined): number | null {
  if (value === undefined || value === '' || value === '-' || value === '–') return null;
  const n = Number(value.replace(/'/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function int(value: string | undefined): number | null {
  const n = num(value);
  return n === null ? null : Number.isInteger(n) ? n : null;
}

function bool(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'x', 'ja', 'yes', 'true', 'y', 'j', 'wahr'].includes(value.trim().toLowerCase());
}

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) out.push(`QuellenID ${k} ist doppelt in der Datei`);
    seen.add(k);
  }
  return out;
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}
