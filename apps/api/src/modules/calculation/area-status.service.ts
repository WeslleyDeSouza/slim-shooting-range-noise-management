import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { quotaState, worstState } from '@slim/lsv';
import { AreaEntity, AreaQuotaEntity, AreaStatus, AreaStatusReason, WeaponCombinationEntity } from '../area/entities';
import { SettingsService } from '../settings/settings.service';
import { UsageService } from '../usage/usage.service';
import { AssessmentService } from './assessment.service';
import { QuotaOverviewDto, QuotaRowDto, QuotaState } from './dto/quota-overview.dto';

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
    @InjectRepository(WeaponCombinationEntity)
    private readonly combinations: Repository<WeaponCombinationEntity>,
    private readonly assessment: AssessmentService,
    @Inject(forwardRef(() => UsageService))
    private readonly usages: UsageService,
    private readonly settings: SettingsService,
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
      statusYear: this.year(now),
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
    const year = this.year(now);
    const result = await this.assessment.assess(tenantId, areaId, { now, from: `${year}-01-01`, to: `${year}-12-31` });
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
    const { status, reason } = await this.quotaOverview(tenantId, areaId, { now });
    return { status, reason };
  }

  /**
   * «Übersicht Kontingente gemäss Plangenehmigung» (B1 5.10, Bedienelement 3):
   * one row per combination Waffe/Kaliber with its Soll, the Ist of the year
   * and the Ø of three years, each with its colour. The light of the overview
   * is the worst colour of these rows — table and light are one computation.
   */
  async quotaOverview(tenantId: string, areaId: string, options: { now?: Date; year?: number } = {}): Promise<QuotaOverviewDto> {
    if (!(await this.areas.existsBy({ tenantId, id: areaId }))) throw new NotFoundException(`Area ${areaId} not found`);
    const thisYear = this.year(options.now ?? new Date());
    const year = options.year ?? thisYear;
    const [thresholds, quotas, current, previous1, previous2, usageYears] = await Promise.all([
      // Schwellenwerte der Kontingent-Ampel in Prozent des Solls (B1 5.28, FAQ 166).
      this.settings.thresholds(tenantId),
      this.quotas.find({ where: { tenantId, areaId } }),
      this.usages.listYear(tenantId, areaId, year),
      this.usages.listYear(tenantId, areaId, year - 1),
      this.usages.listYear(tenantId, areaId, year - 2),
      this.usages.years(tenantId, areaId),
    ]);
    const sumBy = (rows: typeof current): Map<string, number> => {
      const m = new Map<string, number>();
      for (const u of rows) for (const p of u.positions ?? []) m.set(p.combinationId, (m.get(p.combinationId) ?? 0) + Number(p.quantity));
      return m;
    };
    const ist = sumBy(current);
    const three = sumBy([...current, ...previous1, ...previous2]);
    const quotaOf = new Map(quotas.map((q) => [q.combinationId, q]));
    const ids = [...new Set([...three.keys(), ...quotaOf.keys()])];
    const combinations = ids.length
      ? await this.combinations.find({ where: { tenantId, id: In(ids) }, relations: { caliber: true } })
      : [];
    const combinationOf = new Map(combinations.map((c) => [c.id, c]));
    const state = (actual: number, target: number): QuotaState =>
      quotaState(actual, target, thresholds.quotaWarnFactor, thresholds.quotaOkFactor) as QuotaState;

    const rows = ids
      .map<QuotaRowDto>((id) => {
        const quota = quotaOf.get(id);
        const target = quota ? Number(quota.shotsPerYear) : 0; // no Kontingent for this combination → Soll 0 (B1 5.10)
        const currentQuantity = round3(ist.get(id) ?? 0);
        const average = round3((three.get(id) ?? 0) / 3);
        const combination = combinationOf.get(id);
        return {
          combinationId: id,
          name: combination?.nameDe ?? '',
          quantityUnit: combination?.caliber?.quantityUnit ?? 'shots',
          target,
          hasQuota: !!quota,
          basis: quota?.basis ?? null,
          current: currentQuantity,
          currentState: state(currentQuantity, target),
          average,
          averageState: state((three.get(id) ?? 0) / 3, target),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const withoutQuota = rows.some((row) => !row.hasQuota && (three.get(row.combinationId) ?? 0) > 0);
    const hasUsages = three.size > 0;
    return {
      year,
      fromYear: year - 2,
      years: [...new Set([thisYear, year, ...usageYears])].sort((a, b) => b - a),
      greenMaxPercent: round3(thresholds.quotaOkFactor * 100),
      orangeMaxPercent: round3(thresholds.quotaWarnFactor * 100),
      status: hasUsages ? worstState(rows.flatMap((row) => [row.currentState, row.averageState])) : 'none',
      reason: hasUsages ? (withoutQuota ? 'no-quota' : null) : 'no-usages',
      rows,
    };
  }

  private year(now: Date): number {
    return Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Zurich', year: 'numeric' }).format(now));
  }
}

/** Three decimals: the precision of a quantity. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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
