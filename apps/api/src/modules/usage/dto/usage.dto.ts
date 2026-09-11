import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  ANNEX7_CATEGORY,
  Annex7CategoryCode,
  WEAPON_CATEGORY,
  WeaponCategory,
} from '../../area/entities';
import { QUANTITY_UNIT, QuantityUnit, USAGE_SOURCE, USAGE_TYPE, UsageSource, UsageType } from '../entities';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A Stellungsraum as the shots page lists it (left column, with counts). */
export class UsageRoomDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true, type: String }) coordinationSectionNo: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) groupName: string | null;
  @ApiProperty() builtAfter1985: boolean;
  @ApiProperty({ description: 'Usages of the requested year in this room' })
  usageCount: number;
  @ApiProperty({ description: 'Shots of the requested year in this room' })
  shots: number;
}

/** An allowed room × weapon combination (form select, 5.17). */
export class UsageWeaponDto {
  @ApiProperty() id: string;
  @ApiProperty() roomId: string;
  @ApiProperty() weaponName: string;
  @ApiProperty() weapon: string;
  @ApiProperty() caliber: string;
  @ApiProperty({ enum: WEAPON_CATEGORY }) category: WeaponCategory;
  @ApiProperty({ enum: ANNEX7_CATEGORY, nullable: true, type: String })
  annex7Category: Annex7CategoryCode | null;
  @ApiProperty({ nullable: true, type: Number }) quota: number | null;
}

/** One usage row (table + form). */
export class UsageResultDto {
  @ApiProperty() id: string;
  @ApiProperty() areaId: string;
  @ApiProperty() roomId: string;
  @ApiProperty() roomName: string;
  @ApiProperty() weaponId: string;
  @ApiProperty() weaponName: string;
  @ApiProperty({ enum: WEAPON_CATEGORY }) category: WeaponCategory;
  @ApiProperty() unit: string;
  @ApiProperty({ description: 'YYYY-MM-DD' }) date: string;
  @ApiProperty({ description: 'HH:mm' }) timeFrom: string;
  @ApiProperty({ description: 'HH:mm' }) timeTo: string;
  @ApiProperty({ enum: USAGE_TYPE }) usageType: UsageType;
  @ApiProperty({ description: 'Menge (Dezimalzahl, 3 Dezimalen)' }) shots: number;
  @ApiProperty({ enum: QUANTITY_UNIT }) quantityUnit: QuantityUnit;
  @ApiProperty() recordedBy: string;
  @ApiProperty({ enum: USAGE_SOURCE }) source: UsageSource;
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
  @ApiProperty({ type: UsageWeaponDto, isArray: true }) weapons: UsageWeaponDto[];
  @ApiProperty({ type: UsageResultDto, isArray: true }) usages: UsageResultDto[];
}

export class UsageCreateDto {
  @IsUUID()
  @ApiProperty()
  roomId: string;

  @IsUUID()
  @ApiProperty({ description: 'Allowed room × weapon combination' })
  weaponId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  @ApiProperty()
  unit: string;

  @Matches(DATE)
  @ApiProperty({ description: 'YYYY-MM-DD' })
  date: string;

  @Matches(TIME)
  @ApiProperty({ description: 'HH:mm' })
  timeFrom: string;

  @Matches(TIME)
  @ApiProperty({ description: 'HH:mm, after timeFrom' })
  timeTo: string;

  @IsIn(USAGE_TYPE)
  @ApiProperty({ enum: USAGE_TYPE })
  usageType: UsageType;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(999999999.999)
  @ApiProperty({ minimum: 0.001, description: 'Menge als Dezimalzahl: Anzahl Schuss oder kg Sprengstoff (B1 6.2)' })
  shots: number;

  @IsOptional()
  @IsIn(QUANTITY_UNIT)
  @ApiPropertyOptional({ enum: QUANTITY_UNIT, default: 'shots' })
  quantityUnit?: QuantityUnit;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ nullable: true })
  note?: string | null;
}

export class UsageUpdateDto {
  @IsOptional() @IsUUID() @ApiPropertyOptional() roomId?: string;
  @IsOptional() @IsUUID() @ApiPropertyOptional() weaponId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) @ApiPropertyOptional() unit?: string;
  @IsOptional() @Matches(DATE) @ApiPropertyOptional() date?: string;
  @IsOptional() @Matches(TIME) @ApiPropertyOptional() timeFrom?: string;
  @IsOptional() @Matches(TIME) @ApiPropertyOptional() timeTo?: string;
  @IsOptional() @IsIn(USAGE_TYPE) @ApiPropertyOptional({ enum: USAGE_TYPE }) usageType?: UsageType;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @IsPositive() @Max(999999999.999) @ApiPropertyOptional({ minimum: 0.001 }) shots?: number;
  @IsOptional() @IsIn(QUANTITY_UNIT) @ApiPropertyOptional({ enum: QUANTITY_UNIT }) quantityUnit?: QuantityUnit;
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
