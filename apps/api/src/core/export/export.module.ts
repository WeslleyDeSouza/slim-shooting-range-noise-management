import { Module } from '@nestjs/common';
import { AdminExportController } from './controllers/admin-export.controller';

/**
 * Export of tables as Excel / CSV (B1 5.5.5, slm 3): one endpoint for every
 * mask, the sheet layout of the ELO exports (`excel-export.ts`). No tables of
 * its own; the logbook entry goes through the global `CoreLoggerModule`.
 */
@Module({
  controllers: [AdminExportController],
})
export class CoreExportModule {}
