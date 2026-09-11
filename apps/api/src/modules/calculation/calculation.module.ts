import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesModule } from '@app-galaxy/core-api';
import { AreaModule } from '../area/area.module';
import { AreaRoomEntity, AreaWeaponEntity } from '../area/entities';
import { UsageModule } from '../usage/usage.module';
import { AssessmentService } from './assessment.service';
import { CalculationService } from './calculation.service';
import { AdminCalculationController } from './controllers/admin-calculation.controller';
import DBOptions from './db/calculation.database';
import { SimulationService } from './simulation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([...DBOptions.entities, AreaRoomEntity, AreaWeaponEntity]),
    AreaModule,
    RulesModule,
    UsageModule,
  ],
  controllers: [AdminCalculationController],
  providers: [CalculationService, AssessmentService, SimulationService],
  exports: [CalculationService, AssessmentService, SimulationService],
})
export class CalculationModule {
  static DBOptions = DBOptions;
}
