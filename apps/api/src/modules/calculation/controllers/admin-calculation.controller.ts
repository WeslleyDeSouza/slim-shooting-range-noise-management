import {
  Body,
  Controller,
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
import { AppsRolesGuard, GetUser, IAuthUser, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, RulesGuard, TenantGuard } from '@app-galaxy/core-api';
import { AreaScoped, TenantIdOnRequestGuard } from '../../area/scope/area-scope.rule';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { AreaStatusService } from '../area-status.service';
import { AssessmentService } from '../assessment.service';
import { CalculationRunService } from '../calculation-run.service';
import { CalculationService } from '../calculation.service';
import {
  AssessmentDto,
  AssessmentQueryDto,
  CalculationDto,
  CalculationRunDto,
  ImportReportDto,
  SimulationBaseDto,
  SimulationResultDto,
  SimulationRunDto,
  StateImportDto,
  StatePointerDto,
} from '../dto';
import { ImportService } from '../import.service';
import { SimulationService } from '../simulation.service';

/** «Ersteller»: the signed-in user's name, falling back to the e-mail. */
function displayName(user: Partial<IAuthUser> | undefined): string {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return full || user?.email || '';
}

/**
 * Noise assessment of one area: calculation states (5.18) with their
 * import (5.19), the receiver assessment of 5.12 «Details», the 5.13
 * «Simulation» and the stored Berechnungsläufe (5.10). Generated client:
 * `AdminCalculationService.adminCalculation*()`.
 */
@ApiTags('AdminCalculation')
@ApiBearerAuth()
@Controller('admin/area/:areaId/calculation')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA),
  ReplayGuard,
  TenantIdOnRequestGuard,
  RulesGuard,
)
@AreaScoped()
export class AdminCalculationController {
  constructor(
    private readonly calculations: CalculationService,
    private readonly assessment: AssessmentService,
    private readonly simulation: SimulationService,
    private readonly importer: ImportService,
    private readonly runs: CalculationRunService,
    private readonly status: AreaStatusService,
  ) {}

  @Get()
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: CalculationDto, isArray: true })
  async list(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<CalculationDto[]> {
    const all = await this.calculations.list(tenantId, areaId);
    const counts = await this.calculations.sourceCounts(tenantId, all.map((c) => c.id));
    return all.map((c) => this.calculations.toDto(c, counts.get(c.id)));
  }

  /** 5.19: import a Berechnungszustand (parsed FGDB + WLR + Betriebsdaten). Needs the Berechnungen right (B1 8.1.2). */
  @Post('import')
  @UseGuards(AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_CALCULATIONS))
  @HttpCode(201)
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: ImportReportDto })
  async importState(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: StateImportDto,
  ): Promise<ImportReportDto> {
    const report = await this.importer.importState(tenantId, areaId, dto);
    await this.status.refresh(tenantId, areaId);
    return report;
  }

  /** 5.18: make a state the «aktuell gültige» one or the «Stand MGDM». */
  @Patch(':stateId/pointer')
  @UseGuards(AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_CALCULATIONS))
  @ApiParam({ name: 'areaId' })
  @ApiParam({ name: 'stateId' })
  @ApiOkResponse({ type: CalculationDto })
  async setPointer(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: StatePointerDto,
  ): Promise<CalculationDto> {
    const state = await this.calculations.setPointer(tenantId, areaId, stateId, dto.pointer);
    await this.status.refresh(tenantId, areaId);
    const counts = await this.calculations.sourceCounts(tenantId, [state.id]);
    return this.calculations.toDto(state, counts.get(state.id));
  }

  @Get('assessment')
  @ApiParam({ name: 'areaId' })
  @ApiQuery({ name: 'calculationId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'years', required: false, description: 'Representative years, comma separated' })
  @ApiOkResponse({ type: AssessmentDto })
  assess(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Query() query: AssessmentQueryDto,
  ): Promise<AssessmentDto> {
    return this.assessment.assess(tenantId, areaId, query);
  }

  /** 5.10 «Immissionsberechnung durchführen und abspeichern»: store an immutable run. */
  @Post('run')
  @UseGuards(AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA_CALCULATION_RUN))
  @HttpCode(201)
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: CalculationRunDto })
  run(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() query: AssessmentQueryDto,
    @GetUser() user: IAuthUser,
  ): Promise<CalculationRunDto> {
    return this.runs.run(tenantId, areaId, query, displayName(user));
  }

  @Get('run')
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: CalculationRunDto, isArray: true })
  listRuns(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<CalculationRunDto[]> {
    return this.runs.list(tenantId, areaId);
  }

  @Get('run/:runId')
  @ApiParam({ name: 'areaId' })
  @ApiParam({ name: 'runId' })
  @ApiOkResponse({ type: CalculationRunDto })
  getRun(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<CalculationRunDto> {
    return this.runs.get(tenantId, areaId, runId);
  }

  /** Simulation (5.13) needs its own right on top of the area right (B1 8.1.2). */
  @Get('simulation')
  @UseGuards(AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA_SIMULATION))
  @ApiParam({ name: 'areaId' })
  @ApiQuery({ name: 'year', required: false, description: 'Calendar year, default: current' })
  @ApiQuery({ name: 'calculationId', required: false })
  @ApiOkResponse({ type: SimulationBaseDto })
  simulationBase(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Query('year') year?: string,
    @Query('calculationId') calculationId?: string,
  ): Promise<SimulationBaseDto> {
    const y = Number(year) || new Date().getFullYear();
    return this.simulation.base(tenantId, areaId, y, calculationId || undefined);
  }

  @Post('simulation')
  @UseGuards(AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA_SIMULATION))
  @HttpCode(200)
  @ApiParam({ name: 'areaId' })
  @ApiOkResponse({ type: SimulationResultDto })
  simulate(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: SimulationRunDto,
  ): Promise<SimulationResultDto> {
    return this.simulation.run(tenantId, areaId, dto);
  }
}
