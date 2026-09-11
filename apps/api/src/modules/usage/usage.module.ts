import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaModule } from '../area/area.module';
import { AreaRoomEntity, AreaWeaponEntity } from '../area/entities';
import { AdminUsageController } from './controllers/admin-usage.controller';
import DBOptions from './db/usage.database';
import { UsageService } from './usage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([...DBOptions.entities, AreaRoomEntity, AreaWeaponEntity]),
    AreaModule,
  ],
  controllers: [AdminUsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {
  static DBOptions = DBOptions;
}
