import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import {
  AppsRolesGuard,
  GetUserId,
  ReplayGuard,
} from '@app-galaxy/auth-api';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { LoggerService } from '../logger.service';
import { API_APPS_MAPPING } from '../../../mocks/apps.mapping';
import { LogAction } from '../dto/log-action.enum';
import { LogFacetsDto, LogResponseDto } from '../dto/log-action.dto';

/** Header labels of the logbook XLSX export, per content language. */
const LOG_EXPORT_HEADERS: Record<string, Record<string, string>> = {
  de: {
    sheet: 'Logbuch',
    createdAt: 'Zeitpunkt',
    action: 'Aktion',
    section: 'Bereich',
    user: 'Benutzer',
    system: 'System',
    ip: 'IP',
    device: 'Gerät',
    refType: 'Referenz-Typ',
    refId: 'Referenz',
    data: 'Daten',
  },
  en: {
    sheet: 'Logbook',
    createdAt: 'Timestamp',
    action: 'Action',
    section: 'Section',
    user: 'User',
    system: 'System',
    ip: 'IP',
    device: 'Device',
    refType: 'Reference type',
    refId: 'Reference',
    data: 'Data',
  },
  fr: {
    sheet: 'Journal',
    createdAt: 'Horodatage',
    action: 'Action',
    section: 'Domaine',
    user: 'Utilisateur',
    system: 'Système',
    ip: 'IP',
    device: 'Appareil',
    refType: 'Type de référence',
    refId: 'Référence',
    data: 'Données',
  },
  it: {
    sheet: 'Registro',
    createdAt: 'Data e ora',
    action: 'Azione',
    section: 'Area',
    user: 'Utente',
    system: 'Sistema',
    ip: 'IP',
    device: 'Dispositivo',
    refType: 'Tipo di riferimento',
    refId: 'Riferimento',
    data: 'Dati',
  },
};

/**
 * Logbook of the tenant (B1 `slm 56`: login logging and its evaluation).
 * Guarded by our own app `ADMIN_LOGS` (apps.mapping.ts) like ELO's — the
 * galaxy admin apps (user/role list) cover the user administration, the
 * logbook is a right of its own (Administrator root, Fachspezialist read).
 * Generated client: `AdminLogsService.adminLog*()`.
 */
@ApiTags('AdminLogs')
@ApiBearerAuth()
@Controller('admin/logs')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_LOGS),
  ReplayGuard,
)
export class AdminLogController {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * XLSX export of the logbook, built server-side with the same filters as
   * `list` (the client-side CSV moved here so exports are logged too). Pages
   * through `queryLogs` (its limit is capped) up to 10'000 rows.
   */
  @Get('export')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'section', required: false, type: String })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    isArray: true,
    description: 'One or more actions',
  })
  @ApiQuery({ name: 'system', required: false, type: Boolean })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'lang', required: false, type: String })
  @ApiOkResponse({
    schema: {
      type: 'string',
      format: 'binary',
    },
    description: 'XLSX download.',
  })
  async export(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Res() response: Response,
    @Query('q') q?: string,
    @Query('section') section?: string,
    @Query('action') action?: string | string[],
    @Query('system') system?: string,
    @Query('userId') filterUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lang') lang?: string,
  ) {
    const t = LOG_EXPORT_HEADERS[lang ?? 'de'] ?? LOG_EXPORT_HEADERS['de'];
    const base = {
      tenantId,
      q,
      section,
      actions: action ? (Array.isArray(action) ? action : [action]) : undefined,
      system: system === 'true',
      userId: filterUserId,
      from,
      to,
      limit: 200,
    };

    const rows: Awaited<
      ReturnType<LoggerService['queryLogs']>
    >['items'] = [];
    const MAX_ROWS = 10_000;
    for (let page = 1; rows.length < MAX_ROWS; page++) {
      const result = await this.loggerService.queryLogs({ ...base, page });
      rows.push(...result.items);
      if (rows.length >= result.total || result.items.length === 0) {
        break;
      }
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(t['sheet']);
    ws.addRow([
      t['createdAt'],
      t['action'],
      t['section'],
      t['user'],
      t['ip'],
      t['device'],
      t['refType'],
      t['refId'],
      t['data'],
    ]);
    ws.getRow(1).font = { bold: true };
    for (const item of rows.slice(0, MAX_ROWS)) {
      const user = item.user
        ? `${item.user.firstName ?? ''} ${item.user.lastName ?? ''}`.trim()
        : t['system'];
      ws.addRow([
        item.createdAt ? new Date(item.createdAt).toISOString() : '',
        item.action ?? '',
        item.section ?? '',
        user,
        item.ip ?? '',
        item.device ?? '',
        item.refType ?? '',
        item.refId ?? '',
        item.data ?? '',
      ]);
    }
    ws.columns.forEach((column) => {
      let width = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, String(cell.value ?? '').length + 2);
      });
      column.width = Math.min(width, 60);
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `logbuch_export_${new Date().toISOString().slice(0, 10)}`;

    await this.loggerService.createLog({
      tenantId,
      userId,
      section: 'LOGS',
      action: LogAction.EXPORT,
      refType: 'XLSX_DOWNLOAD',
      data: { rows: Math.min(rows.length, MAX_ROWS), filters: base },
    });

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}.xlsx"`,
    );
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.send(buffer);
  }

  /** Facets for the redesign logbook: sections, users, action counts. */
  @Get('facets')
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200, type: LogFacetsDto })
  async facets(
    @GetTenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.loggerService.getFacets(tenantId, from, to);
  }

  @Get('list')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'section', required: false, type: String })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    isArray: true,
    description: 'One or more actions',
  })
  @ApiQuery({ name: 'system', required: false, type: Boolean })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'userName', required: false, type: String })
  @ApiQuery({ name: 'refId', required: false, type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'ISO date',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'ISO date',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Success.',
    type: LogResponseDto,
    isArray: false,
  })
  async list(
    @GetTenantId() tenantId: string,
    @Query('q') q?: string,
    @Query('section') section?: string,
    @Query('action') action?: string | string[],
    @Query('system') system?: string,
    @Query('userId') userId?: string,
    @Query('userName') userName?: string,
    @Query('refId') refId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loggerService.queryLogs({
      tenantId,
      q,
      section,
      action: undefined,
      actions: action ? (Array.isArray(action) ? action : [action]) : undefined,
      system: system === 'true',
      userId,
      userName,
      refId,
      from,
      to,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }
}
