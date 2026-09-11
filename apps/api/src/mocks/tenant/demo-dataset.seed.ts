import { Logger } from '@nestjs/common';
import { rawQuery } from '@api-slim/common';
import { DataSource } from 'typeorm';
import { UserEntity } from '@app-galaxy/auth-api';
import { TenantUserRoleEntity } from '@app-galaxy/core-api';
import { genSalt } from 'bcryptjs';
import { SLIM_ROLE_BY_KEY } from '../roles.mock-data';
import {
  AreaEntity,
  AreaRoomEntity,
  AreaUserEntity,
  AreaWeaponEntity,
} from '../../modules/area/entities';
import {
  AreaCalculationEntity,
  AreaReceiverEntity,
  AreaWlrEntity,
  ImmissionCalculationEntity,
} from '../../modules/calculation/entities';
import { AreaUsageEntity } from '../../modules/usage/entities';
import { DemoSeedMarkerEntity } from './demo-seed-marker.entity';
import {
  DEFAULT_DATASET_KEY,
  DatasetArea,
  TenantDataset,
  loadDataset,
} from './tenant-dataset';

const log = new Logger('DemoDataset');

/**
 * The demo tenant's own tables, in the order they can be emptied without a
 * foreign key complaining. Nothing of the login (users, roles, rights) or
 * the galaxy tenant tables is touched.
 */
const WIPE = [
  'schiessplatz_benutzer',
  'wlr_pegel',
  'nutzung',
  'zustand',
  'immissionsberechnung',
  'empfangspunkt',
  'stellungsraum_waffe',
  'stellungsraum',
  'schiessplatz',
];

/**
 * The switch. The demo is written on every non-production boot unless
 * `DEMO_SEED=0`; `DEMO_RESEED=1` forces a fresh copy right now (a stale
 * marker, hand-edited rows).
 */
export function demoSeedEnabled(): boolean {
  return process.env['DEMO_SEED'] !== '0';
}

export interface DemoSeedResult {
  /** True when the marker already matched and nothing was written. */
  skipped: boolean;
  year: number;
  areas: number;
  rooms: number;
  weapons: number;
  receivers: number;
  calculations: number;
  wlr: number;
  usages: number;
}

/**
 * Fill the demo tenant with the «SLIM Demo» dataset, rolled to the year the
 * seed runs in.
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
  options: { now?: Date; force?: boolean; datasetKey?: string } = {},
): Promise<DemoSeedResult> {
  const now = options.now ?? new Date();
  const key = options.datasetKey ?? DEFAULT_DATASET_KEY;
  const year = now.getFullYear();
  const dataset = loadDataset(key, now);
  const markers = connection.getRepository(DemoSeedMarkerEntity);

  const marker = await markers.findOne({ where: { tenantId } });
  const current =
    marker &&
    marker.datasetKey === key &&
    marker.version === dataset.version &&
    marker.year === year;
  if (current && !options.force) {
    return { skipped: true, year, areas: 0, rooms: 0, weapons: 0, receivers: 0, calculations: 0, wlr: 0, usages: 0 };
  }

  log.log(
    marker
      ? `Rewriting the demo tenant for ${year} (had ${marker.year}, v${marker.version})`
      : `Writing the demo tenant for ${year}`,
  );
  await wipeTenant(connection, tenantId);
  await writeTenantHead(connection, tenantId, dataset);
  await writeUsers(connection, tenantId, dataset);

  const result: DemoSeedResult = { skipped: false, year, areas: 0, rooms: 0, weapons: 0, receivers: 0, calculations: 0, wlr: 0, usages: 0 };
  for (const area of dataset.areas) {
    const counts = await writeArea(connection, tenantId, area);
    result.areas++;
    result.rooms += counts.rooms;
    result.weapons += counts.weapons;
    result.receivers += counts.receivers;
    result.calculations += counts.calculations;
    result.wlr += counts.wlr;
    result.usages += counts.usages;
  }

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

/** «W/R-O»: which Schiessplätze a range owner is assigned to (area_user). */
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

async function writeArea(connection: DataSource, tenantId: string, data: DatasetArea) {
  const areas = connection.getRepository(AreaEntity);
  const rooms = connection.getRepository(AreaRoomEntity);
  const weapons = connection.getRepository(AreaWeaponEntity);
  const receivers = connection.getRepository(AreaReceiverEntity);
  const calculations = connection.getRepository(AreaCalculationEntity);
  const deliveries = connection.getRepository(ImmissionCalculationEntity);
  const wlr = connection.getRepository(AreaWlrEntity);
  const usages = connection.getRepository(AreaUsageEntity);

  const area = await areas.save(
    areas.create({
      tenantId,
      name: data.name,
      coordinationSectionNo: data.coordinationSectionNo,
      sectoralPlanNo: data.sectoralPlanNo,
      quotaStatus: data.quotaStatus,
      noiseStatus: data.noiseStatus,
      annex7Overall: data.annex7Overall,
      enabled: true,
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
        builtAfter1985: r.builtAfter1985,
        sortOrder: r.sortOrder ?? i,
        enabled: true,
      }),
    ),
  );
  const roomByName = new Map(savedRooms.map((r) => [r.name, r]));
  const room = (name: string): AreaRoomEntity => {
    const found = roomByName.get(name);
    if (!found) throw new Error(`${data.name}: room "${name}" is not in the dataset`);
    return found;
  };

  const savedWeapons = await weapons.save(
    data.weapons.map((w) =>
      weapons.create({
        tenantId,
        areaId: area.id,
        roomId: room(w.room).id,
        weaponName: w.weaponName,
        weapon: w.weapon,
        caliber: w.caliber,
        category: w.category,
        annex7Category: w.annex7Category,
        sourceId: w.sourceId,
        quota: w.quota,
        enabled: true,
      }),
    ),
  );
  const weaponBySource = new Map(savedWeapons.map((w) => [w.sourceId, w]));
  const source = (id: string): AreaWeaponEntity => {
    const found = weaponBySource.get(id);
    if (!found) throw new Error(`${data.name}: source "${id}" is not in the dataset`);
    return found;
  };

  const savedReceivers = await receivers.save(
    data.receivers.map((r, i) =>
      receivers.create({
        tenantId,
        areaId: area.id,
        code: r.code,
        egid: r.egid,
        address: r.address,
        municipality: r.municipality,
        type: r.type,
        sensitivityLevel: r.sensitivityLevel,
        east: r.east,
        north: r.north,
        mapX: r.mapX,
        mapY: r.mapY,
        sortOrder: r.sortOrder ?? i,
        enabled: true,
      }),
    ),
  );
  const receiverByCode = new Map(savedReceivers.map((r) => [r.code, r]));

  let wlrCount = 0;
  for (const c of data.calculations) {
    // Hierarchy B1 5.18: Immissionsberechnung (delivery) → Zustand. The
    // dataset lists states; each becomes its own delivery unless it names
    // an existing one (`calculation`).
    const deliveryName = c.calculation ?? c.name;
    const delivery =
      (await deliveries.findOne({ where: { tenantId, areaId: area.id, name: deliveryName } })) ??
      (await deliveries.save(
        deliveries.create({
          tenantId,
          areaId: area.id,
          name: deliveryName,
          supplier: c.supplier,
          deliveredAt: c.deliveredAt,
          enabled: true,
        }),
      ));
    const calculation = await calculations.save(
      calculations.create({
        tenantId,
        areaId: area.id,
        calculationId: delivery.id,
        name: c.name,
        referenceYear: c.referenceYear,
        buildYearClass: c.buildYearClass,
        isCurrent: c.isCurrent,
        isMgdm: c.isMgdm,
        enabled: true,
      }),
    );
    const rows = c.wlr.map((row) => {
      const receiver = receiverByCode.get(row.receiver);
      if (!receiver) throw new Error(`${data.name}: receiver "${row.receiver}" is not in the dataset`);
      return wlr.create({
        tenantId,
        calculationId: calculation.id,
        receiverId: receiver.id,
        weaponId: source(row.source).id,
        laeDay: row.laeDay,
        laeEve: row.laeEve,
        lafmaxDay: row.lafmaxDay,
      });
    });
    // Chunked: SQLite limits the variables of one INSERT.
    for (let i = 0; i < rows.length; i += 200) await wlr.save(rows.slice(i, i + 200));
    wlrCount += rows.length;
  }

  const usageRows = data.usages.map((u) =>
    usages.create({
      tenantId,
      areaId: area.id,
      roomId: room(u.room).id,
      weaponId: source(u.source).id,
      unit: u.unit,
      date: u.date,
      timeFrom: u.from,
      timeTo: u.to,
      usageType: u.usageType,
      shots: u.shots,
      recordedBy: u.recordedBy,
      source: u.source_kind ?? 'manual',
      note: u.note ?? null,
    }),
  );
  for (let i = 0; i < usageRows.length; i += 200) await usages.save(usageRows.slice(i, i + 200));

  return {
    rooms: savedRooms.length,
    weapons: savedWeapons.length,
    receivers: savedReceivers.length,
    calculations: data.calculations.length,
    wlr: wlrCount,
    usages: usageRows.length,
  };
}
