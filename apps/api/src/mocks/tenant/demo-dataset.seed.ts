import { Logger } from '@nestjs/common';
import { rawQuery } from '@api-slim/common';
import { DataSource } from 'typeorm';
import { UserEntity } from '@app-galaxy/auth-api';
import { TenantUserRoleEntity } from '@app-galaxy/core-api';
import { genSalt } from 'bcryptjs';
import { SLIM_ROLE_BY_KEY } from '../roles.mock-data';
import {
  AreaEntity,
  AreaQuotaEntity,
  AreaRoomEntity,
  AreaUserEntity,
  CaliberEntity,
  HolidayEntity,
  RoomCombinationEntity,
  WeaponCategoryEntity,
  WeaponCombinationEntity,
  WeaponEntity,
} from '../../modules/area/entities';
import { StateImportDto } from '../../modules/calculation/dto/import.dto';
import { ImportService } from '../../modules/calculation/import.service';
import { AreaUsageEntity, UsagePositionEntity } from '../../modules/usage/entities';
import { DemoSeedMarkerEntity } from './demo-seed-marker.entity';
import {
  DEFAULT_DATASET_KEY,
  DatasetArea,
  DatasetMasterData,
  TenantDataset,
  loadDataset,
  withDates,
} from './tenant-dataset';

const log = new Logger('DemoDataset');

/**
 * The demo tenant's own tables, in the order they can be emptied without a
 * foreign key complaining (Zustandsebene first, then Nutzungen, then the
 * permanent references, then master data). Nothing of the login (users,
 * roles, rights) or the galaxy tenant tables is touched.
 */
const WIPE = [
  'berechnungslauf',
  'wlr_pegel',
  'massnahmen_ssf',
  'massnahmen_punkt',
  'massnahmen_flaeche',
  'massnahmen_betrieb',
  'isophonen',
  'betroffene_analyse',
  'hindernis',
  'hochblende',
  'schuetzenhaus',
  'immissionspunkt',
  'gebaeude',
  'quelldaten_anhang9',
  'quelldaten_anhang7',
  'schusslinie',
  'zustand_anlageteil',
  'untersuchungsperimeter',
  'ausbreitungsberechnung',
  'zustand',
  'immissionsberechnung',
  'nutzung_position',
  'nutzung',
  'kontingent',
  'stellungsraum_kombination',
  'feiertag',
  'schiessplatz_benutzer',
  'stellungsraum',
  'schiessplatz',
  'waffe_kaliber_kombination',
  'waffe',
  'kaliber',
  'waffenkategorie',
];

/**
 * The switch. Outside production the demo is written on every boot unless
 * `DEMO_SEED=0`. With `APP_ENV=production` nothing is seeded unless
 * `DEMO_SEED=1` is set explicitly — that is the hosted demo instance
 * (Lösungskonzept 6.5): production hardening, synthetic dataset. Missing
 * `DEMO_SEED` in production stays off, so a real installation never gets
 * the demo tenant by accident. `DEMO_RESEED=1` forces a fresh copy right
 * now (a stale marker, hand-edited rows).
 */
export function demoSeedEnabled(isProd = false): boolean {
  const flag = process.env['DEMO_SEED'];
  return isProd ? flag === '1' : flag !== '0';
}

export interface DemoSeedResult {
  /** True when the marker already matched and nothing was written. */
  skipped: boolean;
  year: number;
  areas: number;
  rooms: number;
  /** Zulässige Kombinationen je Stellungsraum. */
  combinations: number;
  /** Immissionspunkte over every state. */
  receivers: number;
  /** Zustände. */
  calculations: number;
  /** Schusslinien over every state. */
  sources: number;
  wlr: number;
  usages: number;
}

/**
 * Fill the demo tenant with the «SLIM Demo» dataset, rolled to the year the
 * seed runs in. Master data and permanent references are written directly;
 * every Zustand goes through the `ImportService` — the same path as the
 * FGDB upload (5.19), so the demo proves the import and its checks.
 *
 * Does nothing as long as the marker says this version was already written
 * for this year. A new year, a bumped dataset version or `force` empty the
 * tenant's own tables and write everything again — the same nine areas,
 * the same Geissalp usages, with this year's dates. That is the whole
 * point: the demo never shows last year.
 *
 * Only ever meant for the demo tenant. It empties tables.
 */
export async function seedDemoDataset(
  connection: DataSource,
  tenantId: string,
  options: {
    now?: Date;
    force?: boolean;
    /** Key in tenant.mock.json (default «SLIM Demo»); ignored when `dataset` is given. */
    datasetKey?: string;
    /** A dataset object instead of tenant.mock.json (test fixtures, e.g. «Testplatz S»); dates still raw. */
    dataset?: TenantDataset;
  } = {},
): Promise<DemoSeedResult> {
  const now = options.now ?? new Date();
  const key = options.dataset ? options.dataset.identifier : (options.datasetKey ?? DEFAULT_DATASET_KEY);
  const year = now.getFullYear();
  const dataset = options.dataset ? withDates(options.dataset, now) : loadDataset(key, now);
  const markers = connection.getRepository(DemoSeedMarkerEntity);

  const marker = await markers.findOne({ where: { tenantId } });
  const current =
    marker &&
    marker.datasetKey === key &&
    marker.version === dataset.version &&
    marker.year === year;
  const empty: DemoSeedResult = { skipped: true, year, areas: 0, rooms: 0, combinations: 0, receivers: 0, calculations: 0, sources: 0, wlr: 0, usages: 0 };
  if (current && !options.force) return empty;

  log.log(
    marker
      ? `Rewriting the demo tenant for ${year} (had ${marker.year}, v${marker.version})`
      : `Writing the demo tenant for ${year}`,
  );
  await wipeTenant(connection, tenantId);
  await writeTenantHead(connection, tenantId, dataset);
  await writeUsers(connection, tenantId, dataset);
  const master = await writeMasterData(connection, tenantId, dataset.masterData);

  const result: DemoSeedResult = { ...empty, skipped: false };
  const importer = new ImportService(connection);
  const areaIdByName = new Map<string, string>();
  for (const area of dataset.areas) {
    const counts = await writeArea(connection, tenantId, area, master, importer);
    areaIdByName.set(area.name, counts.areaId);
    result.areas++;
    result.rooms += counts.rooms;
    result.combinations += counts.combinations;
    result.receivers += counts.receivers;
    result.calculations += counts.calculations;
    result.sources += counts.sources;
    result.wlr += counts.wlr;
    result.usages += counts.usages;
  }

  await writeHolidays(connection, tenantId, dataset, areaIdByName);
  await writeAreaAssignments(connection, tenantId, dataset);

  await markers.save(markers.create({ tenantId, datasetKey: key, version: dataset.version, year }));
  return result;
}

/** Empty the demo tenant's own tables; a table this database lacks is skipped. */
async function wipeTenant(connection: DataSource, tenantId: string): Promise<void> {
  for (const table of WIPE) {
    try {
      await rawQuery(connection, `DELETE FROM ${table} WHERE tenantId = ?`, [tenantId]);
    } catch (err) {
      log.warn(`Could not empty ${table}: ${(err as Error).message}`);
    }
  }
}

/** The tenant itself: name, identifier and description sit on the platform's `tenant` row. */
async function writeTenantHead(connection: DataSource, tenantId: string, dataset: TenantDataset): Promise<void> {
  try {
    await rawQuery(connection,
      'UPDATE tenant SET tenantName = ?, identifier = ?, tenantDescription = ? WHERE tenantId = ?',
      [dataset.name, dataset.identifier, dataset.description, tenantId],
    );
  } catch (err) {
    log.warn(`Could not write the demo tenant row: ${(err as Error).message}`);
  }
}

/**
 * The accounts of the dataset, one per role (B1 8.1.1). The galaxy seed
 * creates `APP_DEFAULT_USER` with e-mail and password only; every other
 * account is created here the same way (`UserEntity.initialise` +
 * `setPasswordAndEncrypt`), existing accounts only get their name — a
 * password is never overwritten. Role assignment (`app_user_right`) is
 * added once; the galaxy admin role of the default user stays.
 */
async function writeUsers(connection: DataSource, tenantId: string, dataset: TenantDataset): Promise<void> {
  const users = connection.getRepository(UserEntity);
  for (const user of dataset.users) {
    try {
      let row = await users.findOne({ where: { email: user.username } });
      if (!row) {
        row = UserEntity.create().initialise(
          { email: user.username, firstName: user.firstName, lastName: user.lastName } as Partial<UserEntity>,
          false,
        );
        await row.setPasswordAndEncrypt(user.password, await genSalt());
        row.host = user.username.split('@')[1];
        row.authCreatedAt = new Date().getFullYear();
        row = await users.save(row);
      } else {
        await users.update({ email: user.username }, { firstName: user.firstName, lastName: user.lastName });
      }
      // Membership of the tenant (galaxy tenant_user_role): without it the user
      // administration and the tenant chooser do not list the account.
      const membership = connection.getRepository(TenantUserRoleEntity);
      if (!(await membership.findOne({ where: { tenantId, userId: row.userId } }))) {
        await membership.save(
          membership.create({
            tenantId,
            userId: row.userId,
            roles: user.role === 'admin' ? 'root' : 'user',
            userCreatedAt: row.authCreatedAt,
          } as Partial<TenantUserRoleEntity>),
        );
      }
      const roleId = SLIM_ROLE_BY_KEY[user.role ?? 'admin'];
      const has: { n: string }[] = await rawQuery(connection,
        'select count(*) as n from app_user_right where tenantId = ? and userId = ? and roleId = ?',
        [tenantId, row.userId, roleId],
      );
      if (!Number(has[0]?.n)) {
        await rawQuery(connection, 'insert into app_user_right (userId, tenantId, roleId) values (?, ?, ?)', [
          row.userId,
          tenantId,
          roleId,
        ]);
      }
    } catch (err) {
      log.warn(`Could not write user ${user.username}: ${(err as Error).message}`);
    }
  }
}

/** Resolved master data: dataset keys → saved rows. */
interface MasterIndex {
  combinationByKey: Map<string, WeaponCombinationEntity>;
}

/** Tenant-wide Waffenkategorien, Waffen, Kaliber and Kombinationen (5.22–5.25). */
async function writeMasterData(connection: DataSource, tenantId: string, data: DatasetMasterData): Promise<MasterIndex> {
  const categories = connection.getRepository(WeaponCategoryEntity);
  const weapons = connection.getRepository(WeaponEntity);
  const calibers = connection.getRepository(CaliberEntity);
  const combinations = connection.getRepository(WeaponCombinationEntity);

  const savedCategories = await categories.save(
    data.categories.map((c, i) => categories.create({ tenantId, code: c.code, nameDe: c.nameDe, nameFr: c.nameFr ?? null, nameIt: c.nameIt ?? null, sortOrder: c.sortOrder ?? i, enabled: true })),
  );
  const categoryByCode = new Map(savedCategories.map((c) => [c.code, c]));
  const weaponByKey = new Map<string, WeaponEntity>();
  for (const w of data.weapons) {
    const category = categoryByCode.get(w.category);
    if (!category) throw new Error(`master data: weapon ${w.key} has unknown category ${w.category}`);
    weaponByKey.set(w.key, await weapons.save(weapons.create({ tenantId, nameDe: w.nameDe, nameFr: w.nameFr ?? null, nameIt: w.nameIt ?? null, categoryId: category.id, annex7Category: w.annex7Category, enabled: true })));
  }
  const caliberByKey = new Map<string, CaliberEntity>();
  for (const c of data.calibers) {
    caliberByKey.set(c.key, await calibers.save(calibers.create({ tenantId, nameDe: c.nameDe, nameFr: c.nameFr ?? null, nameIt: c.nameIt ?? null, alnNo: c.alnNo ?? null, sapNo: c.sapNo ?? null, quantityUnit: c.quantityUnit ?? 'shots', enabled: true })));
  }
  const combinationByKey = new Map<string, WeaponCombinationEntity>();
  for (const k of data.combinations) {
    const weapon = weaponByKey.get(k.weapon);
    const caliber = caliberByKey.get(k.caliber);
    if (!weapon || !caliber) throw new Error(`master data: combination ${k.key} references unknown weapon/caliber`);
    combinationByKey.set(k.key, await combinations.save(combinations.create({ tenantId, weaponId: weapon.id, caliberId: caliber.id, nameDe: k.nameDe, nameFr: k.nameFr ?? null, nameIt: k.nameIt ?? null, sonarmsId: k.sonarmsId ?? null, enabled: true })));
  }
  return { combinationByKey };
}

/** Feiertage (B1 7.4): tenant-wide (area null) or local to one Schiessplatz. */
async function writeHolidays(connection: DataSource, tenantId: string, dataset: TenantDataset, areaIdByName: Map<string, string>): Promise<void> {
  const holidays = connection.getRepository(HolidayEntity);
  for (const h of dataset.holidays ?? []) {
    const areaId = h.area ? areaIdByName.get(h.area) ?? null : null;
    if (h.area && !areaId) {
      log.warn(`holiday ${h.name}: area "${h.area}" is not in the dataset`);
      continue;
    }
    await holidays.save(holidays.create({ tenantId, areaId, date: h.date, from: h.from ?? null, to: h.to ?? null, name: h.name }));
  }
}

/** «W/R-O»: which Schiessplätze a range owner is assigned to (schiessplatz_benutzer). */
async function writeAreaAssignments(connection: DataSource, tenantId: string, dataset: TenantDataset): Promise<void> {
  const users = connection.getRepository(UserEntity);
  const areas = connection.getRepository(AreaEntity);
  const assignments = connection.getRepository(AreaUserEntity);
  for (const user of dataset.users) {
    if (!user.areas?.length) continue;
    const row = await users.findOne({ where: { email: user.username } });
    if (!row) continue;
    for (const name of user.areas) {
      const area = await areas.findOne({ where: { tenantId, name } });
      if (!area) {
        log.warn(`${user.username}: area "${name}" is not in the dataset`);
        continue;
      }
      await assignments.save(assignments.create({ tenantId, areaId: area.id, userId: row.userId }));
    }
  }
}

async function writeArea(connection: DataSource, tenantId: string, data: DatasetArea, master: MasterIndex, importer: ImportService) {
  const areas = connection.getRepository(AreaEntity);
  const rooms = connection.getRepository(AreaRoomEntity);
  const assignments = connection.getRepository(RoomCombinationEntity);
  const quotas = connection.getRepository(AreaQuotaEntity);
  const usages = connection.getRepository(AreaUsageEntity);
  const positions = connection.getRepository(UsagePositionEntity);

  const area = await areas.save(
    areas.create({
      tenantId,
      name: data.name,
      coordinationSectionNo: data.coordinationSectionNo,
      sectoralPlanNo: data.sectoralPlanNo,
      quotaStatus: 'none',
      noiseStatus: 'none',
      annex7Overall: data.annex7Overall,
      enabled: data.enabled ?? true,
      classification: data.classification ?? null,
      recalculationState: data.recalculationState ?? null,
      remediationProjectState: data.remediationProjectState ?? null,
      spmState: data.spmState ?? null,
      noiseRemediationState: data.noiseRemediationState ?? null,
      projectState: data.projectState ?? null,
      planningApproval: data.planningApproval ?? null,
    }),
  );

  const savedRooms = await rooms.save(
    data.rooms.map((r, i) =>
      rooms.create({
        tenantId,
        areaId: area.id,
        coordinationSectionNo: r.coordinationSectionNo,
        name: r.name,
        groupName: r.groupName,
        sortOrder: r.sortOrder ?? i,
        enabled: r.enabled ?? true,
      }),
    ),
  );
  const roomByName = new Map(savedRooms.map((r) => [r.name, r]));
  const room = (name: string): AreaRoomEntity => {
    const found = roomByName.get(name);
    if (!found) throw new Error(`${data.name}: room "${name}" is not in the dataset`);
    return found;
  };
  const combination = (key: string): WeaponCombinationEntity => {
    const found = master.combinationByKey.get(key);
    if (!found) throw new Error(`${data.name}: combination "${key}" is not in the master data`);
    return found;
  };

  const savedAssignments = await assignments.save(
    data.roomCombinations.map((rc) =>
      assignments.create({ tenantId, areaId: area.id, roomId: room(rc.room).id, combinationId: combination(rc.combination).id, entryName: rc.entryName, enabled: true }),
    ),
  );
  await quotas.save(
    data.quotas.map((q) => quotas.create({ tenantId, areaId: area.id, combinationId: combination(q.combination).id, shotsPerYear: q.shotsPerYear, basis: q.basis ?? null })),
  );

  let usageCount = 0;
  for (let i = 0; i < data.usages.length; i += 100) {
    const chunk = data.usages.slice(i, i + 100);
    const saved = await usages.save(
      chunk.map((u) =>
        usages.create({
          tenantId,
          areaId: area.id,
          roomId: room(u.room).id,
          unit: u.unit,
          date: u.date,
          timeFrom: u.from,
          timeTo: u.to,
          usageType: u.usageType,
          civilUsageKind: u.civilUsageKind ?? null,
          personCount: u.personCount ?? null,
          recordedBy: u.recordedBy,
          source: u.source_kind ?? 'manual',
          externalId: u.externalId ?? null,
          note: u.note ?? null,
        }),
      ),
    );
    const rows: UsagePositionEntity[] = [];
    saved.forEach((usage, j) => {
      for (const p of chunk[j].positions) {
        rows.push(positions.create({ tenantId, usageId: usage.id, areaId: area.id, combinationId: combination(p.combination).id, quantity: p.quantity, quantityUnit: p.quantityUnit ?? 'shots' }));
      }
    });
    for (let k = 0; k < rows.length; k += 200) await positions.save(rows.slice(k, k + 200));
    usageCount += saved.length;
  }

  let receivers = 0;
  let states = 0;
  let sources = 0;
  let wlr = 0;
  for (const c of data.calculations) {
    for (const s of c.states) {
      const dto: StateImportDto = {
        calculation: { name: c.name, supplier: c.supplier, deliveredAt: c.deliveredAt },
        state: { externalId: s.externalId, name: s.name, referenceYear: s.referenceYear, isCurrent: s.isCurrent, isMgdm: s.isMgdm },
        propagation: s.propagation ?? null,
        perimeter: s.perimeter ?? null,
        plantParts: s.plantParts.map((p) => ({ coordinationSectionNo: p.coordinationSectionNo, name: p.name, type: p.type, builtAfter1985: p.builtAfter1985, geometry: p.geometry ?? null, roomName: p.room })),
        sources: s.sources.map((src) => ({ sourceId: src.sourceId, plantPartNo: src.plantPart, weaponSystem: src.weaponSystem, geometry: src.geometry ?? null, a9: src.a9 ?? null, a7: src.a7 ?? null })),
        buildings: s.immissionPoints.filter((p) => p.egid).map((p) => ({ egid: p.egid, address: p.address, surfaceType: 'schallhart', assessment: '', persons: 4 })),
        immissionPoints: s.immissionPoints.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i })),
        wlr: s.wlr,
      };
      const report = await importer.importState(tenantId, area.id, dto);
      states++;
      receivers += report.counts.immissionPoints;
      sources += report.counts.sources;
      wlr += report.counts.wlr;
      for (const w of report.warnings) log.debug(`${data.name} / ${s.name}: ${w}`);
    }
  }

  return {
    areaId: area.id,
    rooms: savedRooms.length,
    combinations: savedAssignments.length,
    receivers,
    calculations: states,
    sources,
    wlr,
    usages: usageCount,
  };
}
