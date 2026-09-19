import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ANNEX7_CATEGORY,
  Annex7CategoryCode,
  QUANTITY_UNIT,
  QuantityUnit,
} from '../../area/entities';

// ---------------------------------------------------------------------------
// Read models (B1 5.22–5.25, Abbildungen 36–39)
// ---------------------------------------------------------------------------

/** Waffenkategorie (5.25): grouping of the weapons for the entry form and the reports. */
export class WeaponCategoryDto {
  @ApiProperty({ description: 'Id der Waffenkategorie (uuid)' })
  id: string;

  @ApiProperty({ description: 'Stabiler Schlüssel, z. B. «handguns»; wird beim Erfassen aus der Bezeichnung DE abgeleitet, wenn nicht angegeben' })
  code: string;

  @ApiProperty({ description: 'Bezeichnung DE (Pflicht)' })
  nameDe: string;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung FR' })
  nameFr: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung IT' })
  nameIt: string | null;

  @ApiProperty({ description: 'Reihenfolge in Listen (0 = zuerst)' })
  sortOrder: number;

  @ApiProperty({ description: 'Aktiv — inaktive Kategorien bleiben für bestehende Waffen referenzierbar, erscheinen aber nicht mehr zur Auswahl' })
  enabled: boolean;

  @ApiProperty({ description: 'Anzahl Waffen, die dieser Kategorie zugeordnet sind (Verwendung; > 0 verhindert das Löschen)' })
  weaponCount: number;

  @ApiProperty({ description: 'Erfassung (ISO 8601)' })
  createdAt: string;

  @ApiProperty({ description: 'Letzte Änderung (ISO 8601)' })
  updatedAt: string;
}

/** Waffe / Waffensystem (5.24). */
export class WeaponDto {
  @ApiProperty({ description: 'Id der Waffe (uuid)' })
  id: string;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «Stgw 90» (Pflicht, je Mandant eindeutig)' })
  nameDe: string;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung FR' })
  nameFr: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung IT' })
  nameIt: string | null;

  @ApiProperty({ description: 'Id der Waffenkategorie (Gruppierung, 5.25)' })
  categoryId: string;

  @ApiProperty({ description: 'Bezeichnung DE der Waffenkategorie' })
  categoryName: string;

  @ApiProperty({ enum: ANNEX7_CATEGORY, nullable: true, type: String, description: 'Waffenkategorie nach Anhang 7 LSV (a–f); null = keine Zuordnung möglich, Nutzungen dieser Waffe werden bei Anhang 7 nicht berücksichtigt (B1 5.24)' })
  annex7Category: Annex7CategoryCode | null;

  @ApiProperty({ description: 'Aktiv — inaktive Waffen bleiben für alte Nutzungen referenzierbar' })
  enabled: boolean;

  @ApiProperty({ description: 'Anzahl Kombinationen Waffe/Kaliber mit dieser Waffe (Verwendung; > 0 verhindert das Löschen)' })
  combinationCount: number;

  @ApiProperty({ description: 'Erfassung (ISO 8601)' })
  createdAt: string;

  @ApiProperty({ description: 'Letzte Änderung (ISO 8601)' })
  updatedAt: string;
}

/** Kaliber / Munitionstyp (5.23). */
export class CaliberDto {
  @ApiProperty({ description: 'Id des Kalibers (uuid)' })
  id: string;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «5.6 mm GP 90» (Pflicht, je Mandant eindeutig)' })
  nameDe: string;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung FR' })
  nameFr: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung IT' })
  nameIt: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'ALN-Nr. (Armee-Logistik-Nummer)' })
  alnNo: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'SAP-Nr.' })
  sapNo: string | null;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge bei der Erfassung: «shots» (Stück) oder «kg» (Sprengstoff, B1 11.2.3)' })
  quantityUnit: QuantityUnit;

  @ApiProperty({ description: 'Aktiv — inaktive Kaliber bleiben für alte Nutzungen referenzierbar' })
  enabled: boolean;

  @ApiProperty({ description: 'Anzahl Kombinationen Waffe/Kaliber mit diesem Kaliber (Verwendung; > 0 verhindert das Löschen)' })
  combinationCount: number;

  @ApiProperty({ description: 'Erfassung (ISO 8601)' })
  createdAt: string;

  @ApiProperty({ description: 'Letzte Änderung (ISO 8601)' })
  updatedAt: string;
}

/** A Schiessplatz on which a combination is allowed (5.22 «Verwendung»). */
export class CombinationAreaDto {
  @ApiProperty({ description: 'Id des Schiessplatzes (uuid)' })
  id: string;

  @ApiProperty({ description: 'Koordinationsabschnitts-Nr. des Schiessplatzes, z. B. «1104.020»' })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'Bezeichnung des Schiessplatzes' })
  name: string;
}

/** Kombination Waffe/Kaliber (5.22) with its mapping to the sonARMS weapon list. */
export class WeaponCombinationDto {
  @ApiProperty({ description: 'Id der Kombination (uuid)' })
  id: string;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «Stgw 90 · 5.6 mm» (Pflicht)' })
  nameDe: string;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung FR' })
  nameFr: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung IT' })
  nameIt: string | null;

  @ApiProperty({ description: 'Id der Waffe (5.24)' })
  weaponId: string;

  @ApiProperty({ description: 'Bezeichnung DE der Waffe' })
  weaponName: string;

  @ApiProperty({ description: 'Id des Kalibers (5.23)' })
  caliberId: string;

  @ApiProperty({ description: 'Bezeichnung DE des Kalibers' })
  caliberName: string;

  @ApiProperty({ description: 'Id der Waffenkategorie — ergibt sich aus der Waffe' })
  categoryId: string;

  @ApiProperty({ description: 'Bezeichnung DE der Waffenkategorie (aus der Waffe)' })
  categoryName: string;

  @ApiProperty({ nullable: true, type: String, description: 'Zuordnung sonARMS: «Name» der Waffendatenbank (B1.7); der Import verknüpft die Schusslinien eines Zustands darüber. Ohne Zuordnung fehlen der Berechnung WLR- und Betriebsdaten (B1 5.22, Kap. 7)' })
  sonarmsId: string | null;

  @ApiProperty({ description: 'Aktiv — inaktive Kombinationen können nicht mehr neu erfasst werden, bleiben aber in alten Nutzungen' })
  enabled: boolean;

  @ApiProperty({ type: CombinationAreaDto, isArray: true, description: 'Verwendung: Schiessplätze, auf deren Stellungsräumen die Kombination zulässig ist (5.17)' })
  areas: CombinationAreaDto[];

  @ApiProperty({ description: 'Anzahl Nutzungspositionen, die die Kombination referenzieren' })
  usageCount: number;

  @ApiProperty({ description: 'Anzahl Kontingente (5.16), die die Kombination referenzieren' })
  quotaCount: number;

  @ApiProperty({ description: 'Anzahl Schusslinien in Berechnungsständen, die über die sonARMS-Zuordnung verknüpft sind' })
  sourceCount: number;

  @ApiProperty({ description: 'Summe der Verwendungen (Zuordnungen, Nutzungen, Kontingente, Schusslinien); > 0 verhindert das Löschen' })
  inUse: number;

  @ApiProperty({ description: 'Erfassung (ISO 8601)' })
  createdAt: string;

  @ApiProperty({ description: 'Letzte Änderung (ISO 8601)' })
  updatedAt: string;
}

/** The four lists of Datenverwaltung › Waffen in one answer (5.22–5.25). */
export class WeaponMasterDataDto {
  @ApiProperty({ type: WeaponCategoryDto, isArray: true, description: 'Waffenkategorien (5.25), nach Reihenfolge und Bezeichnung' })
  categories: WeaponCategoryDto[];

  @ApiProperty({ type: WeaponDto, isArray: true, description: 'Waffen (5.24), nach Bezeichnung DE' })
  weapons: WeaponDto[];

  @ApiProperty({ type: CaliberDto, isArray: true, description: 'Kaliber (5.23), nach Bezeichnung DE' })
  calibers: CaliberDto[];

  @ApiProperty({ type: WeaponCombinationDto, isArray: true, description: 'Kombinationen Waffe/Kaliber (5.22), nach Bezeichnung DE' })
  combinations: WeaponCombinationDto[];

  @ApiProperty({ type: String, isArray: true, description: 'Vorschläge für die sonARMS-Zuordnung: Waffensystem-Namen aller importierten Schusslinien des Mandanten plus die bereits vergebenen Zuordnungen' })
  sonarmsOptions: string[];
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Multilingual name shared by every master-data record (DE is the key the code and the seed refer to). */
export class MultilingualNameDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  @ApiProperty({ description: 'Bezeichnung DE (Pflicht, je Mandant eindeutig)' })
  nameDe: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, description: 'Bezeichnung FR' })
  nameFr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, description: 'Bezeichnung IT' })
  nameIt?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true, description: 'Aktiv (Standard true)' })
  enabled?: boolean;
}

export class WeaponCategoryInputDto extends MultilingualNameDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{1,40}$/)
  @ApiPropertyOptional({ description: 'Stabiler Schlüssel (Kleinbuchstaben, Ziffern, Unterstrich, max. 40); leer = aus der Bezeichnung DE abgeleitet' })
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ description: 'Reihenfolge in Listen (0 = zuerst); leer = ans Ende' })
  sortOrder?: number;
}

export class WeaponCategoryUpdateDto extends PartialType(WeaponCategoryInputDto) {}

export class WeaponInputDto extends MultilingualNameDto {
  @IsUUID()
  @ApiProperty({ description: 'Id der Waffenkategorie (Gruppierung, 5.25)' })
  categoryId: string;

  @IsOptional()
  @IsIn(ANNEX7_CATEGORY)
  @ApiPropertyOptional({ enum: ANNEX7_CATEGORY, nullable: true, description: 'Waffenkategorie nach Anhang 7 LSV (a–f); null = keine Zuordnung möglich' })
  annex7Category?: Annex7CategoryCode | null;
}

export class WeaponUpdateDto extends PartialType(WeaponInputDto) {}

export class CaliberInputDto extends MultilingualNameDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({ nullable: true, description: 'ALN-Nr.' })
  alnNo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({ nullable: true, description: 'SAP-Nr.' })
  sapNo?: string | null;

  @IsOptional()
  @IsIn(QUANTITY_UNIT)
  @ApiPropertyOptional({ enum: QUANTITY_UNIT, default: 'shots', description: 'Einheit der Menge: «shots» (Stück) oder «kg» (Sprengstoff)' })
  quantityUnit?: QuantityUnit;
}

export class CaliberUpdateDto extends PartialType(CaliberInputDto) {}

export class WeaponCombinationInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ApiPropertyOptional({ description: 'Bezeichnung DE; leer = «<Waffe> · <Kaliber>»' })
  nameDe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ApiPropertyOptional({ nullable: true, description: 'Bezeichnung FR' })
  nameFr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ApiPropertyOptional({ nullable: true, description: 'Bezeichnung IT' })
  nameIt?: string | null;

  @IsUUID()
  @ApiProperty({ description: 'Id der Waffe (5.24)' })
  weaponId: string;

  @IsUUID()
  @ApiProperty({ description: 'Id des Kalibers (5.23); die Kombination Waffe × Kaliber ist je Mandant eindeutig' })
  caliberId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ nullable: true, description: 'Zuordnung sonARMS («Name» der Waffendatenbank, B1.7); null = keine Zuordnung' })
  sonarmsId?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true, description: 'Aktiv (Standard true)' })
  enabled?: boolean;
}

export class WeaponCombinationUpdateDto extends PartialType(WeaponCombinationInputDto) {}
