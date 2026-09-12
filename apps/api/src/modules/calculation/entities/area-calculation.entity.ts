import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';
import { ImmissionCalculationEntity } from './immission-calculation.entity';
import { PlantPartEntity } from './plant-part.entity';
import { SourceLineEntity } from './source-line.entity';
import { ImmissionPointEntity } from './immission-point.entity';

/** Baujahr der Anlagenteile (B1 5.18): which LSV limit applies (7.7). */
export const BUILD_YEAR_CLASS = ['before1985', 'after1985', 'mixed'] as const;
export type BuildYearClassCode = (typeof BUILD_YEAR_CLASS)[number];

/**
 * Zustand / Berechnungsstand (B1 5.18, Kap. 10.2 «Stand Anlage/Berechnung
 * (Version/Revision)», FGDB `berechnung` K1–K3): one version of the noise
 * model inside an Immissionsberechnung. It **owns** every hellblau object of
 * the model — Anlageteile, Schusslinien with Quelldaten, Untersuchungs-
 * perimeter, Ausbreitungsberechnung with Gebäude, Immissionspunkten, WLR-
 * Pegeln, Isophonen, Betroffenen-Analyse and Massnahmen — and is fully
 * independent of every other state (slm 43): importing a new state never
 * touches an old one.
 *
 * Exactly one state per Schiessplatz is «aktuell gültig» and exactly one
 * «Stand MGDM» (both may be the same); the service that switches them keeps
 * that invariant in one transaction. Physical table `zustand`.
 */
@Entity('zustand')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'id'])
@Unique(['tenantId', 'areaId', 'name'])
// Exactly one «aktuell gültig» / «Stand MGDM» per Schiessplatz: the marker
// columns hold the areaId while the flag is set and NULL otherwise, so a
// plain unique index enforces it on SQLite, MariaDB and PostgreSQL alike.
@Index('uq_zustand_aktuell', ['tenantId', 'currentKey'], { unique: true })
@Index('uq_zustand_mgdm', ['tenantId', 'mgdmKey'], { unique: true })
export class AreaCalculationEntity extends SlimBaseEntity {
  protected self = AreaCalculationEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schiessplatz_id', type: 'uuid', nullable: false })
  areaId: string;

  /** The Immissionsberechnung (delivery) this state belongs to. */
  @ApiProperty()
  @DbPlatformColumn({ name: 'immissionsberechnung_id', type: 'uuid', nullable: false })
  calculationId: string;

  @ApiProperty({ nullable: true, description: 'K1 ZustandID der FGDB (SPMNr_Laufnr), eindeutig je Lieferung' })
  @DbPlatformColumn({ name: 'zustand_id_fgdb', type: 'varchar', length: 20, nullable: true })
  externalId: string | null;

  @ApiProperty({ description: 'K2 Bezeichnung des Zustands' })
  @DbPlatformColumn({ name: 'bezeichnung', length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'K3 Referenzjahr' })
  @DbPlatformColumn({ name: 'ref_jahr', type: 'int', nullable: false })
  referenceYear: number;

  @ApiProperty({ enum: BUILD_YEAR_CLASS, description: 'Baujahr der Anlagenteile über den ganzen Schiessplatz (5.18); aus den Anlageteilen abgeleitet' })
  @DbPlatformColumn({ name: 'baujahr_klasse', type: 'varchar', length: 12, nullable: false, default: 'mixed' })
  buildYearClass: BuildYearClassCode;

  @ApiProperty({ description: 'Aktuell gültiger Zustand' })
  @DbPlatformColumn({ name: 'aktuell', type: 'boolean', nullable: false, default: false })
  isCurrent: boolean;

  @ApiProperty({ description: 'Stand MGDM' })
  @DbPlatformColumn({ name: 'stand_mgdm', type: 'boolean', nullable: false, default: false })
  isMgdm: boolean;

  /** = areaId while `isCurrent`, else NULL (unique per tenant → one current state per Schiessplatz). */
  @DbPlatformColumn({ name: 'aktuell_schluessel', type: 'uuid', nullable: true })
  currentKey: string | null;

  /** = areaId while `isMgdm`, else NULL (unique per tenant → one MGDM state per Schiessplatz). */
  @DbPlatformColumn({ name: 'mgdm_schluessel', type: 'uuid', nullable: true })
  mgdmKey: string | null;

  @ApiProperty()
  @DbPlatformColumn({ name: 'aktiv', type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  /** Composite with the area: a state can only belong to a delivery of the same Schiessplatz. */
  @ManyToOne(() => ImmissionCalculationEntity, (c) => c.states, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'areaId' },
    { name: 'immissionsberechnung_id', referencedColumnName: 'id' },
  ])
  calculation: ImmissionCalculationEntity;

  @OneToMany(() => PlantPartEntity, (part) => part.state)
  plantParts: PlantPartEntity[];

  @OneToMany(() => SourceLineEntity, (source) => source.state)
  sources: SourceLineEntity[];

  @OneToMany(() => ImmissionPointEntity, (point) => point.state)
  immissionPoints: ImmissionPointEntity[];
}
