import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Optional,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppsRolesGuard, GetUserId, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, RulesGuard, TenantGuard } from '@app-galaxy/core-api';
import { AreaScoped, TenantIdOnRequestGuard } from '../scope/area-scope.rule';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { LogAction, LoggerService } from '../../../core/logger';
import { AreaService } from '../area.service';
import {
  AreaCreateDto,
  AreaResultDto,
  AreaSummaryDto,
  AreaUpdateDto,
  DashboardDto,
} from '../dto';

/**
 * Areas (Schiessplätze) of the signed-in tenant. Guarded like every ELO
 * admin controller: JWT + tenant + app role + replay protection. The
 * generated client exposes this as `AdminAreaService.adminArea*()`.
 */
@ApiTags('AdminArea')
@ApiBearerAuth()
@Controller('admin/area')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA),
  ReplayGuard,
  // «W/R-O»: routes with :id are checked by the area-scope rule; the lists
  // are filtered in the service by the same scope.
  TenantIdOnRequestGuard,
  RulesGuard,
)
@AreaScoped()
export class AdminAreaController {
  constructor(
    private readonly areaService: AreaService,
    // The logbook comes from the global CoreLoggerModule (app.module.ts);
    // service specs build AreaModule without it, so it is optional here.
    @Optional() private readonly logger?: LoggerService,
  ) {}

  @Get()
  @ApiOkResponse({ type: AreaResultDto, isArray: true })
  list(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
  ): Promise<AreaResultDto[]> {
    return this.areaService.list(tenantId, userId);
  }

  @Get('summary')
  @ApiOkResponse({ type: AreaSummaryDto })
  summary(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
  ): Promise<AreaSummaryDto> {
    return this.areaService.summary(tenantId, userId);
  }

  @Get('dashboard')
  @ApiOkResponse({ type: DashboardDto })
  dashboard(@GetTenantId() tenantId: string): Promise<DashboardDto> {
    return this.areaService.dashboard(tenantId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AreaResultDto })
  async get(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('id') id: string,
  ): Promise<AreaResultDto> {
    const area = await this.areaService.get(tenantId, id);
    // Logbuch (slm 56): who opened which Schiessplatz — a READ entry per
    // detail view; the list (GET admin/area) is deliberately not logged.
    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'AREA',
      action: LogAction.READ,
      refType: 'AREA',
      refId: area.id,
      message: area.coordinationSectionNo,
      data: { name: area.name },
    });
    return area;
  }

  @Post()
  @ApiOkResponse({ type: AreaResultDto })
  create(
    @GetTenantId() tenantId: string,
    @Body() dto: AreaCreateDto,
  ): Promise<AreaResultDto> {
    return this.areaService.create(tenantId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AreaResultDto })
  update(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AreaUpdateDto,
  ): Promise<AreaResultDto> {
    return this.areaService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', type: String })
  remove(
    @GetTenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.areaService.remove(tenantId, id);
  }
}
