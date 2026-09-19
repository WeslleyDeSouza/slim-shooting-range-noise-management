import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AreaEntity,
  AreaQuotaEntity,
  CaliberEntity,
  RoomCombinationEntity,
  WeaponCategoryEntity,
  WeaponCombinationEntity,
  WeaponEntity,
} from '../area/entities';
import { SourceLineEntity } from '../calculation/entities';
import { UsagePositionEntity } from '../usage/entities';
import { AdminDataWeaponsController } from './controllers/admin-data-weapons.controller';
import { DataWeaponsService } from './data-weapons.service';
import DBOptions from './db/data-weapons.database';

/**
 * Datenverwaltung › Waffen (B1 5.22–5.25). The tables belong to the area
 * module (übergeordnete Stammdaten); this module adds the maintenance API
 * with the referential checks against usages, quotas, room assignments and
 * the Schusslinien of the calculation states.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeaponCategoryEntity,
      WeaponEntity,
      CaliberEntity,
      WeaponCombinationEntity,
      RoomCombinationEntity,
      AreaQuotaEntity,
      AreaEntity,
      UsagePositionEntity,
      SourceLineEntity,
    ]),
  ],
  controllers: [AdminDataWeaponsController],
  providers: [DataWeaponsService],
  exports: [DataWeaponsService],
})
export class DataWeaponsModule {
  static DBOptions = DBOptions;
}
