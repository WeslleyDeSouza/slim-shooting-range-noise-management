import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ANNEX7_CATEGORY, Annex7CategoryCode, QUANTITY_UNIT, QuantityUnit } from '../../area/entities';
import { CIVIL_USAGE_KIND, CivilUsageKind, USAGE_SOURCE, USAGE_TYPE, UsageSource, UsageType } from '../entities';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** HH:mm on the quarter hour (B1 6.2.3, 7.4.1). */
const TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** A Stellungsraum as the shots page lists it (left column, with counts). */
export class UsageRoomDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true, type: String }) coordinationSectionNo: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) groupName: string | null;
  @ApiProperty({ description: 'Aktiv (false = historischer Stellungsraum, keine neue Erfassung)' }) enabled: boolean;
  @ApiProperty({ description: 'Usages of the requested year in this room' })
  usageCount: number;
  @ApiProperty({ description: 'Quantity of the requested year in this room (shots; kg counted as units)' })
  shots: number;
}

/** A zulässige Kombination Waffe/Kaliber of a room (form select, 5.17). */
export class UsageCombinationDto {
  @ApiProperty({ description: 'Kombination (übergeordnet)' }) combinationId: string;
  @ApiProperty() roomId: string;
  @ApiProperty({ description: 'Waffenname für die Erfassung' }) entryName: string;
  @ApiProperty() name: string;
  @ApiProperty() weapon: string;
  @ApiProperty() caliber: string;
  @ApiProperty({ description: 'Waffenkategorie (Code)' }) category: string;
  @ApiProperty({ description: 'Waffenkategorie (Bezeichnung)' }) categoryName: string;
  @ApiProperty({ enum: ANNEX7_CATEGORY, nullable: true, type: String })
  annex7Category: Annex7CategoryCode | null;
  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge gemäss Kaliber' }) quantityUnit: QuantityUnit;
  @ApiProperty({ nullable: true, type: Number, description: 'Kontingent gemäss Plangenehmigung, Schuss/Jahr für den Schiessplatz' }) quota: number | null;
  @ApiProperty() enabled: boolean;
}

/** One position of a usage: combination + quantity. */
export class UsagePositionDto {
  @ApiProperty() id: string;
  @ApiProperty() combinationId: string;
  @ApiProperty() name: string;
  @ApiProperty() weapon: string;
  @ApiProperty() caliber: string;
  @ApiProperty({ description: 'Waffenkategorie (Code)' }) category: string;
  @ApiProperty({ description: 'Menge (Dezimalzahl, 3 Dezimalen)' }) quantity: number;
  @ApiProperty({ enum: QUANTITY_UNIT }) quantityUnit: QuantityUnit;
}

/** One usage row (table + form). */
export class UsageResultDto {
  @ApiProperty() id: string;
  @ApiProperty() areaId: string;
  @ApiProperty() roomId: string;
  @ApiProperty() roomName: string;
  @ApiProperty({ description: 'Benutzende Einheit' }) unit: string;
  @ApiProperty({ description: 'YYYY-MM-DD' }) date: string;
  @ApiProperty({ description: 'HH:mm' }) timeFrom: string;
  @ApiProperty({ description: 'HH:mm' }) timeTo: string;
  @ApiProperty({ enum: USAGE_TYPE }) usageType: UsageType;
  @ApiProperty({ enum: CIVIL_USAGE_KIND, nullable: true, type: String }) civilUsageKind: CivilUsageKind | null;
  @ApiProperty({ nullable: true, type: Number }) personCount: number | null;
  @ApiProperty({ type: UsagePositionDto, isArray: true }) positions: UsagePositionDto[];
  @ApiProperty({ description: 'Waffen der Positionen, zusammengefasst («Stgw 90 · 5.6 mm, Pist 75 · 9 mm»)' }) weaponName: string;
  @ApiProperty({ description: 'Waffenkategorie der ersten Position (Filter)' }) category: string;
  @ApiProperty({ description: 'Summe der Mengen (Stück; kg separat in den Positionen)' }) shots: number;
  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Summe: shots, kg oder mixed' }) quantityUnit: QuantityUnit | 'mixed';
  @ApiProperty() recordedBy: string;
  @ApiProperty({ enum: USAGE_SOURCE }) source: UsageSource;
  @ApiProperty({ nullable: true, type: String }) externalId: string | null;
  @ApiProperty({ nullable: true, type: String }) note: string | null;
  @ApiProperty() updatedAt: string;
}

/** KPIs above the table (5.11 mock). */
export class UsageKpiDto {
  @ApiProperty() year: number;
  @ApiProperty({ description: 'Shots of the year' }) totalShots: number;
  @ApiProperty({ description: 'Usages of the year' }) count: number;
  @ApiProperty({ description: 'Civil share of the shots, 0–100' }) civilSharePercent: number;
  @ApiProperty({ nullable: true, type: String, description: 'Last usage date' })
  lastDate: string | null;
  @ApiProperty({ description: 'Years that have usages (for the year select)', type: [Number] })
  years: number[];
}

/** Everything the shots page needs in one round trip. */
export class UsageOverviewDto {
  @ApiProperty({ type: UsageKpiDto }) kpi: UsageKpiDto;
  @ApiProperty({ type: UsageRoomDto, isArray: true }) rooms: UsageRoomDto[];
  @ApiProperty({ type: UsageCombinationDto, isArray: true, description: 'Zulässige Kombinationen je Stellungsraum' }) combinations: UsageCombinationDto[];
  @ApiProperty({ type: UsageResultDto, isArray: true }) usages: UsageResultDto[];
}

export class UsagePositionInputDto {
  @IsUUID()
  @ApiProperty({ description: 'Kombination Waffe/Kaliber (für den Stellungsraum zulässig)' })
  combinationId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(999999999.999)
  @ApiProperty({ minimum: 0.001, description: 'Menge als Dezimalzahl: Anzahl Schuss oder kg Sprengstoff (B1 6.2)' })
  quantity: number;

  @IsOptional()
  @IsIn(QUANTITY_UNIT)
  @ApiPropertyOptional({ enum: QUANTITY_UNIT, description: 'Default: Einheit des Kalibers' })
  quantityUnit?: QuantityUnit;
}

export class UsageCreateDto {
  @IsUUID()
  @ApiProperty()
  roomId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(256)
  @ApiProperty({ description: 'Benutzende Einheit (max. 256 Zeichen, B1 6.1.3)' })
  unit: string;

  @Matches(DATE)
  @ApiProperty({ description: 'YYYY-MM-DD' })
  date: string;

  @Matches(TIME)
  @ApiProperty({ description: 'HH:mm auf die Viertelstunde (00/15/30/45)' })
  timeFrom: string;

  @Matches(TIME)
  @ApiProperty({ description: 'HH:mm auf die Viertelstunde, nach timeFrom' })
  timeTo: string;

  @IsIn(USAGE_TYPE)
  @ApiProperty({ enum: USAGE_TYPE })
  usageType: UsageType;

  @IsOptional()
  @IsIn(CIVIL_USAGE_KIND)
  @ApiPropertyOptional({ enum: CIVIL_USAGE_KIND, nullable: true, description: 'Pflicht bei Kategorie Zivil' })
  civilUsageKind?: CivilUsageKind | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  @ApiPropertyOptional({ nullable: true, description: 'Anzahl Personen' })
  personCount?: number | null;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UsagePositionInputDto)
  @ApiProperty({ type: UsagePositionInputDto, isArray: true, description: 'n × Kombination + Menge' })
  positions: UsagePositionInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @ApiPropertyOptional({ nullable: true, description: 'Externe Identität (ELO), Idempotenz' })
  externalId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ nullable: true })
  note?: string | null;
}

export class UsageUpdateDto {
  @IsOptional() @IsUUID() @ApiPropertyOptional() roomId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(256) @ApiPropertyOptional() unit?: string;
  @IsOptional() @Matches(DATE) @ApiPropertyOptional() date?: string;
  @IsOptional() @Matches(TIME) @ApiPropertyOptional() timeFrom?: string;
  @IsOptional() @Matches(TIME) @ApiPropertyOptional() timeTo?: string;
  @IsOptional() @IsIn(USAGE_TYPE) @ApiPropertyOptional({ enum: USAGE_TYPE }) usageType?: UsageType;
  @IsOptional() @IsIn(CIVIL_USAGE_KIND) @ApiPropertyOptional({ enum: CIVIL_USAGE_KIND, nullable: true }) civilUsageKind?: CivilUsageKind | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000) @ApiPropertyOptional({ nullable: true }) personCount?: number | null;
  @IsOptional() @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => UsagePositionInputDto)
  @ApiPropertyOptional({ type: UsagePositionInputDto, isArray: true, description: 'Replaces every position' })
  positions?: UsagePositionInputDto[];
  @IsOptional() @IsString() @MaxLength(2000) @ApiPropertyOptional({ nullable: true }) note?: string | null;
}

/** Ids for bulk delete / undo. */
export class UsageIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  @ApiProperty({ type: [String] })
  ids: string[];
}

export class UsageMutationResultDto {
  @ApiProperty({ description: 'Ids affected' , type: [String] }) ids: string[];
  @ApiProperty() count: number;
}
