import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { quotaState, worstState } from '@slim/lsv';
import { AreaEntity, AreaQuotaEntity, AreaStatus, AreaStatusReason } from '../area/entities';
import { UsageService } from '../usage/usage.service';
import { AssessmentService } from './assessment.service';

/**
 * The two traffic lights of the overview (B1 5.9 / 5.10), derived from the
 * calculation and the usages instead of a stored value: the noise light is
 * the worst Immissionspunkt of the current state over the current year, the
 * quota light the worst combination against its Kontingent (Ist current
 * year and Ø of three years; a combination without Kontingent has Soll 0,
 * B1 5.10). The result is written to `schiessplatz.quotaStatus/noiseStatus`
 * as a cache and refreshed after every change of usages, states or
 * pointers and at boot — the «tagesaktuelle Vorberechnung» B1 12.5 allows.
 */
@Injectable()
export class AreaStatusService {
  private readonly log = new Logger(AreaStatusService.name);

  constructor(
    @InjectRepository(AreaEntity)
    private readonly areas: Repository<AreaEntity>,
    @InjectRepository(AreaQuotaEntity)
    private readonly quotas: Repository<AreaQuotaEntity>,
    private readonly assessment: AssessmentService,
    @Inject(forwardRef(() => UsageService))
    private readonly usages: UsageService,
  ) {}

  async refresh(tenantId: string, areaId: string, now = new Date()): Promise<AreaStatusResult> {
    // Invalidate first: a failed refresh must never leave an old green result.
    await this.areas.update({ tenantId, id: areaId }, { quotaStatus: 'incomplete', noiseStatus: 'incomplete', quotaStatusReason: null, noiseStatusReason: null, noiseStatusBasis: null, statusYear: null });
    const [noise, quota] = await Promise.all([this.noise(tenantId, areaId, now), this.quota(tenantId, areaId, now)]);
    const result: AreaStatusResult = {
      quotaStatus: quota.status,
      quotaStatusReason: quota.reason,
      noiseStatus: noise.status,
      noiseStatusReason: noise.reason,
      noiseStatusBasis: noise.basis,
      statusYear: now.getFullYear(),
    };
    await this.areas.update({ tenantId, id: areaId }, result);
    return result;
  }

  async refreshAll(tenantId: string, now = new Date()): Promise<void> {
    const areas = await this.areas.find({ where: { tenantId }, select: ['id'] });
    for (const area of areas) {
      try {
        await this.refresh(tenantId, area.id, now);
      } catch (err) {
        this.log.warn(`status of area ${area.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * «Keine Daten» said precisely: no state marked «aktuell» (the assessment
   * page may fall back to the newest state, the overview light never does —
   * B1 5.9/5.18), or a current state but no usages in the year.
   */
  private async noise(tenantId: string, areaId: string, now: Date): Promise<StatusWithReason & { basis: string | null }> {
    const result = await this.assessment.assess(tenantId, areaId, { now });
    if (!result.calculation?.isCurrent || !result.receivers.length) return { status: 'none', reason: 'no-calculation', basis: null };
    const basis = result.calculation.name;
    if (!result.operatingData.length) return { status: 'none', reason: 'no-usages', basis };
    return { status: worstState(result.receivers.map((r) => r.state)), reason: null, basis };
  }

  /**
   * Kontingent (5.10): Ist of the current year and Ø over the year + two
   * before, per combination. Green is only ever a computed result: without
   * any usage in that window there is nothing to compare («no-usages», grey).
   * A shot combination without Kontingent counts with Soll 0 (B1 5.10) — red
   * at the first shot — and the light carries «no-quota» so the UI can say why.
   */
  private async quota(tenantId: string, areaId: string, now: Date): Promise<StatusWithReason> {
    const year = now.getFullYear();
    const [quotas, current, previous1, previous2] = await Promise.all([
      this.quotas.find({ where: { tenantId, areaId } }),
      this.usages.listYear(tenantId, areaId, year),
      this.usages.listYear(tenantId, areaId, year - 1),
      this.usages.listYear(tenantId, areaId, year - 2),
    ]);
    const sumBy = (rows: typeof current): Map<string, number> => {
      const m = new Map<string, number>();
      for (const u of rows) for (const p of u.positions ?? []) m.set(p.combinationId, (m.get(p.combinationId) ?? 0) + Number(p.quantity));
      return m;
    };
    const ist = sumBy(current);
    const three = sumBy([...current, ...previous1, ...previous2]);
    const target = new Map(quotas.map((q) => [q.combinationId, Number(q.shotsPerYear)]));
    if (!three.size) return { status: 'none', reason: 'no-usages' };
    const combinations = new Set([...three.keys(), ...target.keys()]);
    const states: AreaStatus[] = [];
    let withoutQuota = false;
    for (const id of combinations) {
      const soll = target.get(id) ?? 0; // no Kontingent for this combination → Soll 0 (B1 5.10)
      if (!target.has(id) && (three.get(id) ?? 0) > 0) withoutQuota = true;
      states.push(quotaState(ist.get(id) ?? 0, soll));
      states.push(quotaState((three.get(id) ?? 0) / 3, soll));
    }
    return { status: worstState(states), reason: withoutQuota ? 'no-quota' : null };
  }
}

interface StatusWithReason {
  status: AreaStatus;
  reason: AreaStatusReason | null;
}

export interface AreaStatusResult {
  quotaStatus: AreaStatus;
  quotaStatusReason: AreaStatusReason | null;
  noiseStatus: AreaStatus;
  noiseStatusReason: AreaStatusReason | null;
  noiseStatusBasis: string | null;
  statusYear: number;
}
