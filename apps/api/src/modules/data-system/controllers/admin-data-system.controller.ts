import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Optional,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppsRolesGuard, GetUserId, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { LogAction, LoggerService } from '../../../core/logger';
import { AreaStatusService } from '../../calculation/area-status.service';
import { ManualInfoDto, SystemSettingsDto } from '../../settings/dto';
import { MANUAL_MAX_BYTES, SettingsService } from '../../settings/settings.service';
import { SystemSettingsUpdateDto } from '../dto';

/** What the multipart parser hands over for the uploaded file. */
interface UploadedManual {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const THRESHOLD_FIELDS = ['quotaGreenMaxPercent', 'quotaOrangeMaxPercent', 'noiseGreenMaxDb', 'noiseOrangeMaxDb'] as const;

/**
 * Datenverwaltung › Erweiterte Konfiguration (B1 5.28, slm 27): Sperrdatum
 * der Schusszahlenerfassung, Benutzerhandbuch, Schwellenwerte und Farben
 * der Ampeln, Kontaktangaben. App right 45 (`ADMIN_DATA_SYSTEM`) — the
 * Applikationsadministrator. Reading for everyone is `GET admin/settings`.
 * Generated client: `AdminDataSystemService`.
 */
@ApiTags('AdminDataSystem')
@ApiBearerAuth()
@Controller('admin/data/system')
@UseGuards(AuthGuard('jwt'), TenantGuard, AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_SYSTEM), ReplayGuard)
export class AdminDataSystemController {
  constructor(
    private readonly settings: SettingsService,
    private readonly status: AreaStatusService,
    // Global CoreLoggerModule in the app; the HTTP specs boot without it.
    @Optional() private readonly logger?: LoggerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Erweiterte Konfiguration lesen (5.28)' })
  @ApiOkResponse({ type: SystemSettingsDto })
  get(@GetTenantId() tenantId: string): Promise<SystemSettingsDto> {
    return this.settings.get(tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Erweiterte Konfiguration ändern (5.28): Sperrdatum, Schwellenwerte, Farben, Kontakte' })
  @ApiOkResponse({ type: SystemSettingsDto })
  @ApiBadRequestResponse({ description: 'Ungültiger Wert, oder Schwellenwert «orange» unter «grün»' })
  async update(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Body() dto: SystemSettingsUpdateDto): Promise<SystemSettingsDto> {
    const saved = await this.settings.update(tenantId, dto);
    // The lights of the overview are a cache of the calculation: new thresholds apply to every Schiessplatz at once.
    if (THRESHOLD_FIELDS.some((field) => dto[field] !== undefined)) await this.status.refreshAll(tenantId);
    this.logger?.createLog({ tenantId, userId, section: 'SYSTEM_SETTINGS', action: LogAction.UPDATE, refType: 'SETTINGS', data: { fields: Object.keys(dto) } });
    return saved;
  }

  @Post('manual')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MANUAL_MAX_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Benutzerhandbuch (PDF) hochladen; ersetzt das bisherige (5.28)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'PDF-Dokument, höchstens 15 MB' } },
    },
  })
  @ApiCreatedResponse({ type: ManualInfoDto })
  @ApiBadRequestResponse({ description: 'Keine Datei, kein PDF oder grösser als 15 MB' })
  async uploadManual(@GetTenantId() tenantId: string, @GetUserId() userId: string, @UploadedFile() file?: UploadedManual): Promise<ManualInfoDto> {
    if (!file?.buffer) throw new BadRequestException('Es wurde keine Datei übermittelt (Feld «file»).');
    // Browsers send the name as UTF-8, the parser reads it as Latin-1.
    const fileName = Buffer.from(file.originalname ?? '', 'latin1').toString('utf8');
    const saved = await this.settings.saveManual(tenantId, { fileName, content: file.buffer }, userId);
    this.logger?.createLog({ tenantId, userId, section: 'SYSTEM_SETTINGS', action: LogAction.UPDATE, refType: 'MANUAL_UPLOAD', data: { fileName: saved.fileName, size: saved.size } });
    return saved;
  }

  @Delete('manual')
  @HttpCode(204)
  @ApiOperation({ summary: 'Benutzerhandbuch entfernen (5.28)' })
  @ApiNoContentResponse()
  async removeManual(@GetTenantId() tenantId: string, @GetUserId() userId: string): Promise<void> {
    await this.settings.removeManual(tenantId);
    this.logger?.createLog({ tenantId, userId, section: 'SYSTEM_SETTINGS', action: LogAction.DELETE, refType: 'MANUAL', data: {} });
  }
}
