import { forwardRef, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesModule } from '@app-galaxy/core-api';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { AreaModule } from '../area/area.module';
import { AreaEntity, AreaQuotaEntity, AreaRoomEntity, HolidayEntity, RoomCombinationEntity, WeaponCombinationEntity } from '../area/entities';
import { UsageModule } from '../usage/usage.module';
import { AreaStatusService } from './area-status.service';
import { AssessmentService } from './assessment.service';
import { CalculationRunService } from './calculation-run.service';
import { CalculationService } from './calculation.service';
import { AdminCalculationController } from './controllers/admin-calculation.controller';
import DBOptions from './db/calculation.database';
import { ImportService } from './import.service';
import { SimulationService } from './simulation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([...DBOptions.entities, AreaEntity, AreaRoomEntity, RoomCombinationEntity, WeaponCombinationEntity, HolidayEntity, AreaQuotaEntity]),
    AreaModule,
    RulesModule,
    forwardRef(() => UsageModule),
  ],
  controllers: [AdminCalculationController],
  providers: [CalculationService, AssessmentService, SimulationService, ImportService, CalculationRunService, AreaStatusService],
  exports: [CalculationService, AssessmentService, SimulationService, ImportService, CalculationRunService, AreaStatusService],
})
export class CalculationModule implements OnApplicationBootstrap {
  static DBOptions = DBOptions;

  constructor(
    private readonly status: AreaStatusService,
    private readonly dataSource: DataSource,
  ) {}

  /** The cached overview lights follow the data, not a seed: refresh them once the app is up. */
  async onApplicationBootstrap(): Promise<void> {
    await this.refreshStatuses();
  }

  @Cron('0 0 * * *', { timeZone: 'Europe/Zurich' })
  async refreshStatuses(): Promise<void> {

    try {
      const tenants: { tenantId: string }[] = await this.dataSource.query('select distinct tenantId from schiessplatz');
      for (const t of tenants) await this.status.refreshAll(t.tenantId);
    } catch {
      // The schema may not exist yet (first boot with sync); the next change refreshes the lights.
    }
  }
}
