import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppsRolesGuard, GetUserId, ReplayGuard } from '@app-galaxy/auth-api';
import { GetTenantId, TenantGuard } from '@app-galaxy/core-api';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { API_APPS_MAPPING } from '../../../mocks/main.mock-data';
import { LogAction, LoggerService } from '../../../core/logger';
import { DataWeaponsService } from '../data-weapons.service';
import {
  CaliberDto,
  CaliberInputDto,
  CaliberUpdateDto,
  WeaponCategoryDto,
  WeaponCategoryInputDto,
  WeaponCategoryUpdateDto,
  WeaponCombinationDto,
  WeaponCombinationInputDto,
  WeaponCombinationUpdateDto,
  WeaponDto,
  WeaponInputDto,
  WeaponMasterDataDto,
  WeaponUpdateDto,
} from '../dto';

/** Column headers of the XLSX export per content language (ELO pattern). */
const HEADERS: Record<string, Record<string, string>> = {
  de: {
    combinations: 'Waffen-Kaliber', calibers: 'Kaliber', weapons: 'Waffen', categories: 'Waffenkategorien',
    nameDe: 'Bezeichnung DE', nameFr: 'Bezeichnung FR', nameIt: 'Bezeichnung IT', weapon: 'Waffe', caliber: 'Kaliber',
    category: 'Waffenkategorie', sonarms: 'Zuordnung sonARMS', enabled: 'Aktiv', areas: 'Verwendung (Schiessplätze)',
    aln: 'ALN-Nr.', sap: 'SAP-Nr.', unit: 'Einheit', annex7: 'Waffenkategorie Anh. 7 LSV', code: 'Schlüssel', yes: 'Ja', no: 'Nein',
  },
  fr: {
    combinations: 'Armes-calibres', calibers: 'Calibres', weapons: 'Armes', categories: "Catégories d'armes",
    nameDe: 'Désignation DE', nameFr: 'Désignation FR', nameIt: 'Désignation IT', weapon: 'Arme', caliber: 'Calibre',
    category: "Catégorie d'arme", sonarms: 'Attribution sonARMS', enabled: 'Actif', areas: 'Utilisation (places de tir)',
    aln: 'N° ALN', sap: 'N° SAP', unit: 'Unité', annex7: "Catégorie d'arme annexe 7 OPB", code: 'Clé', yes: 'Oui', no: 'Non',
  },
  it: {
    combinations: 'Armi-calibri', calibers: 'Calibri', weapons: 'Armi', categories: 'Categorie di armi',
    nameDe: 'Denominazione DE', nameFr: 'Denominazione FR', nameIt: 'Denominazione IT', weapon: 'Arma', caliber: 'Calibro',
    category: 'Categoria di arma', sonarms: 'Attribuzione sonARMS', enabled: 'Attivo', areas: 'Utilizzo (piazze di tiro)',
    aln: 'N. ALN', sap: 'N. SAP', unit: 'Unità', annex7: 'Categoria di arma allegato 7 OIF', code: 'Chiave', yes: 'Sì', no: 'No',
  },
  en: {
    combinations: 'Weapon-caliber', calibers: 'Calibers', weapons: 'Weapons', categories: 'Weapon categories',
    nameDe: 'Name DE', nameFr: 'Name FR', nameIt: 'Name IT', weapon: 'Weapon', caliber: 'Caliber',
    category: 'Weapon category', sonarms: 'sonARMS mapping', enabled: 'Active', areas: 'Used on (ranges)',
    aln: 'ALN no.', sap: 'SAP no.', unit: 'Unit', annex7: 'Weapon category Annex 7 NAO', code: 'Key', yes: 'Yes', no: 'No',
  },
};

/**
 * Datenverwaltung › Waffen (B1 5.22–5.25): Waffe/Kaliber, Kaliber, Waffe,
 * Waffenkategorie. App right 43 `ADMIN_DATA_WEAPONS` (Fachspezialist R/W
 * incl. delete = `root`, every other role R). Generated client:
 * `AdminDataWeaponsService.adminDataWeapons*()`.
 */
@ApiTags('AdminDataWeapons')
@ApiBearerAuth()
@Controller('admin/data/weapons')
@UseGuards(
  AuthGuard('jwt'),
  TenantGuard,
  AppsRolesGuard(API_APPS_MAPPING.ADMIN_DATA_WEAPONS),
  ReplayGuard,
)
export class AdminDataWeaponsController {
  constructor(
    private readonly service: DataWeaponsService,
    // Global CoreLoggerModule in the app; the HTTP specs boot without it.
    @Optional() private readonly logger?: LoggerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Alle Waffen-Stammdaten des Mandanten: Kategorien, Waffen, Kaliber, Kombinationen (5.22–5.25)' })
  @ApiOkResponse({ type: WeaponMasterDataDto })
  list(@GetTenantId() tenantId: string): Promise<WeaponMasterDataDto> {
    return this.service.list(tenantId);
  }

  /**
   * XLSX with one sheet per list (B1 5.22–5.25 «Schaltfläche zum
   * Exportieren der Liste»). Declared before the `:id` routes so `export` is
   * never read as an id.
   */
  @Get('export')
  @ApiOperation({ summary: 'XLSX-Export der vier Listen (ein Blatt je Liste); wird protokolliert' })
  @ApiQuery({ name: 'lang', required: false, description: 'Sprache der Spaltentitel: de (Standard), fr, it, en' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' }, description: 'XLSX download' })
  async export(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Query('lang') lang: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const t = HEADERS[lang ?? 'de'] ?? HEADERS['de'];
    const data = await this.service.list(tenantId);
    const yn = (v: boolean) => (v ? t['yes'] : t['no']);

    const workbook = new ExcelJS.Workbook();
    const sheet = (title: string, header: string[], rows: unknown[][]) => {
      const ws = workbook.addWorksheet(title);
      ws.addRow(header);
      ws.getRow(1).font = { bold: true };
      for (const r of rows) ws.addRow(r);
      ws.columns.forEach((column) => {
        let width = 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          width = Math.max(width, String(cell.value ?? '').length + 2);
        });
        column.width = Math.min(width, 60);
      });
    };
    sheet(
      t['combinations'],
      [t['nameDe'], t['nameFr'], t['nameIt'], t['weapon'], t['caliber'], t['category'], t['sonarms'], t['enabled'], t['areas']],
      data.combinations.map((k) => [
        k.nameDe, k.nameFr ?? '', k.nameIt ?? '', k.weaponName, k.caliberName, k.categoryName, k.sonarmsId ?? '', yn(k.enabled),
        k.areas.map((a) => `${a.coordinationSectionNo} ${a.name}`).join('; '),
      ]),
    );
    sheet(
      t['calibers'],
      [t['nameDe'], t['nameFr'], t['nameIt'], t['aln'], t['sap'], t['unit'], t['enabled']],
      data.calibers.map((c) => [c.nameDe, c.nameFr ?? '', c.nameIt ?? '', c.alnNo ?? '', c.sapNo ?? '', c.quantityUnit, yn(c.enabled)]),
    );
    sheet(
      t['weapons'],
      [t['nameDe'], t['nameFr'], t['nameIt'], t['category'], t['annex7'], t['enabled']],
      data.weapons.map((w) => [w.nameDe, w.nameFr ?? '', w.nameIt ?? '', w.categoryName, w.annex7Category ?? '', yn(w.enabled)]),
    );
    sheet(
      t['categories'],
      [t['nameDe'], t['nameFr'], t['nameIt'], t['code'], t['enabled']],
      data.categories.map((c) => [c.nameDe, c.nameFr ?? '', c.nameIt ?? '', c.code, yn(c.enabled)]),
    );

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `waffen_stammdaten_${new Date().toISOString().slice(0, 10)}`;
    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'WEAPON',
      action: LogAction.EXPORT,
      refType: 'XLSX_DOWNLOAD',
      data: {
        combinations: data.combinations.length,
        calibers: data.calibers.length,
        weapons: data.weapons.length,
        categories: data.categories.length,
      },
    });
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    response.setHeader('fileName', fileName);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Length', buffer.byteLength);
    response.send(buffer);
  }

  // --- Waffenkategorie (5.25) -------------------------------------------------

  @Post('category')
  @ApiOperation({ summary: 'Waffenkategorie erfassen (5.25)' })
  @ApiCreatedResponse({ type: WeaponCategoryDto })
  @ApiConflictResponse({ description: 'Bezeichnung DE oder Schlüssel bereits vergeben' })
  createCategory(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Body() dto: WeaponCategoryInputDto): Promise<WeaponCategoryDto> {
    return this.service.createCategory(tenantId, dto, userId);
  }

  @Patch('category/:id')
  @ApiOperation({ summary: 'Waffenkategorie bearbeiten (5.25)' })
  @ApiParam({ name: 'id', description: 'Id der Waffenkategorie' })
  @ApiOkResponse({ type: WeaponCategoryDto })
  updateCategory(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WeaponCategoryUpdateDto,
  ): Promise<WeaponCategoryDto> {
    return this.service.updateCategory(tenantId, id, dto, userId);
  }

  @Delete('category/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Waffenkategorie löschen (5.25); 409 «category-in-use» mit Anzahl Waffen, wenn noch zugeordnet' })
  @ApiParam({ name: 'id', description: 'Id der Waffenkategorie' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Noch von Waffen verwendet — stattdessen inaktiv setzen' })
  deleteCategory(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deleteCategory(tenantId, id, userId);
  }

  // --- Waffe (5.24) -------------------------------------------------------------

  @Post('weapon')
  @ApiOperation({ summary: 'Waffe erfassen (5.24)' })
  @ApiCreatedResponse({ type: WeaponDto })
  @ApiConflictResponse({ description: 'Bezeichnung DE bereits vergeben' })
  createWeapon(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Body() dto: WeaponInputDto): Promise<WeaponDto> {
    return this.service.createWeapon(tenantId, dto, userId);
  }

  @Patch('weapon/:id')
  @ApiOperation({ summary: 'Waffe bearbeiten (5.24)' })
  @ApiParam({ name: 'id', description: 'Id der Waffe' })
  @ApiOkResponse({ type: WeaponDto })
  updateWeapon(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WeaponUpdateDto,
  ): Promise<WeaponDto> {
    return this.service.updateWeapon(tenantId, id, dto, userId);
  }

  @Delete('weapon/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Waffe löschen (5.24); 409 «weapon-in-use» mit Anzahl Kombinationen, wenn noch verwendet' })
  @ApiParam({ name: 'id', description: 'Id der Waffe' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Noch in Kombinationen Waffe/Kaliber verwendet — stattdessen inaktiv setzen' })
  deleteWeapon(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deleteWeapon(tenantId, id, userId);
  }

  // --- Kaliber (5.23) -----------------------------------------------------------

  @Post('caliber')
  @ApiOperation({ summary: 'Kaliber erfassen (5.23)' })
  @ApiCreatedResponse({ type: CaliberDto })
  @ApiConflictResponse({ description: 'Bezeichnung DE bereits vergeben' })
  createCaliber(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Body() dto: CaliberInputDto): Promise<CaliberDto> {
    return this.service.createCaliber(tenantId, dto, userId);
  }

  @Patch('caliber/:id')
  @ApiOperation({ summary: 'Kaliber bearbeiten (5.23)' })
  @ApiParam({ name: 'id', description: 'Id des Kalibers' })
  @ApiOkResponse({ type: CaliberDto })
  updateCaliber(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaliberUpdateDto,
  ): Promise<CaliberDto> {
    return this.service.updateCaliber(tenantId, id, dto, userId);
  }

  @Delete('caliber/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Kaliber löschen (5.23); 409 «caliber-in-use» mit Anzahl Kombinationen, wenn noch verwendet' })
  @ApiParam({ name: 'id', description: 'Id des Kalibers' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Noch in Kombinationen Waffe/Kaliber verwendet — stattdessen inaktiv setzen' })
  deleteCaliber(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deleteCaliber(tenantId, id, userId);
  }

  // --- Kombination Waffe/Kaliber (5.22) ----------------------------------------

  @Post('combination')
  @ApiOperation({ summary: 'Kombination Waffe/Kaliber erfassen (5.22)' })
  @ApiCreatedResponse({ type: WeaponCombinationDto })
  @ApiConflictResponse({ description: 'Die Kombination Waffe × Kaliber besteht bereits' })
  createCombination(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Body() dto: WeaponCombinationInputDto): Promise<WeaponCombinationDto> {
    return this.service.createCombination(tenantId, dto, userId);
  }

  @Patch('combination/:id')
  @ApiOperation({ summary: 'Kombination Waffe/Kaliber bearbeiten (5.22), inkl. Zuordnung sonARMS' })
  @ApiParam({ name: 'id', description: 'Id der Kombination' })
  @ApiOkResponse({ type: WeaponCombinationDto })
  updateCombination(
    @GetTenantId() tenantId: string,
    @GetUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WeaponCombinationUpdateDto,
  ): Promise<WeaponCombinationDto> {
    return this.service.updateCombination(tenantId, id, dto, userId);
  }

  @Delete('combination/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Kombination löschen (5.22); 409 «combination-in-use» mit Anzahl Verwendungen (Zuordnungen, Nutzungen, Kontingente, Schusslinien)' })
  @ApiParam({ name: 'id', description: 'Id der Kombination' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Noch verwendet — stattdessen inaktiv setzen' })
  deleteCombination(@GetTenantId() tenantId: string, @GetUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.deleteCombination(tenantId, id, userId);
  }
}
