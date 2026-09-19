import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppsRolesGuard, GetUserId, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, RulesGuard, TenantGuard } from '@app-galaxy/core-api';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { AreaResultDto, AreaUpdateDto } from '../../area/dto';
import { AreaScoped, TenantIdOnRequestGuard } from '../../area/scope/area-scope.rule';
import { DataAreaService } from '../data-area.service';
import { AreaGeneralDto, AreaQuotaDto, AreaQuotaInputDto, AreaQuotaUpdateDto } from '../dto';

/**
 * Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 / 5.16) of one
 * Schiessplatz. App right 41 `ADMIN_DATA_AREA` (B1 8.1.2: Fachspezialist
 * R/W, every other role R); the «W/R-O» rule scopes the Schiessplatz-
 * Verantwortliche to the assigned areas. Generated client:
 * `AdminDataAreaService.adminDataArea*()`.
 *
 * The quota delete is a POST on purpose: the galaxy `AppsRolesGuard` keeps
 * the DELETE method for `delete`/`root` rights, while B1 5.16 «R/W» of the
 * Fachspezialist includes removing a Kontingent (same pattern as the usages).
 */
@ApiTags('AdminDataArea')
@ApiBearerAuth()
@Controller('admin/data/area/:areaId')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_AREA),
  ReplayGuard,
  TenantIdOnRequestGuard,
  RulesGuard,
)
@AreaScoped()
export class AdminDataAreaController {
  constructor(private readonly service: DataAreaService) {}

  @Get()
  @ApiOperation({ summary: 'Allgemein: Schiessplatz mit Stammdaten, Stellungsräumen und Kontingenten (5.15 / 5.16)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: AreaGeneralDto })
  general(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<AreaGeneralDto> {
    return this.service.general(tenantId, areaId);
  }

  @Patch()
  @ApiOperation({ summary: 'Stammdaten des Schiessplatzes speichern (5.16); Änderungen werden protokolliert' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: AreaResultDto })
  update(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: AreaUpdateDto,
  ): Promise<AreaResultDto> {
    return this.service.updateMasterData(tenantId, areaId, dto, userId);
  }

  @Post('quota')
  @ApiOperation({ summary: 'Kontingent gemäss Plangenehmigung erfassen (5.16)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiCreatedResponse({ type: AreaQuotaDto })
  createQuota(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: AreaQuotaInputDto,
  ): Promise<AreaQuotaDto> {
    return this.service.createQuota(tenantId, areaId, dto, userId);
  }

  @Patch('quota/:id')
  @ApiOperation({ summary: 'Kontingent bearbeiten (5.16)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'id', description: 'Id des Kontingents' })
  @ApiOkResponse({ type: AreaQuotaDto })
  updateQuota(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AreaQuotaUpdateDto,
  ): Promise<AreaQuotaDto> {
    return this.service.updateQuota(tenantId, areaId, id, dto, userId);
  }

  @Post('quota/:id/delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Kontingent löschen (5.16) — POST, damit das Schreibrecht genügt' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'id', description: 'Id des Kontingents' })
  @ApiNoContentResponse()
  deleteQuota(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.deleteQuota(tenantId, areaId, id, userId);
  }
}
