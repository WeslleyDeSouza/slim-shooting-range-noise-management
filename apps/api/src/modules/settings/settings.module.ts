import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import DBOptions from './db/settings.database';
import { SystemSettingsEntity, UserManualEntity } from './entities';
import { SettingsService } from './settings.service';

/**
 * Erweiterte Konfiguration (B1 5.28, slm 27): the settings every other
 * module reads (`SettingsService`) and `GET admin/settings` for the app.
 * Depends on no feature module; the mask that changes the settings is
 * `modules/data-system`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SystemSettingsEntity, UserManualEntity])],
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {
  static DBOptions = DBOptions;
}
