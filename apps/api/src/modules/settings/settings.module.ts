import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import DBOptions from './db/settings.database';
import { SelectionListValueEntity, SystemSettingsEntity, UserManualEntity } from './entities';
import { SelectionListService } from './selection-list.service';
import { SettingsService } from './settings.service';

/**
 * Erweiterte Konfiguration (B1 5.28, slm 27): the settings every other
 * module reads (`SettingsService`) and `GET admin/settings` for the app.
 * Depends on no feature module; the mask that changes the settings is
 * `modules/data-system`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SystemSettingsEntity, UserManualEntity, SelectionListValueEntity])],
  controllers: [AdminSettingsController],
  providers: [SettingsService, SelectionListService],
  exports: [SettingsService, SelectionListService],
})
export class SettingsModule {
  static DBOptions = DBOptions;
}
