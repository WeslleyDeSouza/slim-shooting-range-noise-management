import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { StateObjectEntity } from './state-object.entity';

/**
 * Ausbreitungsberechnung (B1.2 11.4.10 `berechnung`, K4–K14; Abb. 43
 * «dispersion_calculation»): the settings the engineering office computed
 * the state with. One per Zustand (K1–K3 are the Zustand itself). Owns the
 * Gebäude, Immissionspunkte, WLR-Pegel, Isophonen, Betroffenen-Analyse and
 * SSF-Massnahmen of the state. Physical table `ausbreitungsberechnung`.
 */
@Entity('ausbreitungsberechnung')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId'])
@Unique(['tenantId', 'zustandId', 'id'])
export class PropagationEntity extends StateObjectEntity {
  protected self = PropagationEntity;

  @ApiProperty({ description: 'K4 Ausbreitungsmodell, z. B. «sonX»' })
  @DbPlatformColumn({ name: 'ausbreitungsmodell', length: 30, nullable: false, default: '' })
  model: string;

  @ApiProperty({ description: 'K5 Version, z. B. «sonARMS Kernel 4.0.0»' })
  @DbPlatformColumn({ name: 'version', length: 30, nullable: false, default: '' })
  modelVersion: string;

  @ApiProperty({ nullable: true, description: 'K6 Höhenmodell' })
  @DbPlatformColumn({ name: 'hoehenmodell', type: 'varchar', length: 40, nullable: true })
  heightModel: string | null;

  @ApiProperty({ nullable: true, description: 'K7 Gebäudedatensatz' })
  @DbPlatformColumn({ name: 'gebaeudedatensatz', type: 'varchar', length: 40, nullable: true })
  buildingDataset: string | null;

  @ApiProperty({ description: 'K8 Meteosituation berücksichtigt' })
  @DbPlatformColumn({ name: 'meteo_inkl', type: 'boolean', nullable: false, default: false })
  meteoIncluded: boolean;

  @ApiProperty({ nullable: true, description: 'K9 Anzahl Meteosituationen (0–36)' })
  @DbPlatformColumn({ name: 'meteo_anzahl', type: 'int', nullable: true })
  meteoCount: number | null;

  @ApiProperty({ nullable: true, description: 'K10 Verwendete Meteodaten' })
  @DbPlatformColumn({ name: 'meteodaten', type: 'varchar', length: 40, nullable: true })
  meteoData: string | null;

  @ApiProperty({ description: 'K11 Reflexionswirkung berücksichtigt' })
  @DbPlatformColumn({ name: 'inkl_reflexion', type: 'boolean', nullable: false, default: false })
  reflectionIncluded: boolean;

  @ApiProperty({ description: 'K12 Einwirkung Wald berücksichtigt' })
  @DbPlatformColumn({ name: 'inkl_wald', type: 'boolean', nullable: false, default: false })
  forestIncluded: boolean;

  @ApiProperty({ description: 'K13 Datensatz der Primärflächen' })
  @DbPlatformColumn({ name: 'primaerflaechen', length: 40, nullable: false, default: '' })
  primarySurfaces: string;

  @ApiProperty({ nullable: true, description: 'K14 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;
}
