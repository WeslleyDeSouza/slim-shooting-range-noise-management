import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesModule } from '@app-galaxy/core-api';
import { AreaModule } from '../area/area.module';
import { AreaRoomEntity } from '../area/entities';
import { CalculationModule } from '../calculation/calculation.module';
import {
  AreaCalculationEntity,
  AreaWlrEntity,
  CalculationRunEntity,
  ImmissionCalculationEntity,
  ImmissionPointEntity,
  PlantPartEntity,
  SourceDataA7Entity,
  SourceDataA9Entity,
  SourceLineEntity,
} from '../calculation/entities';
import { AreaUsageEntity } from '../usage/entities';
import { UsageModule } from '../usage/usage.module';
import { CalculationFilesService } from './calculation-files.service';
import { AdminDataCalculationsController } from './controllers/admin-data-calculations.controller';
import { DataCalculationsService } from './data-calculations.service';
import DBOptions from './db/data-calculations.database';

/**
 * Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18–5.21). Owns no
 * tables: it manages the Immissionsberechnungen and Zustände of the
 * calculation module (import, pointers, uploads, exports, details) and reads
 * the usages for the Schusszahlen export. Sits above area, usage and
 * calculation so none of them has to know about it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImmissionCalculationEntity,
      AreaCalculationEntity,
      PlantPartEntity,
      SourceLineEntity,
      SourceDataA9Entity,
      SourceDataA7Entity,
      ImmissionPointEntity,
      AreaWlrEntity,
      CalculationRunEntity,
      AreaRoomEntity,
      AreaUsageEntity,
    ]),
    AreaModule,
    UsageModule,
    CalculationModule,
    RulesModule,
  ],
  controllers: [AdminDataCalculationsController],
  providers: [DataCalculationsService, CalculationFilesService],
  exports: [DataCalculationsService, CalculationFilesService],
})
export class DataCalculationsModule {
  static DBOptions = DBOptions;
}
