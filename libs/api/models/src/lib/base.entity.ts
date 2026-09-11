import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Common audit columns for every entity. Extend, do not instantiate. */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'datetime' })
  created!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted?: Date | null;
}
