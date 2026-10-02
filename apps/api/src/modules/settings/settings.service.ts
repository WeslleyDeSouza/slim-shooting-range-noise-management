import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NOISE_WARN_BAND_DB, QUOTA_WARN_FACTOR } from '@slim/lsv';
import { ManualInfoDto, SystemSettingsDto } from './dto';
import { SystemSettingsEntity, UserManualEntity } from './entities';

/** What applies when the tenant has configured nothing: the rules of B1 5.10. */
export const SETTINGS_DEFAULTS = {
  quotaGreenMaxPercent: 100,
  quotaOrangeMaxPercent: QUOTA_WARN_FACTOR * 100,
  noiseGreenMaxDb: -NOISE_WARN_BAND_DB,
  noiseOrangeMaxDb: 0,
} as const;

/** The thresholds in the form the Ampel functions of `@slim/lsv` take them. */
export interface AmpelThresholds {
  /** `quotaState`: green up to `target · quotaOkFactor`. */
  quotaOkFactor: number;
  /** `quotaState`: orange up to `target · quotaWarnFactor`, red above. */
  quotaWarnFactor: number;
  /** `noiseState`: orange when `Lr > limit − noiseWarnBandDb`. */
  noiseWarnBandDb: number;
  /** `noiseState`: red when `Lr > limit + noiseOverAboveDb`. */
  noiseOverAboveDb: number;
}

/** The fields an administrator can change (`PATCH admin/data/system`); `undefined` = leave as is. */
export type SettingsPatch = Partial<Omit<SystemSettingsDto, 'manual'>>;

/** Largest Benutzerhandbuch the API stores. */
export const MANUAL_MAX_BYTES = 20 * 1024 * 1024;

const TEXT_FIELDS = ['specialistName', 'specialistPhone', 'specialistEmail', 'sysadminName', 'sysadminPhone', 'sysadminEmail'] as const;
const COLOR_FIELDS = ['colorOk', 'colorWarn', 'colorOver'] as const;
const NUMBER_FIELDS = ['quotaGreenMaxPercent', 'quotaOrangeMaxPercent', 'noiseGreenMaxDb', 'noiseOrangeMaxDb'] as const;

/**
 * Erweiterte Konfiguration (B1 5.28, slm 27) of a tenant: read by every
 * module that applies it (usage → Sperrdatum, calculation → thresholds) and
 * by the app; written through the Datenverwaltung (`modules/data-system`).
 * No dependency on other feature modules, so anyone may import it.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettingsEntity) private readonly settings: Repository<SystemSettingsEntity>,
    @InjectRepository(UserManualEntity) private readonly manuals: Repository<UserManualEntity>,
  ) {}

  /** The settings with the defaults filled in, plus the metadata of the Benutzerhandbuch. */
  async get(tenantId: string): Promise<SystemSettingsDto> {
    const [row, manual] = await Promise.all([this.row(tenantId), this.manualInfo(tenantId)]);
    return { ...toValues(row), manual };
  }

  /** Thresholds of both Ampeln as factors / bands for `quotaState` and `noiseState`. */
  async thresholds(tenantId: string): Promise<AmpelThresholds> {
    const values = toValues(await this.row(tenantId));
    return {
      quotaOkFactor: values.quotaGreenMaxPercent / 100,
      quotaWarnFactor: values.quotaOrangeMaxPercent / 100,
      noiseWarnBandDb: -values.noiseGreenMaxDb,
      noiseOverAboveDb: values.noiseOrangeMaxDb,
    };
  }

  /** Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD) or null. */
  async usageLockDate(tenantId: string): Promise<string | null> {
    return (await this.row(tenantId))?.usageLockDate ?? null;
  }

  /**
   * Changes the given fields. `null` resets a field to its default (no
   * Sperrdatum, default threshold, default colour, no contact).
   */
  async update(tenantId: string, patch: SettingsPatch): Promise<SystemSettingsDto> {
    const row = (await this.row(tenantId)) ?? this.settings.create({ tenantId });

    if (patch.usageLockDate !== undefined) {
      if (patch.usageLockDate !== null && !isDate(patch.usageLockDate)) {
        throw new BadRequestException('Das Sperrdatum ist kein gültiges Datum (JJJJ-MM-TT).');
      }
      row.usageLockDate = patch.usageLockDate;
    }
    for (const field of NUMBER_FIELDS) {
      const value = patch[field];
      if (value !== undefined) row[field] = value;
    }
    for (const field of COLOR_FIELDS) {
      const value = patch[field];
      if (value !== undefined) row[field] = value ? value.toLowerCase() : null;
    }
    for (const field of TEXT_FIELDS) {
      const value = patch[field];
      if (value !== undefined) row[field] = value?.trim() || null;
    }

    // Each Ampel needs green ≤ orange, otherwise «orange» could never show.
    const next = toValues(row);
    if (next.quotaGreenMaxPercent <= 0) {
      throw new BadRequestException('Der Schwellenwert «grün» der Kontingent-Ampel muss grösser als 0 % sein.');
    }
    if (next.quotaOrangeMaxPercent < next.quotaGreenMaxPercent) {
      throw new BadRequestException('Kontingent-Ampel: Der Schwellenwert «orange» darf nicht unter dem Schwellenwert «grün» liegen.');
    }
    if (next.noiseOrangeMaxDb < next.noiseGreenMaxDb) {
      throw new BadRequestException('Empfangspunkt-Ampel: Der Schwellenwert «orange» darf nicht unter dem Schwellenwert «grün» liegen.');
    }

    await this.settings.save(row);
    return this.get(tenantId);
  }

  // ----- Benutzerhandbuch ---------------------------------------------------

  async manualInfo(tenantId: string): Promise<ManualInfoDto | null> {
    const manual = await this.manuals.findOne({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return manual ? { fileName: manual.fileName, size: manual.size, uploadedAt: manual.createdAt.toISOString() } : null;
  }

  /** The PDF for the download; 404 when none is stored. */
  async manualFile(tenantId: string): Promise<{ fileName: string; content: Buffer }> {
    const manual = await this.manuals
      .createQueryBuilder('m')
      .addSelect('m.content')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.createdAt', 'DESC')
      .getOne();
    if (!manual) throw new NotFoundException('Es ist kein Benutzerhandbuch hinterlegt.');
    return { fileName: manual.fileName, content: Buffer.from(manual.content) };
  }

  /** Stores the uploaded PDF and removes the previous one. */
  async saveManual(tenantId: string, file: { fileName: string; content: Buffer }, userId: string | null): Promise<ManualInfoDto> {
    const fileName = file.fileName.trim().slice(0, 200);
    if (!file.content?.length) throw new BadRequestException('Die Datei ist leer.');
    if (file.content.length > MANUAL_MAX_BYTES) {
      throw new BadRequestException(`Die Datei ist grösser als ${MANUAL_MAX_BYTES / 1024 / 1024} MB.`);
    }
    // The content decides, not the name or the type the browser sent.
    if (file.content.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('Das Benutzerhandbuch muss ein PDF-Dokument sein.');
    }
    await this.manuals.delete({ tenantId });
    await this.manuals.save(
      this.manuals.create({ tenantId, fileName: fileName || 'Benutzerhandbuch.pdf', size: file.content.length, uploadedBy: userId, content: file.content }),
    );
    return (await this.manualInfo(tenantId)) as ManualInfoDto;
  }

  async removeManual(tenantId: string): Promise<void> {
    await this.manuals.delete({ tenantId });
  }

  private row(tenantId: string): Promise<SystemSettingsEntity | null> {
    return this.settings.findOne({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }
}

/** Row → values with the defaults of B1 5.10 for everything that is not set. */
function toValues(row: SystemSettingsEntity | null): Omit<SystemSettingsDto, 'manual'> {
  return {
    usageLockDate: row?.usageLockDate ?? null,
    quotaGreenMaxPercent: row?.quotaGreenMaxPercent ?? SETTINGS_DEFAULTS.quotaGreenMaxPercent,
    quotaOrangeMaxPercent: row?.quotaOrangeMaxPercent ?? SETTINGS_DEFAULTS.quotaOrangeMaxPercent,
    noiseGreenMaxDb: row?.noiseGreenMaxDb ?? SETTINGS_DEFAULTS.noiseGreenMaxDb,
    noiseOrangeMaxDb: row?.noiseOrangeMaxDb ?? SETTINGS_DEFAULTS.noiseOrangeMaxDb,
    colorOk: row?.colorOk ?? null,
    colorWarn: row?.colorWarn ?? null,
    colorOver: row?.colorOver ?? null,
    specialistName: row?.specialistName ?? null,
    specialistPhone: row?.specialistPhone ?? null,
    specialistEmail: row?.specialistEmail ?? null,
    sysadminName: row?.sysadminName ?? null,
    sysadminPhone: row?.sysadminPhone ?? null,
    sysadminEmail: row?.sysadminEmail ?? null,
  };
}

/** A real calendar date in the form YYYY-MM-DD. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
