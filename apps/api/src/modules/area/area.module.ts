import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaService } from './area.service';
import { AdminAreaController } from './controllers/admin-area.controller';
import DBOptions from './db/area.database';

@Module({
  imports: [TypeOrmModule.forFeature(DBOptions.entities)],
  controllers: [AdminAreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {
  static DBOptions = DBOptions;
}
