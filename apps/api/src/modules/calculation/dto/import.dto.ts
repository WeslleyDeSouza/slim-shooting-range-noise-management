import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SENSITIVITY_LEVEL, SensitivityLevelCode } from '../entities/immission-point.entity';
import { RECEIVER_TYPE, ReceiverType } from '../entities/immission-point.entity';
import { TIME_GROUP, TimeGroup } from '../entities/wlr.entity';
import { ANNEX7_CATEGORY, Annex7CategoryCode } from '../../area/entities';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Import of one Berechnungszustand (B1 5.19, 9.1, Kap. 10.4): the content of
 * the FGDB (B1.2 11.4, one object per feature class) plus the WLR files of
 * sonARMS, already parsed into JSON by the client (FME / GDAL / the WLR
 * parser). Everything is staged, checked and written in one transaction;
 * an unknown Stellungsraum aborts the import with a warning (slm 45).
 */
export class ImportCalculationDto {
  @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiProperty({ description: 'Bezeichnung der Immissionsberechnung (Lieferung); bestehende gleichen Namens wird ergänzt' })
  name: string;

  @IsOptional() @IsString() @MaxLength(80)
  @ApiPropertyOptional({ description: 'Lieferantin / Büro (S10 Visum)' })
  supplier?: string;

  @Matches(DATE)
  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD (S9)' })
  deliveredAt: string;

  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'S1 ZustandMPV' }) fgdbStateMpv?: string | null;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'S2 ZustandIST' }) fgdbStateIst?: string | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'S3' }) mpvMeasures?: boolean | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'S4' }) istObstacles?: boolean | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'S5' }) istHighScreens?: boolean | null;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'S6' }) immissionPointCount?: number | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'S7' }) civilUse?: boolean | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'S8' }) shootingHousePresent?: boolean | null;
}

export class ImportStateDto {
  @IsOptional() @IsString() @MaxLength(20)
  @ApiPropertyOptional({ description: 'K1 ZustandID der FGDB (SPMNr_Laufnr)' })
  externalId?: string | null;

  @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiProperty({ description: 'K2 Bezeichnung' })
  name: string;

  @IsInt()
  @ApiProperty({ description: 'K3 Referenzjahr' })
  referenceYear: number;

  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'Als aktuell gültigen Zustand setzen' }) isCurrent?: boolean;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'Als Stand MGDM setzen' }) isMgdm?: boolean;
}

export class ImportPropagationDto {
  @IsOptional() @IsString() @MaxLength(30) @ApiPropertyOptional({ description: 'K4 Ausbreitungsmodell' }) model?: string;
  @IsOptional() @IsString() @MaxLength(30) @ApiPropertyOptional({ description: 'K5 Version' }) modelVersion?: string;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'K6' }) heightModel?: string | null;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'K7' }) buildingDataset?: string | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'K8' }) meteoIncluded?: boolean;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'K9' }) meteoCount?: number | null;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'K10' }) meteoData?: string | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'K11' }) reflectionIncluded?: boolean;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'K12' }) forestIncluded?: boolean;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'K13' }) primarySurfaces?: string;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'K14' }) remark?: string | null;
}

export class ImportPerimeterDto {
  @IsNotEmpty() @IsString() @MaxLength(256) @ApiProperty({ description: 'A2 Name' }) name: string;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'A3 Nr_SPM' }) spmNo?: string;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'A4 Koord_Nr' }) coordinationSectionNo?: string;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'A1 Geometrie (WKT, LV95)' }) geometry?: string | null;
}

export class ImportPlantPartDto {
  @IsNotEmpty() @IsString() @MaxLength(20)
  @ApiProperty({ description: 'B2 Koordinationsabschnittsnummer des Anlageteils; wird dem übergeordneten Stellungsraum mit derselben Nummer zugeordnet' })
  coordinationSectionNo: string;

  @IsNotEmpty() @IsString() @MaxLength(256)
  @ApiProperty({ description: 'B3 Bezeichnung gemäss SplDossier' })
  name: string;

  @IsOptional() @IsString() @MaxLength(80) @ApiPropertyOptional({ description: 'B4 Schiessanlagentyp (Codeliste)' }) type?: string;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'B5 Bemerkung' }) remark?: string | null;

  @IsBoolean()
  @ApiProperty({ description: 'B6 Baujahr: nach 1.1.1985' })
  builtAfter1985: boolean;

  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'B1 Geometrie (WKT, LV95)' }) geometry?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  @ApiPropertyOptional({ description: 'Übergeordneter Stellungsraum (Bezeichnung), wenn die Nummer nicht genügt' })
  roomName?: string | null;
}

export class ImportSourceDataA9Dto {
  @IsInt() @ApiProperty({ description: 'C5 A9_M1' }) shotsInside: number;
  @IsInt() @ApiProperty({ description: 'C6 A9_M2' }) shotsOutside: number;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'C7' }) estimated?: boolean;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'C8' }) year?: number | null;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'C10' }) remark?: string | null;
  @IsOptional() @IsString() @MaxLength(60) @ApiPropertyOptional({ description: 'C11' }) planCategory?: string;
}

export class ImportSourceDataA7Dto {
  @IsOptional() @IsIn(ANNEX7_CATEGORY) @ApiPropertyOptional({ enum: ANNEX7_CATEGORY }) category?: Annex7CategoryCode;
  @IsNumber() @ApiProperty({ description: 'D5 Halbtag_Wo' }) halfDaysWork: number;
  @IsNumber() @ApiProperty({ description: 'D6 Halbtag_So' }) halfDaysSunday: number;
  @IsInt() @ApiProperty({ description: 'D7 Zahl_Wo' }) shotsWork: number;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'D8 Zahl_So' }) shotsSunday?: number | null;
  @IsOptional() @IsBoolean() @ApiPropertyOptional({ description: 'D9' }) estimated?: boolean;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'D10' }) year?: number | null;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'D12' }) remark?: string | null;
  @IsOptional() @IsString() @MaxLength(60) @ApiPropertyOptional({ description: 'D13' }) planCategory?: string;
}

export class ImportSourceLineDto {
  @IsNotEmpty() @IsString() @MaxLength(256)
  @ApiProperty({ description: 'C3/D3 QuellenID (eindeutig je Zustand)' })
  sourceId: string;

  @IsNotEmpty() @IsString() @MaxLength(20)
  @ApiProperty({ description: 'Koordinationsabschnittsnummer des Anlageteils (B2)' })
  plantPartNo: string;

  @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiProperty({ description: 'C2/D2 Waffensystem: Name der sonARMS-Waffendatenbank; wird der Kombination mit dieser sonARMS-ID zugeordnet' })
  weaponSystem: string;

  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'C4/D4 BemerkGeom' }) remarkGeom?: string | null;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'C1/D1 Geometrie (WKT PolylineZ, LV95)' }) geometry?: string | null;

  @IsOptional() @ValidateNested() @Type(() => ImportSourceDataA9Dto)
  @ApiPropertyOptional({ type: ImportSourceDataA9Dto })
  a9?: ImportSourceDataA9Dto | null;

  @IsOptional() @ValidateNested() @Type(() => ImportSourceDataA7Dto)
  @ApiPropertyOptional({ type: ImportSourceDataA7Dto })
  a7?: ImportSourceDataA7Dto | null;
}

export class ImportBuildingDto {
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'J4 EGID' }) egid?: string | null;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'J5 Adresse' }) address?: string | null;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'J3' }) surfaceType?: string;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'J6' }) assessment?: string;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'J7 Personen' }) persons?: number;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'J8' }) remark?: string | null;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'J1 Geometrie (WKT PolygonZ)' }) geometry?: string | null;
}

export class ImportImmissionPointDto {
  @IsNotEmpty() @IsString() @MaxLength(30)
  @ApiProperty({ description: 'H13 sonARMS_ID (Empfänger der WLR-Datei), eindeutig je Zustand' })
  sonarmsId: string;

  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'Anzeigecode, Default = sonARMS_ID' }) code?: string;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'H2 EGID (→ Gebäude)' }) egid?: string | null;
  @IsOptional() @IsString() @MaxLength(14) @ApiPropertyOptional({ description: 'H3 EGRID' }) egrid?: string | null;
  @IsOptional() @IsString() @MaxLength(100) @ApiPropertyOptional({ description: 'H4 Adresse' }) address?: string;
  @IsOptional() @IsString() @MaxLength(80) @ApiPropertyOptional({ description: 'Gemeinde' }) municipality?: string | null;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'H5 EPNr' }) pointNo?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'H6 Lr der Lieferung' }) deliveredLr?: number | null;
  @IsOptional() @IsString() @MaxLength(30) @ApiPropertyOptional({ description: 'H7 Betrieb' }) operation?: string;
  @IsOptional() @IsIn(RECEIVER_TYPE) @ApiPropertyOptional({ enum: RECEIVER_TYPE, description: 'H8 Typ' }) type?: ReceiverType;
  @IsOptional() @IsString() @MaxLength(30) @ApiPropertyOptional({ description: 'H9 Beurteilung der Lieferung' }) deliveredAssessment?: string;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'H11' }) remark?: string | null;

  @IsIn(SENSITIVITY_LEVEL)
  @ApiProperty({ enum: SENSITIVITY_LEVEL, description: 'H12 Empfindlichkeitsstufe' })
  sensitivityLevel: SensitivityLevelCode;

  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'LV95 Ost' }) east?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'LV95 Nord' }) north?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'Höhe ü. M.' }) height?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'Schematische Karte, % Breite' }) mapX?: number;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'Schematische Karte, % Höhe' }) mapY?: number;
  @IsOptional() @IsInt() @ApiPropertyOptional() sortOrder?: number;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'H1 Geometrie (WKT PointZ)' }) geometry?: string | null;
}

export class ImportWlrDto {
  @IsNotEmpty() @IsString() @MaxLength(30) @ApiProperty({ description: 'Empfänger = sonARMS_ID des Immissionspunkts' }) point: string;
  @IsNotEmpty() @IsString() @MaxLength(256) @ApiProperty({ description: 'Quelle = QuellenID' }) source: string;
  @IsIn(TIME_GROUP) @ApiProperty({ enum: TIME_GROUP, description: 'Zeitgruppe der WLR-Datei' }) timeGroup: TimeGroup;
  @IsNumber() @ApiProperty({ description: 'LAE [dB]' }) lae: number;
  @IsNumber() @ApiProperty({ description: 'LAFmax [dB]' }) lafmax: number;
  @IsOptional() @IsNumber() @ApiPropertyOptional() laeMk?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional() laeGk?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional() laeDet?: number | null;
  @IsOptional() @IsNumber() @ApiPropertyOptional() elevation?: number | null;
}

/** Objects that hang on an Anlageteil (Koord_Nr) — Hindernis, Hochblende, Schützenhaus, Massnahmen. */
export class ImportPlantPartObjectDto {
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'Koord_Nr des Anlageteils' }) coordinationSectionNo?: string;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'Geometrie (WKT)' }) geometry?: string | null;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional() remark?: string | null;
  @IsOptional() @IsString() @MaxLength(80) @ApiPropertyOptional({ description: 'Typ / Massnahmentyp (Codeliste)' }) measureType?: string;
  @IsOptional() @IsString() @MaxLength(40) @ApiPropertyOptional({ description: 'Oberflächentyp (Codeliste)' }) surfaceType?: string;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'Hochblende: F3 Höhe Unterkante' }) bottomHeight?: number;
  @IsOptional() @ApiPropertyOptional({ description: 'Weitere Katalogattribute (Schützenhaus G4–G14, Flächenmassnahme P5–P10) als Schlüssel/Wert', type: 'object', additionalProperties: true })
  attributes?: Record<string, number | string | null>;
}

export class ImportSsfMeasureDto {
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'Q1 EGID (→ Gebäude)' }) egid?: string | null;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'Q3 Koord_Nr' }) coordinationSectionNo?: string;
  @IsOptional() @IsString() @MaxLength(60) @ApiPropertyOptional({ description: 'Q4 Massnahmentyp' }) measureType?: string;
}

export class ImportIsophoneDto {
  @IsInt() @ApiProperty({ description: 'L2 Lr' }) lr: number;
  @IsOptional() @IsNumber() @ApiPropertyOptional({ description: 'L3 Höhe' }) height?: number;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'L5 Auflösung' }) resolution?: number | null;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'L6' }) remark?: string | null;
  @IsOptional() @IsString() @ApiPropertyOptional({ description: 'L1 Geometrie (WKT Polyline)' }) geometry?: string | null;
}

export class ImportAffectedAnalysisDto {
  @IsInt() @ApiProperty({ description: 'M1' }) personsPwIgw: number;
  @IsInt() @ApiProperty({ description: 'M2' }) personsIgwAw: number;
  @IsInt() @ApiProperty({ description: 'M3' }) personsAw: number;
  @IsInt() @ApiProperty({ description: 'M4 Jahr' }) year: number;
  @IsOptional() @IsString() @MaxLength(256) @ApiPropertyOptional({ description: 'M6' }) remark?: string | null;
  @IsOptional() @IsString() @MaxLength(20) @ApiPropertyOptional({ description: 'M7 SPM_Nr' }) spmNo?: string;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'M8' }) persons55?: number;
  @IsOptional() @IsInt() @ApiPropertyOptional({ description: 'M9' }) persons60?: number;
}

export class StateImportDto {
  @ValidateNested() @Type(() => ImportCalculationDto) @ApiProperty({ type: ImportCalculationDto })
  calculation: ImportCalculationDto;

  @ValidateNested() @Type(() => ImportStateDto) @ApiProperty({ type: ImportStateDto })
  state: ImportStateDto;

  @IsOptional() @ValidateNested() @Type(() => ImportPropagationDto) @ApiPropertyOptional({ type: ImportPropagationDto })
  propagation?: ImportPropagationDto | null;

  @IsOptional() @ValidateNested() @Type(() => ImportPerimeterDto) @ApiPropertyOptional({ type: ImportPerimeterDto })
  perimeter?: ImportPerimeterDto | null;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ImportPlantPartDto)
  @ApiProperty({ type: ImportPlantPartDto, isArray: true })
  plantParts: ImportPlantPartDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportSourceLineDto)
  @ApiProperty({ type: ImportSourceLineDto, isArray: true })
  sources: ImportSourceLineDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportBuildingDto)
  @ApiPropertyOptional({ type: ImportBuildingDto, isArray: true })
  buildings?: ImportBuildingDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportImmissionPointDto)
  @ApiProperty({ type: ImportImmissionPointDto, isArray: true })
  immissionPoints: ImportImmissionPointDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportWlrDto)
  @ApiProperty({ type: ImportWlrDto, isArray: true })
  wlr: ImportWlrDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportIsophoneDto) @ApiPropertyOptional({ type: ImportIsophoneDto, isArray: true })
  isophones?: ImportIsophoneDto[];

  @IsOptional() @ValidateNested() @Type(() => ImportAffectedAnalysisDto) @ApiPropertyOptional({ type: ImportAffectedAnalysisDto })
  affectedAnalysis?: ImportAffectedAnalysisDto | null;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  obstacles?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  highScreens?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  shootingHouses?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  measuresPoint?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  measuresArea?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportPlantPartObjectDto) @ApiPropertyOptional({ type: ImportPlantPartObjectDto, isArray: true })
  measuresOperational?: ImportPlantPartObjectDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportSsfMeasureDto) @ApiPropertyOptional({ type: ImportSsfMeasureDto, isArray: true })
  measuresSsf?: ImportSsfMeasureDto[];
}

export class ImportCountsDto {
  @ApiProperty() plantParts: number;
  @ApiProperty() sources: number;
  @ApiProperty() buildings: number;
  @ApiProperty() immissionPoints: number;
  @ApiProperty() wlr: number;
  @ApiProperty() otherObjects: number;
}

/** Prüfbericht of an import (B1 5.19). */
export class ImportReportDto {
  @ApiProperty() calculationId: string;
  @ApiProperty() stateId: string;
  @ApiProperty({ description: 'Warnungen, die den Import nicht abbrechen (z. B. Quelle ohne zugeordnete Kombination)', type: [String] })
  warnings: string[];
  @ApiProperty({ type: ImportCountsDto }) counts: ImportCountsDto;
}
