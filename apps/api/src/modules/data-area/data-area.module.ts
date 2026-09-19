import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesModule } from '@app-galaxy/core-api';
import { AreaModule } from '../area/area.module';
import {
  AreaQuotaEntity,
  AreaRoomEntity,
  RoomCombinationEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import { CalculationModule } from '../calculation/calculation.module';
import { AreaCalculationEntity } from '../calculation/entities';
import { AdminDataAreaController } from './controllers/admin-data-area.controller';
import { DataAreaService } from './data-area.service';
import DBOptions from './db/data-area.database';

/**
 * Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 / 5.16). Owns no
 * tables of its own — it works on the reference structure of the area
 * module and reads the current Zustand of the calculation module (Baujahr).
 * Sits above both modules so neither has to know about it (no circular import).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AreaRoomEntity,
      AreaQuotaEntity,
      RoomCombinationEntity,
      WeaponCombinationEntity,
      AreaCalculationEntity,
    ]),
    AreaModule,
    CalculationModule,
    RulesModule,
  ],
  controllers: [AdminDataAreaController],
  providers: [DataAreaService],
  exports: [DataAreaService],
})
export class DataAreaModule {
  static DBOptions = DBOptions;
}
