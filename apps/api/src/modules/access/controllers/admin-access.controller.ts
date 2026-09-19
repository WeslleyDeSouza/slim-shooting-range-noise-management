import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUserId, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import { AccessService } from '../access.service';
import { AppAccessDto } from '../dto';

/**
 * `GET admin/access`: the app rights of the signed-in user in the current
 * tenant. No app right of its own — every signed-in member of the tenant
 * may read their own rights. Generated client: `AdminAccessService.adminAccessMine()`.
 */
@ApiTags('AdminAccess')
@ApiBearerAuth()
@Controller('admin/access')
@UseGuards(AuthGuard('jwt'), TenantGuard, ReplayGuard)
export class AdminAccessController {
  constructor(private readonly access: AccessService) {}

  @Get()
  @ApiOperation({ summary: 'App-Rechte des angemeldeten Benutzers im aktuellen Mandanten (B1 8.1.2)' })
  @ApiOkResponse({ type: AppAccessDto, isArray: true })
  mine(@GetTenantId() tenantId: string, @GetUserId() userId: string): Promise<AppAccessDto[]> {
    return this.access.mine(tenantId, userId);
  }
}
