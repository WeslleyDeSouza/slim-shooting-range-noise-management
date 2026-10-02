import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelectionListDto, SelectionListValueCreateDto, SelectionListValueDto, SelectionListValueUpdateDto } from './dto';
import { SelectionListValueEntity } from './entities';
import { SELECTION_LIST_CODE_LENGTH, SELECTION_LIST_DEFAULTS, SELECTION_LIST_KEYS, SelectionListKey } from './selection-lists.defaults';

/**
 * Auswahllisten (B1 5.3, slm 1): the values the pick lists of the masks
 * offer, maintainable by the Applikationsadministrator — add a value, change
 * its labels or position, set it inactive. A list nobody has changed is
 * served from `SELECTION_LIST_DEFAULTS`; the first change copies it into
 * the table, from then on the table is the list.
 */
@Injectable()
export class SelectionListService {
  constructor(@InjectRepository(SelectionListValueEntity) private readonly values: Repository<SelectionListValueEntity>) {}

  /** Every list with its values (active and inactive) in the order of the selection. */
  async all(tenantId: string): Promise<SelectionListDto[]> {
    const rows = await this.values.find({ where: { tenantId }, order: { sortOrder: 'ASC', labelDe: 'ASC' } });
    return SELECTION_LIST_KEYS.map((key) => {
      const own = rows.filter((r) => r.listKey === key);
      return { key, values: own.length ? own.map((r) => toDto(key, r)) : defaults(key) };
    });
  }

  async list(tenantId: string, key: string): Promise<SelectionListDto> {
    const list = (await this.all(tenantId)).find((l) => l.key === assertKey(key));
    return list as SelectionListDto;
  }

  /** Adds a value at the end of the list. The code is derived from the German label and unique within the list. */
  async create(tenantId: string, key: string, dto: SelectionListValueCreateDto): Promise<SelectionListDto> {
    const list = assertKey(key);
    const existing = await this.materialise(tenantId, list);
    const labelDe = dto.labelDe.trim();
    if (!labelDe) throw new BadRequestException('Die Bezeichnung (DE) fehlt.');
    if (existing.some((v) => v.labelDe.toLowerCase() === labelDe.toLowerCase())) {
      throw new BadRequestException(`Den Wert «${labelDe}» gibt es in dieser Auswahlliste bereits.`);
    }
    await this.values.save(
      this.values.create({
        tenantId,
        listKey: list,
        code: uniqueCode(labelDe, existing.map((v) => v.code), SELECTION_LIST_CODE_LENGTH[list]),
        labelDe,
        labelFr: clean(dto.labelFr),
        labelIt: clean(dto.labelIt),
        labelEn: clean(dto.labelEn),
        sortOrder: Math.max(0, ...existing.map((v) => v.sortOrder)) + 1,
        enabled: true,
      }),
    );
    return this.list(tenantId, list);
  }

  /** Changes labels, position or the active flag of a value. */
  async update(tenantId: string, key: string, code: string, dto: SelectionListValueUpdateDto): Promise<SelectionListDto> {
    const list = assertKey(key);
    const existing = await this.materialise(tenantId, list);
    const value = existing.find((v) => v.code === code);
    if (!value) throw new NotFoundException(`Der Wert «${code}» ist in dieser Auswahlliste nicht vorhanden.`);
    if (dto.labelDe !== undefined) {
      const labelDe = dto.labelDe.trim();
      if (!labelDe) throw new BadRequestException('Die Bezeichnung (DE) fehlt.');
      if (existing.some((v) => v.code !== code && v.labelDe.toLowerCase() === labelDe.toLowerCase())) {
        throw new BadRequestException(`Den Wert «${labelDe}» gibt es in dieser Auswahlliste bereits.`);
      }
      value.labelDe = labelDe;
    }
    if (dto.labelFr !== undefined) value.labelFr = clean(dto.labelFr);
    if (dto.labelIt !== undefined) value.labelIt = clean(dto.labelIt);
    if (dto.labelEn !== undefined) value.labelEn = clean(dto.labelEn);
    if (dto.sortOrder !== undefined) value.sortOrder = dto.sortOrder;
    if (dto.enabled !== undefined) {
      // A list without an active value could not be filled in any more.
      if (!dto.enabled && !existing.some((v) => v.code !== code && v.enabled)) {
        throw new BadRequestException('Der letzte aktive Wert einer Auswahlliste kann nicht inaktiviert werden.');
      }
      value.enabled = dto.enabled;
    }
    await this.values.save(value);
    return this.list(tenantId, list);
  }

  /**
   * A record may carry `code` when it is an active value of the list — or
   * the value it already had (`previous`): a value set inactive later stays
   * valid on the records that use it.
   */
  async assertUsable(tenantId: string, key: SelectionListKey, code: string | null | undefined, previous?: string | null): Promise<void> {
    if (code == null || code === '' || code === previous) return;
    const { values } = await this.list(tenantId, key);
    if (!values.some((v) => v.code === code && v.enabled)) {
      throw new BadRequestException(`Der Wert «${code}» ist in der Auswahlliste «${key}» nicht vorhanden oder inaktiv.`);
    }
  }

  /** The rows of a list; the defaults are written to the table when the list has none yet. */
  private async materialise(tenantId: string, key: SelectionListKey): Promise<SelectionListValueEntity[]> {
    const rows = await this.values.find({ where: { tenantId, listKey: key }, order: { sortOrder: 'ASC' } });
    if (rows.length) return rows;
    return this.values.save(
      SELECTION_LIST_DEFAULTS[key].map((v, i) =>
        this.values.create({ tenantId, listKey: key, code: v.code, labelDe: v.labelDe, labelFr: v.labelFr, labelIt: v.labelIt, labelEn: v.labelEn, sortOrder: i + 1, enabled: true }),
      ),
    );
  }
}

function assertKey(key: string): SelectionListKey {
  if (!(SELECTION_LIST_KEYS as string[]).includes(key)) throw new NotFoundException(`Die Auswahlliste «${key}» gibt es nicht.`);
  return key as SelectionListKey;
}

function defaults(key: SelectionListKey): SelectionListValueDto[] {
  return SELECTION_LIST_DEFAULTS[key].map((v, i) => ({ ...v, enabled: true, sortOrder: i + 1, builtIn: true }));
}

function toDto(key: SelectionListKey, row: SelectionListValueEntity): SelectionListValueDto {
  return {
    code: row.code,
    labelDe: row.labelDe,
    labelFr: row.labelFr ?? null,
    labelIt: row.labelIt ?? null,
    labelEn: row.labelEn ?? null,
    enabled: Boolean(row.enabled),
    sortOrder: row.sortOrder,
    builtIn: SELECTION_LIST_DEFAULTS[key].some((v) => v.code === row.code),
  };
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** «Projekt sistiert» → `projekt_sistiert`, shortened to the column and made unique with a number. */
export function uniqueCode(label: string, taken: string[], maxLength: number): string {
  const base =
    label
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'wert';
  let code = base.slice(0, maxLength).replace(/_+$/, '');
  for (let n = 2; taken.includes(code); n++) {
    const suffix = `_${n}`;
    code = base.slice(0, maxLength - suffix.length).replace(/_+$/, '') + suffix;
  }
  return code;
}
