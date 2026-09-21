import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ANNEX7_CATEGORY, Annex7CategoryCode } from '../../area/entities';
import { BUILD_YEAR_CLASS, BuildYearClassCode, TIME_GROUP, TimeGroup } from '../../calculation/entities';
import { StateImportDto } from '../../calculation/dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// 5.18 Übersicht: Immissionsberechnungen (Lieferungen) with their Zustände
// ---------------------------------------------------------------------------

/** One Zustand (Berechnungsstand) inside an Immissionsberechnung (B1 5.18 «Zustände»-Tabelle). */
export class StateSummaryDto {
  @ApiProperty({ description: 'Id des Zustands (uuid)' })
  id: string;

  @ApiProperty({ nullable: true, type: String, description: 'K1 ZustandID der FGDB (SPMNr_Laufnr); leer bei einem in SLIM angelegten Zustand bis zum Export' })
  externalId: string | null;

  @ApiProperty({ description: 'K2 Bezeichnung des Zustands' })
  name: string;

  @ApiProperty({ description: 'K3 Referenzjahr' })
  referenceYear: number;

  @ApiProperty({ enum: BUILD_YEAR_CLASS, description: 'Baujahr der Anlageteile über den ganzen Schiessplatz — bestimmt IGW / PW (B1 7.7); je Zustand änderbar (5.18)' })
  buildYearClass: BuildYearClassCode;

  @ApiProperty({ description: 'Aktuell gültiger Zustand des Schiessplatzes (genau einer über alle Berechnungen)' })
  isCurrent: boolean;

  @ApiProperty({ description: 'Stand MGDM: Zustand für den MGDM-Export (genau einer über alle Berechnungen)' })
  isMgdm: boolean;

  @ApiProperty({ description: 'Anzahl Schusslinien (Quellen) des Zustands' })
  sourceCount: number;

  @ApiProperty({ description: 'Anzahl Immissionspunkte des Zustands' })
  pointCount: number;

  @ApiProperty({ description: 'Anzahl WLR-Pegelzeilen des Zustands (beide Zeitgruppen)' })
  wlrCount: number;

  @ApiProperty({ description: 'Anzahl Anlageteile des Zustands' })
  plantPartCount: number;

  @ApiProperty({ description: 'Anzahl gespeicherter Berechnungsläufe auf diesem Zustand (verhindert das Löschen der Lieferung)' })
  runCount: number;

  @ApiProperty({ description: 'true, wenn der Zustand ein Berechnungsmodell hat (Anlageteile / Quellen / Punkte); false = leer angelegt für den Export (5.20)' })
  hasModel: boolean;
}

/** Immissionsberechnung (Lieferung) with its states (B1 5.18 «Berechnungen-Tabelle» + Detailansicht). */
export class DeliveryDto {
  @ApiProperty({ description: 'Id der Immissionsberechnung (uuid)' })
  id: string;

  @ApiProperty({ description: 'Bezeichnung der Immissionsberechnung' })
  name: string;

  @ApiProperty({ description: 'Lieferantin / bearbeitendes Büro' })
  supplier: string;

  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD' })
  deliveredAt: string;

  @ApiProperty({ nullable: true, type: String, description: 'Beschreibung der Lieferung' })
  description: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Name der Berechnungsdatei (FGDB / JSON), wie beim Import hochgeladen' })
  fileName: string | null;

  @ApiProperty({ description: 'Anzahl Zustände der Lieferung' })
  stateCount: number;

  @ApiProperty({ description: 'true, wenn einer der Zustände der aktuell gültige ist (Checkbox «Akt. Zustand» der Tabelle)' })
  hasCurrent: boolean;

  @ApiProperty({ description: 'true, wenn einer der Zustände der Stand MGDM ist (Checkbox «Stand MGDM» der Tabelle)' })
  hasMgdm: boolean;

  @ApiProperty({ type: StateSummaryDto, isArray: true, description: 'Zustände der Lieferung, nach Referenzjahr' })
  states: StateSummaryDto[];

  @ApiProperty({ description: 'Erfassung (ISO 8601)' })
  createdAt: string;

  @ApiProperty({ description: 'Letzte Änderung (ISO 8601)' })
  updatedAt: string;
}

export class CalculationsOverviewDto {
  @ApiProperty({ type: DeliveryDto, isArray: true, description: 'Immissionsberechnungen des Schiessplatzes, nach Lieferdatum' })
  deliveries: DeliveryDto[];

  @ApiProperty({ nullable: true, type: String, description: 'Id des aktuell gültigen Zustands (null = keiner)' })
  currentStateId: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Id des Stands MGDM (null = keiner)' })
  mgdmStateId: string | null;
}

export class DeliveryCreateDto {
  @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiProperty({ description: 'Bezeichnung der Immissionsberechnung (je Schiessplatz eindeutig)' })
  name: string;

  @IsOptional() @IsString() @MaxLength(80)
  @ApiPropertyOptional({ description: 'Lieferantin / bearbeitendes Büro' })
  supplier?: string;

  @Matches(DATE)
  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD' })
  deliveredAt: string;

  @IsOptional() @IsString() @MaxLength(2000)
  @ApiPropertyOptional({ nullable: true, description: 'Beschreibung' })
  description?: string | null;
}

export class DeliveryUpdateDto {
  @IsOptional() @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiPropertyOptional({ description: 'Bezeichnung der Immissionsberechnung' })
  name?: string;

  @IsOptional() @IsString() @MaxLength(80)
  @ApiPropertyOptional({ description: 'Lieferantin' })
  supplier?: string;

  @IsOptional() @Matches(DATE)
  @ApiPropertyOptional({ description: 'Lieferdatum YYYY-MM-DD' })
  deliveredAt?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  @ApiPropertyOptional({ nullable: true, description: 'Beschreibung' })
  description?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  @ApiPropertyOptional({ nullable: true, description: 'Name der Berechnungsdatei' })
  fileName?: string | null;
}

export class StateCreateDto {
  @IsUUID()
  @ApiProperty({ description: 'Immissionsberechnung (Lieferung), in der der Zustand angelegt wird' })
  calculationId: string;

  @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiProperty({ description: 'Bezeichnung des neuen Zustands (je Schiessplatz eindeutig)' })
  name: string;

  @IsInt() @Min(1900)
  @ApiProperty({ description: 'Referenzjahr' })
  referenceYear: number;

  @IsOptional() @IsIn(BUILD_YEAR_CLASS)
  @ApiPropertyOptional({ enum: BUILD_YEAR_CLASS, description: 'Baujahr der Anlageteile; Standard «mixed»' })
  buildYearClass?: BuildYearClassCode;
}

export class StateUpdateDto {
  @IsOptional() @IsNotEmpty() @IsString() @MaxLength(120)
  @ApiPropertyOptional({ description: 'Bezeichnung des Zustands' })
  name?: string;

  @IsOptional() @IsInt() @Min(1900)
  @ApiPropertyOptional({ description: 'Referenzjahr' })
  referenceYear?: number;

  @IsOptional() @IsIn(BUILD_YEAR_CLASS)
  @ApiPropertyOptional({ enum: BUILD_YEAR_CLASS, description: 'Baujahr der Anlageteile über den ganzen Schiessplatz (bestimmt die Grenzwerte, B1 7.7)' })
  buildYearClass?: BuildYearClassCode;
}

// ---------------------------------------------------------------------------
// 5.21 Details: WLR and Betriebsdaten per Stellungsraum
// ---------------------------------------------------------------------------

export class RoomSummaryDto {
  @ApiProperty({ description: 'Id des Stellungsraums (uuid)' })
  id: string;

  @ApiProperty({ nullable: true, type: String, description: 'Koordinationsabschnitts-Nr. des Stellungsraums' })
  coordinationSectionNo: string | null;

  @ApiProperty({ description: 'Bezeichnung des Stellungsraums' })
  name: string;

  @ApiProperty({ description: 'Anlageteile des Zustands, die diesem Stellungsraum zugeordnet sind' })
  plantPartCount: number;

  @ApiProperty({ description: 'Schusslinien (Quellen) des Zustands in diesem Stellungsraum' })
  sourceCount: number;

  @ApiProperty({ description: 'WLR-Pegelzeilen dieses Stellungsraums (beide Zeitgruppen)' })
  wlrCount: number;
}

/** One line of the WLR file (Abbildung 32/33: Empfänger, Gebäude, Quelle, Waffe, Elevation, LAE(MK), LAE(GK), LAE(Det), LAE, LAFmax). */
export class WlrRowDto {
  @ApiProperty({ description: 'Stellungsraum der Quelle (uuid)' })
  roomId: string;

  @ApiProperty({ description: 'Koordinationsabschnittsnummer des Anlageteils der Quelle' })
  plantPartNo: string;

  @ApiProperty({ description: 'Empfänger: Anzeigecode des Immissionspunkts' })
  point: string;

  @ApiProperty({ nullable: true, type: String, description: 'Gebäude: EGID des Immissionspunkts' })
  egid: string | null;

  @ApiProperty({ description: 'Quelle: QuellenID der Schusslinie' })
  sourceId: string;

  @ApiProperty({ description: 'Waffe: Waffensystem der Quelle (sonARMS-Name)' })
  weaponSystem: string;

  @ApiProperty({ enum: TIME_GROUP, description: 'Zeitgruppe: day (WLR DAY) oder eve (WLR NIGHT)' })
  timeGroup: TimeGroup;

  @ApiProperty({ nullable: true, type: Number, description: 'Elevation' })
  elevation: number | null;

  @ApiProperty({ nullable: true, type: Number, description: 'LAE(MK)' })
  laeMk: number | null;

  @ApiProperty({ nullable: true, type: Number, description: 'LAE(GK)' })
  laeGk: number | null;

  @ApiProperty({ nullable: true, type: Number, description: 'LAE(Det)' })
  laeDet: number | null;

  @ApiProperty({ description: 'LAE [dB]' })
  lae: number;

  @ApiProperty({ description: 'LAFmax [dB]' })
  lafmax: number;
}

/** Betriebsdaten Anhang 9 of one source (Abbildung 34). */
export class OperatingA9RowDto {
  @ApiProperty({ description: 'Stellungsraum (uuid)' })
  roomId: string;

  @ApiProperty({ description: 'Koordinationsabschnittsnummer des Anlageteils' })
  plantPartNo: string;

  @ApiProperty({ description: 'QuellenID' })
  sourceId: string;

  @ApiProperty({ description: 'Waffensystem (sonARMS-Name)' })
  weaponSystem: string;

  @ApiProperty({ nullable: true, type: String, description: 'Zugeordnete Kombination Waffe/Kaliber (Bezeichnung DE), null ohne Zuordnung' })
  combinationName: string | null;

  @ApiProperty({ description: 'C5 A9_M1: Schuss Mo–Fr 07–19 Uhr pro Jahr' })
  shotsInside: number;

  @ApiProperty({ description: 'C6 A9_M2: Schuss ausserhalb pro Jahr' })
  shotsOutside: number;

  @ApiProperty({ description: 'C7 Schätzung' })
  estimated: boolean;

  @ApiProperty({ nullable: true, type: Number, description: 'C8 Erhebungsjahr' })
  year: number | null;

  @ApiProperty({ nullable: true, type: String, description: 'C10 Bemerkung' })
  remark: string | null;
}

/** Betriebsdaten Anhang 7 of one source (Abbildung 35). */
export class OperatingA7RowDto {
  @ApiProperty({ description: 'Stellungsraum (uuid)' })
  roomId: string;

  @ApiProperty({ description: 'Koordinationsabschnittsnummer des Anlageteils' })
  plantPartNo: string;

  @ApiProperty({ description: 'QuellenID' })
  sourceId: string;

  @ApiProperty({ description: 'Waffensystem (sonARMS-Name)' })
  weaponSystem: string;

  @ApiProperty({ enum: ANNEX7_CATEGORY, description: 'Waffenkategorie nach Anhang 7 LSV (a–f)' })
  category: Annex7CategoryCode;

  @ApiProperty({ description: 'D5 Halbtag_Wo: Schiesshalbtage werktags pro Jahr' })
  halfDaysWork: number;

  @ApiProperty({ description: 'D6 Halbtag_So: Schiesshalbtage an Sonn- und Feiertagen pro Jahr' })
  halfDaysSunday: number;

  @ApiProperty({ description: 'D7 Zahl_Wo: zivile Schusszahl werktags' })
  shotsWork: number;

  @ApiProperty({ nullable: true, type: Number, description: 'D8 Zahl_So: zivile Schusszahl an Sonn- und Feiertagen' })
  shotsSunday: number | null;

  @ApiProperty({ description: 'D9 Schätzung' })
  estimated: boolean;

  @ApiProperty({ nullable: true, type: Number, description: 'D10 Erhebungsjahr' })
  year: number | null;

  @ApiProperty({ nullable: true, type: String, description: 'D12 Bemerkung' })
  remark: string | null;
}

export class StateDetailsDto {
  @ApiProperty({ type: StateSummaryDto, description: 'Der Zustand, dessen Daten angezeigt werden' })
  state: StateSummaryDto;

  @ApiProperty({ type: RoomSummaryDto, isArray: true, description: 'Stellungsräume des Schiessplatzes mit den Zählern dieses Zustands' })
  rooms: RoomSummaryDto[];

  @ApiProperty({ type: WlrRowDto, isArray: true, description: 'WLR-Pegel (DAY und NIGHT), je Zeile mit dem Stellungsraum ihrer Quelle' })
  wlr: WlrRowDto[];

  @ApiProperty({ type: OperatingA9RowDto, isArray: true, description: 'Betriebsdaten Anhang 9 je Quelle' })
  a9: OperatingA9RowDto[];

  @ApiProperty({ type: OperatingA7RowDto, isArray: true, description: 'Betriebsdaten Anhang 7 je Quelle' })
  a7: OperatingA7RowDto[];
}

// ---------------------------------------------------------------------------
// 5.19 Import: WLR files and Betriebsdaten per state
// ---------------------------------------------------------------------------

export class WlrUploadDto {
  @IsIn(TIME_GROUP)
  @ApiProperty({ enum: TIME_GROUP, description: 'Zeitgruppe der Datei: day (day.wlr) oder eve (eve.wlr / WLR NIGHT)' })
  timeGroup: TimeGroup;

  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Inhalt der WLR-Datei (Text, Tab-/Semikolon-/Komma-getrennt, Kopfzeile mit Empfänger, Quelle, LAE, LAFmax, optional Gebäude, Waffe, Elevation, LAE(MK), LAE(GK), LAE(Det))' })
  text: string;

  @IsOptional() @IsString() @MaxLength(200)
  @ApiPropertyOptional({ description: 'Dateiname, nur für das Protokoll' })
  fileName?: string;
}

export class OperatingDataUploadDto {
  @IsIn([9, 7])
  @ApiProperty({ enum: [9, 7], description: 'Anhang: 9 (BetriebA9: QuellenID, A9_M1, A9_M2, Schätzung, Jahr) oder 7 (QuellenID, Kategorie, Halbtag_Wo, Halbtag_So, Zahl_Wo, Zahl_So, Schätzung, Jahr)' })
  annex: 9 | 7;

  @IsString() @IsNotEmpty()
  @ApiProperty({ description: 'Inhalt der Betriebsdaten-Datei (Text mit Kopfzeile)' })
  text: string;

  @IsOptional() @IsString() @MaxLength(200)
  @ApiPropertyOptional({ description: 'Dateiname, nur für das Protokoll' })
  fileName?: string;
}

export class UploadResultDto {
  @ApiProperty({ description: 'Gelesene Datenzeilen der Datei' })
  rows: number;

  @ApiProperty({ description: 'Zeilen, die einem Zustandsobjekt zugeordnet und gespeichert wurden' })
  applied: number;

  @ApiProperty({ description: 'Beim WLR-Upload: vorher gespeicherte Zeilen der Zeitgruppe, die ersetzt wurden' })
  replaced: number;

  @ApiProperty({ description: 'Zeilen mit unbekannter Quelle / unbekanntem Empfänger (übersprungen)', type: [String] })
  unknown: string[];

  @ApiProperty({ description: 'Strukturfehler der Datei (Zeile: Grund); bei Fehlern wird nichts gespeichert', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'Warnungen (z. B. fehlende Tag-Pegel nach dem Upload)', type: [String] })
  warnings: string[];
}

/** JSON upload of a Berechnungsdatei (5.19): the parsed FGDB as `StateImportDto`, plus the file name for the record. */
export class StateFileImportDto {
  @IsOptional() @IsString() @MaxLength(200)
  @ApiPropertyOptional({ description: 'Name der hochgeladenen Berechnungsdatei' })
  fileName?: string;

  @ValidateNested() @Type(() => StateImportDto)
  @ApiProperty({ type: StateImportDto, description: 'Inhalt der Berechnungsdatei (Lieferung, Zustand, Anlageteile, Quellen, Immissionspunkte, WLR …)' })
  state: StateImportDto;
}

// ---------------------------------------------------------------------------
// 5.20 Export
// ---------------------------------------------------------------------------

export class ExportStatesDto {
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true })
  @ApiProperty({ description: 'Zustände, die exportiert werden (Auswahl der Tabelle)', type: [String] })
  stateIds: string[];
}

export class ShotYearDto {
  @ApiProperty({ description: 'Kalenderjahr' })
  year: number;

  @ApiProperty({ description: 'Anzahl Nutzungen des Jahres' })
  usageCount: number;

  @ApiProperty({ description: 'Summe der Mengen des Jahres (Stück; kg-Mengen mitgezählt)' })
  shots: number;

  @ApiProperty({ description: 'Anzahl Nutzungen, die aus ELO oder einem Import stammen (nicht von Hand erfasst)' })
  importedCount: number;
}

export class ShotYearsDto {
  @ApiProperty({ type: ShotYearDto, isArray: true, description: 'Kalenderjahre mit Schusszahlen, neueste zuerst' })
  years: ShotYearDto[];
}

export class ExportShotsDto {
  @IsArray() @ArrayNotEmpty() @IsInt({ each: true })
  @ApiProperty({ description: 'Kalenderjahre, die exportiert werden', type: [Number] })
  years: number[];
}
