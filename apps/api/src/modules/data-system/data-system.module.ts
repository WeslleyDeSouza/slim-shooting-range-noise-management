import { Module } from '@nestjs/common';
import { CalculationModule } from '../calculation/calculation.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminDataSystemController } from './controllers/admin-data-system.controller';
import DBOptions from './db/data-system.database';

/**
 * Datenverwaltung › Erweiterte Konfiguration (B1 5.28): the mask that
 * changes the settings. Separate from `SettingsModule` because it refreshes
 * the overview lights after a threshold change (`CalculationModule`), which
 * itself reads the settings.
 */
@Module({
  imports: [SettingsModule, CalculationModule],
  controllers: [AdminDataSystemController],
})
export class DataSystemModule {
  static DBOptions = DBOptions;
}
