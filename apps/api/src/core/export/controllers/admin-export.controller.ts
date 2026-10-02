import { BadRequestException, Body, Controller, HttpCode, Optional, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { GetUser, GetUserId, IAuthUser, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { LogAction, LoggerService } from '../../logger';
import { TableExportDto, TableExportFormat } from '../dto/table-export.dto';
import { tableCsv, tableXlsx } from '../excel-export';

const MIME: Record<TableExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};

/** «Exportiert von»: the signed-in user's name, falling back to the e-mail. */
function displayName(user: Partial<IAuthUser> | undefined): string {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return full || user?.email || '';
}

/**
 * `admin/export/table`: writes a table of a mask as Excel or CSV file
 * (B1 5.5.5, slm 3; ELO pattern: built on the server, logged). The app sends
 * the rows as it shows them — filter and sorting applied, or the selected
 * rows — so the file never holds more than the user already sees; that is
 * why the endpoint has no app right of its own. Generated client:
 * `AdminExportService.adminExportTable()`.
 */
@ApiTags('AdminExport')
@ApiBearerAuth()
@Controller('admin/export')
@UseGuards(AuthGuard('jwt'), TenantGuard, ReplayGuard)
export class AdminExportController {
  constructor(
    // Global CoreLoggerModule in the app; the HTTP specs may boot without it.
    @Optional() private readonly logger?: LoggerService,
  ) {}

  @Post('table')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tabelle einer Maske als Excel- oder CSV-Datei (B1 5.5.5); wird protokolliert' })
  @ApiProduces(MIME.xlsx, MIME.csv)
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' }, description: 'Die Datei (xlsx mit Kopfblock und fixierten Kopfzeilen, oder csv)' })
  @ApiBadRequestResponse({ description: 'Eine Zeile hat mehr Zellen als die Tabelle Spalten' })
  async table(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @GetUser() user: IAuthUser,
    @Body() dto: TableExportDto,
    @Res() response: Response,
  ): Promise<void> {
    if (dto.rows.some((row) => row.length > dto.header.length)) {
      throw new BadRequestException('table-export-row-too-long');
    }
    const buffer =
      dto.format === 'csv'
        ? tableCsv(dto.header, dto.rows)
        : await tableXlsx({
            sheetName: dto.title,
            title: dto.title,
            subtitle: dto.subtitle,
            filters: dto.filters,
            selection: dto.selection,
            header: dto.header,
            rows: dto.rows,
            exportedBy: displayName(user),
            lang: dto.lang,
          });
    const fileName = `${dto.table}_${new Date().toISOString().slice(0, 10)}.${dto.format}`;

    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'TABLE',
      action: LogAction.EXPORT,
      refType: dto.format === 'csv' ? 'CSV_DOWNLOAD' : 'XLSX_DOWNLOAD',
      data: { table: dto.table, rows: dto.rows.length, selection: !!dto.selection, filters: dto.filters ?? [] },
    });

    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('Content-Type', MIME[dto.format]);
    response.setHeader('Content-Length', buffer.byteLength);
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }
}
