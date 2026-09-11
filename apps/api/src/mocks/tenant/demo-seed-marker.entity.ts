import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Remembers which dataset, in which version and for which year, the demo
 * tenant was last filled with. The seed compares this on boot: a new year
 * or a new dataset version wipes the demo data and writes it again, so the
 * demo always shows this year's Schiessplätze and never last year's.
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('demo_datensatz')
export class DemoSeedMarkerEntity {
  @PrimaryColumn({ type: 'varchar' })
  tenantId!: string;

  /** The dataset's key, "SLIM Demo". */
  @Column({ default: '' })
  datasetKey!: string;

  /** `version` of the dataset as it was when seeded. */
  @Column({ type: 'int', default: 0 })
  version!: number;

  /** The calendar year the dates were rolled to. */
  @Column({ type: 'int', default: 0 })
  year!: number;

  @UpdateDateColumn()
  seededAt!: Date;
}
