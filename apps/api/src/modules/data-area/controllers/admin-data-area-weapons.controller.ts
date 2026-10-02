import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppsRolesGuard, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, RulesGuard, TenantGuard } from '@app-galaxy/core-api';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { AreaScoped, TenantIdOnRequestGuard } from '../../area/scope/area-scope.rule';
import { DataAreaService } from '../data-area.service';
import { AreaWeaponAssignmentDto } from '../dto';

/**
 * Datenverwaltung › Schiessplatz › Zuordnung Waffen (B1 5.17, `slm 17`) of
 * one Schiessplatz. App right 48 `ADMIN_DATA_AREA_WEAPONS` (B1 8.1.2 after
 * FAQ 52: read for Fachspezialist, Schiessplatz-Verantwortliche and
 * Applikationsadministrator, none for the Interessent); the «R-O» rule scopes
 * the Schiessplatz-Verantwortliche to the assigned areas.
 *
 * Read only on purpose: FAQ 52 reduced `slm 17` to a display — the
 * assignments are maintained by the import (9.2) and the DB administration,
 * so this controller has no mutation. Generated client:
 * `AdminDataAreaWeaponsService.adminDataAreaWeaponsAssignment()`.
 */
@ApiTags('AdminDataAreaWeapons')
@ApiBearerAuth()
@Controller('admin/data/area/:areaId/weapon-assignment')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_AREA_WEAPONS),
  ReplayGuard,
  TenantIdOnRequestGuard,
  RulesGuard,
)
@AreaScoped()
export class AdminDataAreaWeaponsController {
  constructor(private readonly service: DataAreaService) {}

  @Get()
  @ApiOperation({ summary: 'Zuordnung Waffen: Stellungsräume des Schiessplatzes mit ihren zulässigen Kombinationen Waffe/Kaliber (5.17, nur Anzeige)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: AreaWeaponAssignmentDto })
  assignment(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<AreaWeaponAssignmentDto> {
    return this.service.weaponAssignment(tenantId, areaId);
  }
}
