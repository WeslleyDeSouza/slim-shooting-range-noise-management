import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Annex9Source,
  annex9Level,
  applicableLimits,
  LSV_EMPTY_LEVEL,
  limits,
  noiseState,
  roundDb,
} from '@slim/lsv';
import { AreaService } from '../area/area.service';
import { AreaRoomEntity, AreaWeaponEntity } from '../area/entities';
import { UsageService } from '../usage/usage.service';
import { buildContext, countStates, toReceiverDto } from './assessment.service';
import { CalculationService, WlrIndex } from './calculation.service';
import {
  SimulationBaseDto,
  SimulationReceiverDto,
  SimulationResultDto,
  SimulationRowDto,
  SimulationRunDto,
} from './dto';
import { AreaCalculationEntity, AreaReceiverEntity } from './entities';

type Shots = Map<string, { inside: number; outside: number }>;

/**
 * 5.13 «Simulation»: the year's military shot counts per source (room ×
 * weapon, inside / outside the workday after 7.4.5) are the Ist; the user
 * overwrites them and the Beurteilungspegel after Annex 9 is recomputed
 * against the current calculation state. A sandbox: nothing is written.
 */
@Injectable()
export class SimulationService {
  constructor(
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(AreaWeaponEntity)
    private readonly weapons: Repository<AreaWeaponEntity>,
    private readonly areas: AreaService,
    private readonly usages: UsageService,
    private readonly calculations: CalculationService,
  ) {}

  async base(
    tenantId: string,
    areaId: string,
    year: number,
    calculationId?: string,
  ): Promise<SimulationBaseDto> {
    const { calculation, rows, receivers } = await this.load(tenantId, areaId, year, calculationId);
    return {
      areaId,
      year,
      calculation: calculation ? this.calculations.toDto(calculation, rows.filter((r) => r.hasLevels).length) : null,
      rows,
      receivers: receivers.map((r) => r.base),
    };
  }

  async run(tenantId: string, areaId: string, dto: SimulationRunDto): Promise<SimulationResultDto> {
    const { calculation, rows, receivers, levels } = await this.load(
      tenantId,
      areaId,
      dto.year,
      dto.calculationId,
    );
    const known = new Set(rows.map((r) => r.weaponId));
    const unknown = dto.rows.filter((r) => !known.has(r.weaponId));
    if (unknown.length) {
      throw new BadRequestException(`Unknown sources: ${unknown.map((r) => r.weaponId).join(', ')}`);
    }

    // Rows the client did not send keep their Ist values.
    const simulated: Shots = new Map(rows.map((r) => [r.weaponId, { inside: r.inside, outside: r.outside }]));
    for (const row of dto.rows) simulated.set(row.weaponId, { inside: row.inside, outside: row.outside });

    const result = receivers.map(({ entity, base }) => {
      const level = lr(entity, levels, simulated);
      const simulatedState = noiseState(level, base.limit);
      return {
        ...base,
        simulated: level,
        simulatedState,
        delta: level !== null && base.current !== null ? roundDb(level - base.current) : null,
      };
    });

    const sum = (shots: Shots, key: 'inside' | 'outside') =>
      [...shots.values()].reduce((total, s) => total + s[key], 0);
    const baseShots: Shots = new Map(rows.map((r) => [r.weaponId, { inside: r.inside, outside: r.outside }]));

    return {
      areaId,
      year: dto.year,
      calculation: calculation ? this.calculations.toDto(calculation, rows.filter((r) => r.hasLevels).length) : null,
      receivers: result,
      counts: countStates(result.map((r) => r.simulatedState)),
      totals: {
        inside: sum(simulated, 'inside'),
        outside: sum(simulated, 'outside'),
        baseInside: sum(baseShots, 'inside'),
        baseOutside: sum(baseShots, 'outside'),
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  private async load(tenantId: string, areaId: string, year: number, calculationId?: string) {
    const area = await this.areas.get(tenantId, areaId);
    const [{ selected }, receiverEntities, rooms, weapons, usages] = await Promise.all([
      this.calculations.resolve(tenantId, areaId, calculationId),
      this.calculations.listReceivers(tenantId, areaId),
      this.rooms.find({ where: { tenantId, areaId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.weapons.find({ where: { tenantId, areaId, enabled: true } }),
      this.usages.listYear(tenantId, areaId, year),
    ]);
    const levels: WlrIndex = selected ? await this.calculations.levels(tenantId, selected.id) : new Map();
    const context = buildContext(area, rooms, weapons, usages, 1);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const withLevels = new Set<string>();
    for (const perReceiver of levels.values()) for (const weaponId of perReceiver.keys()) withLevels.add(weaponId);

    const rows: SimulationRowDto[] = weapons
      .map((w) => ({
        weaponId: w.id,
        sourceId: w.sourceId,
        roomId: w.roomId,
        roomName: roomById.get(w.roomId)?.name ?? '',
        roomNo: roomById.get(w.roomId)?.coordinationSectionNo ?? null,
        weapon: w.weapon,
        caliber: w.caliber,
        weaponName: w.weaponName,
        inside: context.annex9.get(w.id)?.inside ?? 0,
        outside: context.annex9.get(w.id)?.outside ?? 0,
        hasLevels: withLevels.has(w.id),
      }))
      .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.weapon.localeCompare(b.weapon));

    const receivers = receiverEntities.map((entity) => ({
      entity,
      base: toSimulationReceiver(entity, selected, levels, context.annex9),
    }));
    return { calculation: selected, rows, receivers, levels };
  }
}

/** Ist: Annex 9 Lr against the limit that applies to the plant (IGW unless all new). */
function toSimulationReceiver(
  receiver: AreaReceiverEntity,
  calculation: AreaCalculationEntity | null,
  levels: WlrIndex,
  shots: Shots,
): SimulationReceiverDto {
  const kinds = calculation ? applicableLimits(calculation.buildYearClass) : ['igw' as const];
  const limitKind = kinds.includes('igw') ? 'igw' : 'pw';
  const limit = limits(9, receiver.sensitivityLevel)[limitKind];
  const current = lr(receiver, levels, shots);
  return {
    ...toReceiverDto(receiver),
    limitKind,
    limit,
    current,
    currentState: noiseState(current, limit),
  };
}

/** Rounded Annex 9 Lr of a receiver for the given shots, null without data. */
function lr(receiver: AreaReceiverEntity, levels: WlrIndex, shots: Shots): number | null {
  if (receiver.type === 'reserve') return null;
  const perSource = levels.get(receiver.id);
  if (!perSource) return null;
  const sources: Annex9Source[] = [];
  for (const [weaponId, row] of perSource) {
    const s = shots.get(weaponId);
    if (!s || (s.inside === 0 && s.outside === 0)) continue;
    sources.push({ sourceId: weaponId, shotsDay: s.inside, shotsEve: s.outside, laeDay: row.laeDay, laeEve: row.laeEve });
  }
  if (!sources.length) return null;
  const level = annex9Level(sources).lr;
  return Number.isFinite(level) && level > LSV_EMPTY_LEVEL ? roundDb(level) : null;
}
