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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import type { Response } from 'express';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { AreaScoped, TenantIdOnRequestGuard } from '../../area/scope/area-scope.rule';
import { ImportReportDto, ImportValidationDto, StatePointerDto } from '../../calculation/dto';
import { DataCalculationsService } from '../data-calculations.service';
import {
  CalculationsOverviewDto,
  DeliveryCreateDto,
  DeliveryDto,
  DeliveryUpdateDto,
  ExportShotsDto,
  ExportStatesDto,
  OperatingDataUploadDto,
  ShotYearsDto,
  StateCreateDto,
  StateDetailsDto,
  StateFileImportDto,
  StateSummaryDto,
  StateUpdateDto,
  UploadResultDto,
  WlrUploadDto,
} from '../dto';

/**
 * Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18 Übersicht, 5.19
 * Import, 5.20 Export, 5.21 Details). App right 42 `ADMIN_DATA_CALCULATIONS`
 * (B1 8.1.2: Fachspezialist R/W; the other roles have no right, the
 * Applikationsadministrator reads), «W/R-O» scope on the Schiessplatz.
 * Generated client: `AdminDataCalculationsService.adminDataCalculations*()`.
 */
@ApiTags('AdminDataCalculations')
@ApiBearerAuth()
@Controller('admin/data/area/:areaId/calculations')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_CALCULATIONS),
  ReplayGuard,
  TenantIdOnRequestGuard,
  RulesGuard,
)
@AreaScoped()
export class AdminDataCalculationsController {
  constructor(private readonly service: DataCalculationsService) {}

  // --- 5.18 Übersicht ------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Immissionsberechnungen des Schiessplatzes mit ihren Zuständen (5.18)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: CalculationsOverviewDto })
  overview(@GetTenantId() tenantId: string, @Param('areaId', ParseUUIDPipe) areaId: string): Promise<CalculationsOverviewDto> {
    return this.service.overview(tenantId, areaId);
  }

  @Post('delivery')
  @ApiOperation({ summary: 'Immissionsberechnung (Lieferung) ohne Datei anlegen, z. B. für einen neuen Berechnungszustand (5.20)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiCreatedResponse({ type: DeliveryDto })
  @ApiConflictResponse({ description: 'Bezeichnung bereits vergeben' })
  createDelivery(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: DeliveryCreateDto,
  ): Promise<DeliveryDto> {
    return this.service.createDelivery(tenantId, areaId, dto, userId);
  }

  @Patch('delivery/:id')
  @ApiOperation({ summary: 'Detailansicht Berechnung speichern: Bezeichnung, Lieferantin, Lieferdatum, Beschreibung, Berechnungsdatei (5.18)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'id', description: 'Id der Immissionsberechnung' })
  @ApiOkResponse({ type: DeliveryDto })
  updateDelivery(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliveryUpdateDto,
  ): Promise<DeliveryDto> {
    return this.service.updateDelivery(tenantId, areaId, id, dto, userId);
  }

  @Delete('delivery/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Immissionsberechnung mit ihren Zuständen löschen (5.18); 409, wenn ein Zustand aktuell / MGDM ist oder Berechnungsläufe trägt' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'id', description: 'Id der Immissionsberechnung' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Zustand ist aktuell gültig / Stand MGDM oder trägt Berechnungsläufe' })
  deleteDelivery(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.deleteDelivery(tenantId, areaId, id, userId);
  }

  @Post('state')
  @ApiOperation({ summary: 'Neuen Berechnungszustand anlegen — leer, mit neuer ZustandID, für den Export (5.20)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiCreatedResponse({ type: StateSummaryDto })
  @ApiConflictResponse({ description: 'Bezeichnung bereits vergeben' })
  createState(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: StateCreateDto,
  ): Promise<StateSummaryDto> {
    return this.service.createState(tenantId, areaId, dto, userId);
  }

  @Patch('state/:stateId')
  @ApiOperation({ summary: 'Zustand bearbeiten: Bezeichnung, Referenzjahr, Baujahr Anlageteile (5.18)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'stateId', description: 'Id des Zustands' })
  @ApiOkResponse({ type: StateSummaryDto })
  updateState(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: StateUpdateDto,
  ): Promise<StateSummaryDto> {
    return this.service.updateState(tenantId, areaId, stateId, dto, userId);
  }

  @Patch('state/:stateId/pointer')
  @ApiOperation({ summary: 'Zustand als «aktueller Zustand» oder «Stand MGDM» festlegen — genau einer je Schiessplatz (5.18)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'stateId', description: 'Id des Zustands' })
  @ApiOkResponse({ type: StateSummaryDto })
  setPointer(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: StatePointerDto,
  ): Promise<StateSummaryDto> {
    return this.service.setPointer(tenantId, areaId, stateId, dto.pointer, userId);
  }

  // --- 5.19 Import ---------------------------------------------------------

  @Post('import/validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Berechnungsdatei validieren, ohne zu importieren (5.19): Befunde, Warnungen, Umfang' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: ImportValidationDto })
  validate(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: StateFileImportDto,
  ): Promise<ImportValidationDto> {
    return this.service.validateImport(tenantId, areaId, dto.state);
  }

  @Post('import')
  @HttpCode(201)
  @ApiOperation({ summary: 'Berechnungsdatei importieren (5.19): Zustand mit Anlageteilen, Quellen, Immissionspunkten, WLR; bricht bei Befunden ab (400 mit Befunden)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiCreatedResponse({ type: ImportReportDto })
  importFile(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: StateFileImportDto,
  ): Promise<ImportReportDto> {
    return this.service.importFile(tenantId, areaId, dto.state, dto.fileName, userId);
  }

  @Post('state/:stateId/wlr')
  @HttpCode(200)
  @ApiOperation({ summary: 'WLR-Datei (day.wlr / eve.wlr) auf einen Zustand laden; ersetzt die Pegel der Zeitgruppe (5.19)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'stateId', description: 'Id des Zustands' })
  @ApiOkResponse({ type: UploadResultDto })
  uploadWlr(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: WlrUploadDto,
  ): Promise<UploadResultDto> {
    return this.service.uploadWlr(tenantId, areaId, stateId, dto, userId);
  }

  @Post('state/:stateId/operating-data')
  @HttpCode(200)
  @ApiOperation({ summary: 'Betriebsdaten Anhang 9 oder 7 auf einen Zustand laden; je QuellenID ersetzt (5.19)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'stateId', description: 'Id des Zustands' })
  @ApiOkResponse({ type: UploadResultDto })
  uploadOperatingData(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: OperatingDataUploadDto,
  ): Promise<UploadResultDto> {
    return this.service.uploadOperatingData(tenantId, areaId, stateId, dto, userId);
  }

  // --- 5.20 Export ---------------------------------------------------------

  @Post('export/states')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export der gewählten Berechnungszustände als JSON-Bundle (Struktur der Berechnungsdatei, wieder importierbar; 5.20 «Export GeoDB»)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' }, description: 'JSON download' })
  async exportStates(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: ExportStatesDto,
    @Res() response: Response,
  ): Promise<void> {
    const bundle = await this.service.exportStates(tenantId, areaId, dto.stateIds, userId);
    const body = Buffer.from(JSON.stringify(bundle, null, 2), 'utf8');
    const fileName = `berechnungszustaende_${bundle.area.coordinationSectionNo}_${bundle.exportedAt.slice(0, 10)}.json`;
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('fileName', fileName);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Length', body.byteLength);
    response.send(body);
  }

  @Get('export/shots')
  @ApiOperation({ summary: 'Kalenderjahre mit Schusszahlen des Schiessplatzes (5.20 «Export Schusszahlen»-Tabelle)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ type: ShotYearsDto })
  shotYears(@GetTenantId() tenantId: string, @Param('areaId', ParseUUIDPipe) areaId: string): Promise<ShotYearsDto> {
    return this.service.shotYears(tenantId, areaId);
  }

  @Post('export/shots')
  @HttpCode(200)
  @ApiOperation({ summary: 'Schusszahlen der gewählten Jahre als CSV (eine Zeile je Nutzungsposition; 5.20)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' }, description: 'CSV download' })
  async exportShots(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: ExportShotsDto,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.service.exportShots(tenantId, areaId, dto.years, userId);
    const body = Buffer.from(csv, 'utf8');
    const fileName = `schusszahlen_${[...dto.years].sort().join('-')}.csv`;
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('fileName', fileName);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Length', body.byteLength);
    response.send(body);
  }

  // --- 5.21 Details --------------------------------------------------------

  @Get('state/:stateId/details')
  @ApiOperation({ summary: 'Berechnungsdetails eines Zustands je Stellungsraum: WLR DAY / NIGHT, Betriebsdaten Anhang 9 und 7 (5.21)' })
  @ApiParam({ name: 'areaId', description: 'Id des Schiessplatzes' })
  @ApiParam({ name: 'stateId', description: 'Id des Zustands' })
  @ApiOkResponse({ type: StateDetailsDto })
  details(
    @GetTenantId() tenantId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
  ): Promise<StateDetailsDto> {
    return this.service.details(tenantId, areaId, stateId);
  }
}
