import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, OneToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { ANNEX7_CATEGORY, Annex7CategoryCode } from '../../area/entities';

/** DECIMAL comes back as a string from MySQL/PostgreSQL drivers. */
const decimal = { to: (v: number) => v, from: (v: string | number | null) => (v == null ? v : Number(v)) };
import { SourceLineEntity } from './source-line.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Militärische Quelldaten (B1.2 11.4.3 `quelldaten_anhang9`, C5–C11): the
 * operating data the model was computed with — shots inside / outside the
 * workday per year. Their ratio between the source lines of one combination
 * is the weight of the distribution (B1 7.5.3). The catalogue declares C5/C6
 * as Ganzzahl; SLIM stores DECIMAL(12,3) so that explosive quantities in kg
 * (B1 6.2) and averaged operating data round-trip without loss — an integer
 * of the FGDB is written back unchanged. Physical table `quelldaten_anhang9`.
 *
 * Mapping B1.4 `OpData_DemoProj_A9` → here: column `Tag` = `shotsInside`,
 * `Abend` = `shotsOutside`, row = one Schusslinie (`sourceLine`).
 */
@Entity('quelldaten_anhang9')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'sourceLineId'])
export class SourceDataA9Entity extends StateObjectEntity {
  protected self = SourceDataA9Entity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schusslinie_id', type: 'uuid', nullable: false })
  sourceLineId: string;

  @ApiProperty({ description: 'C5 A9_M1: Schuss Mo–Fr 07–19 Uhr pro Jahr' })
  @DbPlatformColumn({ name: 'a9_m1', type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: decimal })
  shotsInside: number;

  @ApiProperty({ description: 'C6 A9_M2: Schuss ausserhalb Mo–Fr 07–19 Uhr pro Jahr' })
  @DbPlatformColumn({ name: 'a9_m2', type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: decimal })
  shotsOutside: number;

  @ApiProperty({ description: 'C7 Schätzung (sonst über 3 Jahre gezählt)' })
  @DbPlatformColumn({ name: 'schaetzung', type: 'boolean', nullable: false, default: false })
  estimated: boolean;

  @ApiProperty({ nullable: true, description: 'C8 Erhebungsjahr' })
  @DbPlatformColumn({ name: 'jahr', type: 'int', nullable: true })
  year: number | null;

  @ApiProperty({ nullable: true, description: 'C10 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerk_daten', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ApiProperty({ description: 'C11 Waffenkategorie Plandarstellung (Codeliste)' })
  @DbPlatformColumn({ name: 'waffenkat_plan', length: 60, nullable: false, default: '' })
  planCategory: string;

  @OneToOne(() => SourceLineEntity, (source) => source.dataA9, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'schusslinie_id', referencedColumnName: 'id' },
  ])
  source: SourceLineEntity;
}

/**
 * Zivile Quelldaten (B1.2 11.4.4 `quelldaten_anhang7`, D5–D13): half-days
 * and shots on workdays / Sundays per year of the source line.
 *
 * Mapping to the Anhang-7 calculation (B1 7.5.2, B1.4 `OpData_DemoProj_A7`):
 * a civil source line belongs to exactly one Waffenkategorie a–f — the D2
 * codelist «Waffensystem zivil (gemäss Anhang 7)» *is* the category list, so
 * `category` holds it explicitly (and matches the weapon's `annex7Category`
 * of the combination). B1.4's per-source columns `WKa … WKf` therefore
 * collapse to (`category`, `shotsWork + shotsSunday`); B1.4's plant-wide
 * rows `WerkHalbtage` / `SonnHalbtage` per category are the `halfDaysWork` /
 * `halfDaysSunday` of every source of that category (identical per
 * category in a consistent delivery; the import checks that). The weights of
 * the distribution (7.5.2 step 3) are `shotsWork + shotsSunday` per source.
 * Physical table `quelldaten_anhang7`.
 */
@Entity('quelldaten_anhang7')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'sourceLineId'])
export class SourceDataA7Entity extends StateObjectEntity {
  protected self = SourceDataA7Entity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schusslinie_id', type: 'uuid', nullable: false })
  sourceLineId: string;

  @ApiProperty({ enum: ANNEX7_CATEGORY, description: 'Waffenkategorie nach Anhang 7 LSV (aus D2 Waffensystem zivil)' })
  @DbPlatformColumn({ name: 'waffenkategorie_a7', type: 'varchar', length: 1, nullable: false, default: 'a' })
  category: Annex7CategoryCode;

  @ApiProperty({ description: 'D5 Halbtag_Wo: Schiesshalbtage werktags (Mo–Sa) pro Jahr' })
  @DbPlatformColumn({ name: 'halbtag_wo', type: 'float', nullable: false, default: 0 })
  halfDaysWork: number;

  @ApiProperty({ description: 'D6 Halbtag_So: Schiesshalbtage an Sonn- und Feiertagen pro Jahr' })
  @DbPlatformColumn({ name: 'halbtag_so', type: 'float', nullable: false, default: 0 })
  halfDaysSunday: number;

  @ApiProperty({ description: 'D7 Zahl_Wo: zivile Schusszahl werktags' })
  @DbPlatformColumn({ name: 'zahl_wo', type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: decimal })
  shotsWork: number;

  @ApiProperty({ nullable: true, description: 'D8 Zahl_So: zivile Schusszahl an Sonn- und Feiertagen' })
  @DbPlatformColumn({ name: 'zahl_so', type: 'decimal', precision: 12, scale: 3, nullable: true, transformer: decimal })
  shotsSunday: number | null;

  @ApiProperty({ description: 'D9 Schätzung' })
  @DbPlatformColumn({ name: 'schaetzung', type: 'boolean', nullable: false, default: false })
  estimated: boolean;

  @ApiProperty({ nullable: true, description: 'D10 Erhebungsjahr' })
  @DbPlatformColumn({ name: 'jahr', type: 'int', nullable: true })
  year: number | null;

  @ApiProperty({ nullable: true, description: 'D12 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerk_daten', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ApiProperty({ description: 'D13 Waffenkategorie Plandarstellung (Codeliste)' })
  @DbPlatformColumn({ name: 'waffenkat_plan', length: 60, nullable: false, default: '' })
  planCategory: string;

  @OneToOne(() => SourceLineEntity, (source) => source.dataA7, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'schusslinie_id', referencedColumnName: 'id' },
  ])
  source: SourceLineEntity;
}
