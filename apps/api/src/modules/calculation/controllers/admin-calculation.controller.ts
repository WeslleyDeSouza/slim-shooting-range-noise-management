import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { AppsRolesGuard, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, RulesGuard, TenantGuard } from '@app-galaxy/core-api';
import { AreaScoped, TenantIdOnRequestGuard } from '../../area/scope/area-scope.rule';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { AssessmentService } from '../assessment.service';
import { CalculationService } from '../calculation.service';
import {
  AssessmentDto,
  AssessmentQueryDto,
  CalculationDto,
  SimulationBaseDto,
  SimulationResultDto,
  SimulationRunDto,
} from '../dto';
import { SimulationService } from '../simulation.service';

/**
 * Noise assessment of one area: calculation states (5.18), the receiver
 * assessment of 5.12 «Details» and the 5.13 «Simulation». Generated
 * client: `AdminCalculationService.adminCalculation*()`.
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

  @Get('assessment')
  @ApiParam({ name: 'areaId' })
  @ApiQuery({ name: 'calculationId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiOkResponse({ type: AssessmentDto })
  assess(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Query() query: AssessmentQueryDto,
  ): Promise<AssessmentDto> {
    return this.assessment.assess(tenantId, areaId, query);
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
