import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { AdminAccessController } from './controllers/admin-access.controller';
import DBOptions from './db/access.database';

/** App rights of the signed-in user (`GET admin/access`), read from the galaxy tables. */
@Module({
  controllers: [AdminAccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {
  static DBOptions = DBOptions;
}
