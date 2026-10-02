import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  registerDecorator,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { EXPORT_MAX_FILTERS } from '../excel-export';

export const TABLE_EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type TableExportFormat = (typeof TABLE_EXPORT_FORMATS)[number];
export const TABLE_EXPORT_LANGS = ['de', 'fr', 'it', 'en'] as const;

/** Limits of one export; the request body may hold `TABLE_EXPORT_BODY_LIMIT` at most. */
export const TABLE_EXPORT_MAX_ROWS = 20_000;
export const TABLE_EXPORT_MAX_COLUMNS = 60;
export const TABLE_EXPORT_MAX_CELL = 2_000;
export const TABLE_EXPORT_BODY_LIMIT = '8mb';

/** Rows of cells: text (up to `TABLE_EXPORT_MAX_CELL` characters), finite number or null. */
function IsCellMatrix(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCellMatrix',
      target: target.constructor,
      propertyName,
      options: { message: `${propertyName} must be rows of cells (text, number or null) with at most ${TABLE_EXPORT_MAX_COLUMNS} columns`, ...options },
      validator: {
        validate: (value: unknown): boolean =>
          Array.isArray(value) &&
          value.every(
            (row) =>
              Array.isArray(row) &&
              row.length <= TABLE_EXPORT_MAX_COLUMNS &&
              row.every(
                (cell) =>
                  cell === null ||
                  (typeof cell === 'number' && Number.isFinite(cell)) ||
                  (typeof cell === 'string' && cell.length <= TABLE_EXPORT_MAX_CELL),
              ),
          ),
      },
    });
}

export class TableExportFilterDto {
  @IsString()
  @Length(1, 80)
  @ApiProperty({ description: 'Bezeichnung des Filters, wie in der Maske (z. B. «Jahr»)' })
  label: string;

  @IsString()
  @MaxLength(300)
  @ApiProperty({ description: 'Gewählter Wert des Filters als Text (z. B. «2026»)' })
  value: string;
}

/** A table as shown in a mask, to be written as Excel or CSV file (B1 5.5.5, slm 3). */
export class TableExportDto {
  @IsIn(TABLE_EXPORT_FORMATS)
  @ApiProperty({ enum: TABLE_EXPORT_FORMATS, description: 'Dateiformat: Excel (xlsx) oder CSV' })
  format: TableExportFormat;

  @Matches(/^[a-z0-9][a-z0-9_-]{0,59}$/)
  @ApiProperty({ description: 'Kennung der Tabelle = Dateiname ohne Datum und Endung, z. B. «schiessplaetze»; steht im Logbuch' })
  table: string;

  @IsString()
  @Length(1, 120)
  @ApiProperty({ description: 'Titel im Kopfblock und Name des Blatts, z. B. «Übersicht Schiessplätze»' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ApiPropertyOptional({ nullable: true, description: 'Zusatz zum Titel, z. B. der Schiessplatz («1104.020 Geissalp»)' })
  subtitle?: string | null;

  @IsOptional()
  @IsIn(TABLE_EXPORT_LANGS)
  @ApiPropertyOptional({ enum: TABLE_EXPORT_LANGS, description: 'Sprache der Beschriftungen im Kopfblock; Standard de' })
  lang?: (typeof TABLE_EXPORT_LANGS)[number];

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Die Zeilen sind die markierten Zeilen (B1 5.5.3), nicht alle angezeigten' })
  selection?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EXPORT_MAX_FILTERS)
  @ValidateNested({ each: true })
  @Type(() => TableExportFilterDto)
  @ApiPropertyOptional({ type: TableExportFilterDto, isArray: true, description: `Beim Export aktive Filter (höchstens ${EXPORT_MAX_FILTERS}); stehen im Kopfblock` })
  filters?: TableExportFilterDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TABLE_EXPORT_MAX_COLUMNS)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ApiProperty({ type: String, isArray: true, description: 'Spaltentitel in der Reihenfolge der Tabelle' })
  header: string[];

  @IsArray()
  @ArrayMaxSize(TABLE_EXPORT_MAX_ROWS)
  @IsCellMatrix()
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }], nullable: true } },
    description: 'Zeilen in der angezeigten Reihenfolge (Filter und Sortierung angewendet); je Zelle Text, Zahl oder null',
  })
  rows: (string | number | null)[][];
}
