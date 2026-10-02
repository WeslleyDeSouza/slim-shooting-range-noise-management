import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { QUANTITY_UNIT, QuantityUnit } from '../../area/entities';
import { AreaResultDto } from '../../area/dto';
import { BUILD_YEAR_CLASS, BuildYearClassCode } from '../../calculation/entities';

/** Übergeordneter Stellungsraum of the Schiessplatz (5.15 Stellungsraum-Tabelle). */
export class AreaRoomDto {
  @ApiProperty({ description: 'Id des Stellungsraums (uuid)' })
  id: string;

  @ApiProperty({ nullable: true, type: String, description: 'Koordinationsabschnitts-Nr. des Stellungsraums, z. B. «1104.020.01» — fehlt in Ausnahmefällen (B1 5.15 Hinweis)' })
  coordinationSectionNo: string | null;

  @ApiProperty({ description: 'Bezeichnung des Stellungsraums, z. B. «Stellungsrm B 2»' })
  name: string;

  @ApiProperty({ nullable: true, type: String, description: 'Gruppe (Zielräume / Stellungsräume / NGST …) für die Gliederung der Listen' })
  groupName: string | null;

  @ApiProperty({ description: 'Sortierung innerhalb des Schiessplatzes (0 = zuerst)' })
  sortOrder: number;

  @ApiProperty({ description: 'Aktiv — inaktive (historische) Stellungsräume nehmen keine neuen Nutzungen an, bleiben aber referenzierbar' })
  enabled: boolean;
}

/** Kontingent gemäss Plangenehmigung (5.16): one row per Kombination Waffe/Kaliber. */
export class AreaQuotaDto {
  @ApiProperty({ description: 'Id des Kontingents (uuid)' })
  id: string;

  @ApiProperty({ description: 'Id der Kombination Waffe/Kaliber (übergeordnete Stammdaten, 5.22)' })
  combinationId: string;

  @ApiProperty({ description: 'Bezeichnung der Kombination, z. B. «Stgw 90 · 5.6 mm»' })
  name: string;

  @ApiProperty({ description: 'Bezeichnung der Waffe, z. B. «Stgw 90»' })
  weapon: string;

  @ApiProperty({ description: 'Bezeichnung des Kalibers, z. B. «5.6 mm GP 90»' })
  caliber: string;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge aus dem Kaliber: «shots» (Stück) oder «kg» (Sprengstoff)' })
  quantityUnit: QuantityUnit;

  @ApiProperty({ description: 'Max. Schusszahl pro Jahr gemäss Plangenehmigung — das Soll der Kontingent-Ampel (5.10)' })
  shotsPerYear: number;

  @ApiProperty({ nullable: true, type: String, description: 'Grundlage des Kontingents (Plangenehmigung oder Sanierungsbericht)' })
  basis: string | null;

  @ApiProperty({ description: 'true, wenn die Kombination auf mindestens einem Stellungsraum dieses Schiessplatzes zulässig ist (5.17); false = Kontingent ohne zulässige Erfassung' })
  assigned: boolean;

  @ApiProperty({ description: 'Zeitpunkt der letzten Änderung (ISO 8601)' })
  updatedAt: string;
}

/** A Kombination the quota dialog may pick (every combination of the tenant). */
export class QuotaCombinationOptionDto {
  @ApiProperty({ description: 'Id der Kombination Waffe/Kaliber (uuid)' })
  id: string;

  @ApiProperty({ description: 'Bezeichnung der Kombination, z. B. «Stgw 90 · 5.6 mm»' })
  name: string;

  @ApiProperty({ description: 'Bezeichnung der Waffe' })
  weapon: string;

  @ApiProperty({ description: 'Bezeichnung des Kalibers' })
  caliber: string;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge aus dem Kaliber (Stück / kg)' })
  quantityUnit: QuantityUnit;

  @ApiProperty({ description: 'Aktiv in den Stammdaten — inaktive Kombinationen werden im Dialog nur angezeigt, wenn sie bereits ein Kontingent haben' })
  enabled: boolean;

  @ApiProperty({ description: 'Zulässig auf einem Stellungsraum dieses Schiessplatzes (5.17) — solche Kombinationen stehen im Dialog zuoberst' })
  assigned: boolean;

  @ApiProperty({ description: 'true, wenn für diesen Schiessplatz bereits ein Kontingent dieser Kombination besteht (je Kombination höchstens eines)' })
  hasQuota: boolean;
}

/**
 * Everything the pages «Allgemein › Übersicht» (5.15) and «Allgemein ›
 * Stammdaten» (5.16) of one Schiessplatz show: the area with its
 * Stammdaten, the Baujahr class of the current calculation state (read-only,
 * derived from the Anlageteile), the Stellungsräume, the Kontingente and the
 * combinations the quota dialog may pick.
 */
export class AreaGeneralDto {
  @ApiProperty({ type: AreaResultDto, description: 'Der Schiessplatz mit Kerndaten, Stammdaten (5.16) und Ampeln' })
  area: AreaResultDto;

  @ApiProperty({ enum: BUILD_YEAR_CLASS, nullable: true, type: String, description: 'Baujahr der Anlageteile des aktuell gültigen Zustands (vor / nach 1985 / gemischt, 5.18); null ohne aktuellen Zustand. Nur lesbar — kommt aus dem Berechnungsstand' })
  buildYearClass: BuildYearClassCode | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung des aktuell gültigen Zustands, auf dem das Baujahr beruht' })
  currentStateName: string | null;

  @ApiProperty({ type: AreaRoomDto, isArray: true, description: 'Stellungsräume des Schiessplatzes (5.15), nach Sortierung' })
  rooms: AreaRoomDto[];

  @ApiProperty({ type: AreaQuotaDto, isArray: true, description: 'Kontingente gemäss Plangenehmigung (5.16), nach Bezeichnung der Kombination' })
  quotas: AreaQuotaDto[];

  @ApiProperty({ type: QuotaCombinationOptionDto, isArray: true, description: 'Alle Kombinationen Waffe/Kaliber des Mandanten für den Kontingent-Dialog, mit Kennzeichen «zulässig» und «hat Kontingent»' })
  combinations: QuotaCombinationOptionDto[];
}

/** Stellungsraum of the «Zuordnung Waffen» mask (5.17, left table) with the size of its assignment. */
export class WeaponAssignmentRoomDto extends AreaRoomDto {
  @ApiProperty({ description: 'Anzahl der diesem Stellungsraum zugeordneten Kombinationen Waffe/Kaliber (aktive und inaktive)' })
  assignmentCount: number;
}

/** One zulässige Kombination Waffe/Kaliber of a Stellungsraum (5.17 «Zugeordnete Waffen»). */
export class RoomWeaponAssignmentDto {
  @ApiProperty({ description: 'Id der Zuordnung (uuid)' })
  id: string;

  @ApiProperty({ description: 'Id des Stellungsraums, dem die Kombination zugeordnet ist' })
  roomId: string;

  @ApiProperty({ description: 'Id der Kombination Waffe/Kaliber (übergeordnete Stammdaten, 5.22)' })
  combinationId: string;

  @ApiProperty({ description: 'Waffenname für die Erfassung — in der Regel eine Gruppenbezeichnung, unter der der Schiessplatznutzer die Kombination erfasst, z. B. «Stgw 90 · 5.6 mm»' })
  entryName: string;

  @ApiProperty({ description: 'Bezeichnung der Waffe, z. B. «Stgw 90»' })
  weapon: string;

  @ApiProperty({ description: 'Bezeichnung des Kalibers, z. B. «5.6 mm GP 90»' })
  caliber: string;

  @ApiProperty({ description: 'Code der Waffenkategorie (5.25), z. B. «infantry»' })
  category: string;

  @ApiProperty({ description: 'Bezeichnung der Waffenkategorie, z. B. «Infanteriewaffen»' })
  categoryName: string;

  @ApiProperty({ description: 'Zuordnung aktiv — eine inaktive Zuordnung nimmt keine neuen Nutzungen an, bestehende Nutzungen bleiben erhalten' })
  enabled: boolean;
}

/**
 * Read model of «Datenverwaltung › Schiessplatz › Zuordnung Waffen» (5.17,
 * B1 Abbildung 28): the Stellungsräume of the Schiessplatz and, per room, the
 * zulässigen Kombinationen Waffe/Kaliber. Display only (FAQ 52) — the
 * assignments are maintained by the import and the DB administration.
 */
export class AreaWeaponAssignmentDto {
  @ApiProperty({ type: AreaResultDto, description: 'Der Schiessplatz (Koordinationsabschnitts-Nr. und Bezeichnung für den Titel der Maske)' })
  area: AreaResultDto;

  @ApiProperty({ type: WeaponAssignmentRoomDto, isArray: true, description: 'Stellungsräume des Schiessplatzes, nach Sortierung, mit der Anzahl ihrer Zuordnungen' })
  rooms: WeaponAssignmentRoomDto[];

  @ApiProperty({ type: RoomWeaponAssignmentDto, isArray: true, description: 'Zugeordnete Kombinationen Waffe/Kaliber aller Stellungsräume, nach Waffenname für die Erfassung' })
  assignments: RoomWeaponAssignmentDto[];
}

export class AreaQuotaInputDto {
  @IsUUID()
  @ApiProperty({ description: 'Id der Kombination Waffe/Kaliber (übergeordnete Stammdaten, 5.22); je Schiessplatz höchstens ein Kontingent pro Kombination' })
  combinationId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @ApiProperty({ minimum: 0.001, description: 'Max. Schusszahl pro Jahr; Dezimalzahl mit bis zu 3 Dezimalen bei kg-Kalibern' })
  shotsPerYear: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, description: 'Grundlage des Kontingents; leer = die gültige Plangenehmigung des Schiessplatzes wird übernommen' })
  basis?: string | null;
}

export class AreaQuotaUpdateDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Neue Kombination Waffe/Kaliber; abgelehnt (409), wenn dafür bereits ein Kontingent besteht' })
  combinationId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @ApiPropertyOptional({ minimum: 0.001, description: 'Max. Schusszahl pro Jahr (bis zu 3 Dezimalen)' })
  shotsPerYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, description: 'Grundlage des Kontingents; null löscht den Text' })
  basis?: string | null;
}
