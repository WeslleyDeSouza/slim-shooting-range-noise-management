import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  AppsRolesGuard,
  GetUser,
  IAuthUser,
  ReplayGuard,
} from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import {
  UsageCreateDto,
  UsageIdsDto,
  UsageMutationResultDto,
  UsageOverviewDto,
  UsageResultDto,
  UsageUpdateDto,
} from '../dto';
import { UsageService } from '../usage.service';

/** «Erfasser»: the signed-in user's name, falling back to the e-mail. */
function displayName(user: Partial<IAuthUser> | undefined): string {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return full || user?.email || '';
}

/**
 * Schiessplatz-Nutzungen of one area (B1 5.11). Generated client:
 * `AdminUsageService.adminUsage*()`.
 */
@ApiTags('AdminUsage')
@ApiBearerAuth()
@Controller('admin/area/:areaId/usage')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA),
  ReplayGuard,
)
export class AdminUsageController {
  constructor(private readonly usages: UsageService) {}

  @Get('overview')
  @ApiParam({ name: 'areaId' })
  @ApiQuery({ name: 'year', required: false, description: 'Calendar year, default: current' })
  @ApiOkResponse({ type: UsageOverviewDto })
  overview(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Query('year') year?: string,
  ): Promise<UsageOverviewDto> {
    const y = Number(year) || new Date().getFullYear();
    return this.usages.overview(tenantId, areaId, y);
  }

  @Post()
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: UsageResultDto })
  create(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UsageCreateDto,
    @GetUser() user: IAuthUser,
  ): Promise<UsageResultDto> {
    return this.usages.create(tenantId, areaId, {
      ...dto,
      recordedBy: displayName(user),
    });
  }

  @Patch(':id')
  @ApiParam({ name: 'areaId' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: UsageResultDto })
  update(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UsageUpdateDto,
  ): Promise<UsageResultDto> {
    return this.usages.update(tenantId, areaId, id, dto);
  }

  /** Bulk soft delete (single row = one id). */
  @Delete()
  @HttpCode(200)
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: UsageMutationResultDto })
  async remove(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UsageIdsDto,
  ): Promise<UsageMutationResultDto> {
    const ids = await this.usages.remove(tenantId, areaId, dto.ids);
    return { ids, count: ids.length };
  }

  /** Undo of a delete (toast «Rückgängig»). */
  @Post('restore')
  @HttpCode(200)
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: UsageMutationResultDto })
  async restore(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UsageIdsDto,
  ): Promise<UsageMutationResultDto> {
    const ids = await this.usages.restore(tenantId, areaId, dto.ids);
    return { ids, count: ids.length };
  }
}
