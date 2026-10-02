import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SELECTION_LIST_KEYS } from '../selection-lists.defaults';

/** Metadata of the uploaded Benutzerhandbuch (the file itself: `GET admin/settings/manual`). */
export class ManualInfoDto {
  @ApiProperty({ description: 'Dateiname wie hochgeladen, z. B. «Benutzerhandbuch SLIM.pdf»' })
  fileName: string;

  @ApiProperty({ description: 'Grösse in Bytes' })
  size: number;

  @ApiProperty({ description: 'Zeitpunkt des Uploads (ISO 8601)' })
  uploadedAt: string;
}

/**
 * Erweiterte Konfiguration (B1 5.28) as every signed-in user of the tenant
 * reads it: the app needs the Sperrdatum in the entry form, the thresholds
 * for the legends, the colours for the Ampel and the contacts and the
 * Benutzerhandbuch for the main menu (B1 5.9). Thresholds are always filled
 * (defaults of B1 5.10 when nothing is configured); colours and contacts are
 * null when not set.
 */
export class SystemSettingsDto {
  @ApiProperty({ nullable: true, type: String, description: 'Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD): Nutzungen mit Datum bis und mit diesem Tag können nicht erfasst, geändert oder gelöscht werden; null = keine Sperre' })
  usageLockDate: string | null;

  @ApiProperty({ description: 'Ampel «Einhaltung Kontingent Plangenehmigung»: grün, wenn Ist ≤ … % des Solls (Standard 100)' })
  quotaGreenMaxPercent: number;

  @ApiProperty({ description: 'Ampel «Einhaltung Kontingent Plangenehmigung»: orange, wenn Ist ≤ … % des Solls, darüber rot (Standard 125)' })
  quotaOrangeMaxPercent: number;

  @ApiProperty({ description: 'Ampel «Lärmbelastung» der Empfangspunkte: grün, wenn Beurteilungspegel − Grenzwert ≤ … dB (Standard −5)' })
  noiseGreenMaxDb: number;

  @ApiProperty({ description: 'Ampel «Lärmbelastung» der Empfangspunkte: orange, wenn Beurteilungspegel − Grenzwert ≤ … dB, darüber rot (Standard 0)' })
  noiseOrangeMaxDb: number;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «eingehalten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOk: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «zu prüfen» als #rrggbb; null = Standardfarbe des Designs' })
  colorWarn: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «überschritten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOver: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r (Hauptmenü, B1 5.9): Name oder Stelle' })
  specialistName: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r: Telefonnummer' })
  specialistPhone: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r: E-Mail-Adresse' })
  specialistEmail: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration (Hauptmenü, B1 5.9): Name oder Stelle' })
  sysadminName: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration: Telefonnummer' })
  sysadminPhone: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration: E-Mail-Adresse' })
  sysadminEmail: string | null;

  @ApiProperty({ type: ManualInfoDto, nullable: true, description: 'Hochgeladenes Benutzerhandbuch (PDF); null = keines hinterlegt' })
  manual: ManualInfoDto | null;
}

/** One value of an Auswahlliste (B1 5.3, slm 1). */
export class SelectionListValueDto {
  @ApiProperty({ description: 'Stabiler Schlüssel des Werts; er wird auf den Datensätzen gespeichert, die den Wert verwenden' })
  code: string;

  @ApiProperty({ description: 'Bezeichnung DE' })
  labelDe: string;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung FR; null = die deutsche Bezeichnung wird gezeigt' })
  labelFr: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung IT; null = die deutsche Bezeichnung wird gezeigt' })
  labelIt: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung EN; null = die deutsche Bezeichnung wird gezeigt' })
  labelEn: string | null;

  @ApiProperty({ description: 'Aktiv — inaktive Werte werden nicht mehr zur Auswahl angeboten, bleiben auf bestehenden Datensätzen aber lesbar' })
  enabled: boolean;

  @ApiProperty({ description: 'Reihenfolge in der Auswahl (aufsteigend)' })
  sortOrder: number;

  @ApiProperty({ description: 'Wert, mit dem die Applikation ausgeliefert wird (im Unterschied zu selbst hinzugefügten Werten)' })
  builtIn: boolean;
}

/** An Auswahlliste with its values in the order of the selection. */
export class SelectionListDto {
  @ApiProperty({ enum: SELECTION_LIST_KEYS, description: 'Schlüssel der Auswahlliste' })
  key: string;

  @ApiProperty({ type: SelectionListValueDto, isArray: true, description: 'Werte der Liste, aktive und inaktive' })
  values: SelectionListValueDto[];
}

/** A new value of an Auswahlliste; the code is derived from the German label. */
export class SelectionListValueCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @ApiProperty({ description: 'Bezeichnung DE (Pflicht)' })
  labelDe: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung FR' })
  labelFr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung IT' })
  labelIt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung EN' })
  labelEn?: string | null;
}

/** Changes of a value: labels, active flag, position. Only what is sent changes. */
export class SelectionListValueUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @ApiPropertyOptional({ description: 'Bezeichnung DE' })
  labelDe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung FR; null oder leer = deutsche Bezeichnung' })
  labelFr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung IT; null oder leer = deutsche Bezeichnung' })
  labelIt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bezeichnung EN; null oder leer = deutsche Bezeichnung' })
  labelEn?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Aktiv (false = inaktivieren)' })
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  @ApiPropertyOptional({ description: 'Reihenfolge in der Auswahl' })
  sortOrder?: number;
}
