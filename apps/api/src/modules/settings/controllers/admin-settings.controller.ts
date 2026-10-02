import { Controller, Get, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { SelectionListDto, SystemSettingsDto } from '../dto';
import { SelectionListService } from '../selection-list.service';
import { SettingsService } from '../settings.service';

/**
 * `admin/settings`: the Erweiterte Konfiguration as the app shell needs it
 * (Sperrdatum, Ampel thresholds and colours, contacts, Benutzerhandbuch).
 * No app right of its own — every signed-in member of the tenant reads it;
 * changing it is `admin/data/system` (app 45, Applikationsadministrator).
 * Generated client: `AdminSettingsService`.
 */
@ApiTags('AdminSettings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(AuthGuard('jwt'), TenantGuard, ReplayGuard)
export class AdminSettingsController {
  constructor(
    private readonly service: SettingsService,
    private readonly selectionLists: SelectionListService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Erweiterte Konfiguration des Mandanten lesen (B1 5.28, 5.9)' })
  @ApiOkResponse({ type: SystemSettingsDto })
  get(@GetTenantId() tenantId: string): Promise<SystemSettingsDto> {
    return this.service.get(tenantId);
  }

  @Get('lists')
  @ApiOperation({ summary: 'Auswahllisten mit ihren Werten lesen (B1 5.3, slm 1) — für die Auswahlfelder der Masken' })
  @ApiOkResponse({ type: SelectionListDto, isArray: true })
  lists(@GetTenantId() tenantId: string): Promise<SelectionListDto[]> {
    return this.selectionLists.all(tenantId);
  }

  @Get('manual')
  @ApiOperation({ summary: 'Benutzerhandbuch als PDF herunterladen (B1 5.9, slm 53)' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' }, description: 'Das hinterlegte PDF' })
  @ApiNotFoundResponse({ description: 'Es ist kein Benutzerhandbuch hinterlegt' })
  async manual(@GetTenantId() tenantId: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { fileName, content } = await this.service.manualFile(tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="manual.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(content);
  }
}
