import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminDataWeaponsService,
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
} from '@ui-slim/apiClient';
import { apiErrorBody, apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

/** The four lists of Datenverwaltung › Waffen (B1 5.22–5.25), keyed like the API routes. */
export type WeaponKind = 'combination' | 'caliber' | 'weapon' | 'category';

/** A row of any of the four lists. */
export type WeaponRecord = WeaponCombinationDto | CaliberDto | WeaponDto | WeaponCategoryDto;

/** Body of a create / update per kind (generated DTOs). */
export interface WeaponInputByKind {
  combination: WeaponCombinationInputDto;
  caliber: CaliberInputDto;
  weapon: WeaponInputDto;
  category: WeaponCategoryInputDto;
}
export interface WeaponUpdateByKind {
  combination: WeaponCombinationUpdateDto;
  caliber: CaliberUpdateDto;
  weapon: WeaponUpdateDto;
  category: WeaponCategoryUpdateDto;
}

/** What the API answers with 409 when a record is still referenced. */
export interface InUseError {
  kind: WeaponKind;
  inUse: number;
}

interface DataWeaponsState {
  data: WeaponMasterDataDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Set when the last delete was refused because the record is in use. */
  inUse: InUseError | null;
}

const EMPTY: WeaponMasterDataDto = { categories: [], weapons: [], calibers: [], combinations: [], sonarmsOptions: [] };

/**
 * Datenverwaltung › Waffen (B1 5.22–5.25): the four master-data lists and
 * their CRUD over the generated `AdminDataWeaponsService`. One load brings
 * everything (the lists are small and reference each other); every
 * mutation reloads so counts and «Verwendung» stay right.
 */
@Injectable({ providedIn: 'root' })
export class DataWeaponsFacade extends SignalStore<DataWeaponsState> {
  private readonly api = inject(AdminDataWeaponsService);

  readonly data = this.select((s) => s.data ?? EMPTY);
  readonly loaded = this.select((s) => s.data !== null);
  readonly categories = this.select((s) => s.data?.categories ?? []);
  readonly weapons = this.select((s) => s.data?.weapons ?? []);
  readonly calibers = this.select((s) => s.data?.calibers ?? []);
  readonly combinations = this.select((s) => s.data?.combinations ?? []);
  readonly sonarmsOptions = this.select((s) => s.data?.sonarmsOptions ?? []);
  readonly loading = this.select((s) => s.loading);
  readonly saving = this.select((s) => s.saving);
  readonly error = this.select((s) => s.error);
  readonly inUse = this.select((s) => s.inUse);

  constructor() {
    super({ data: null, loading: false, saving: false, error: null, inUse: null });
  }

  /** Always fetches (ComponentBase `getData()`); concurrent calls are deduplicated. */
  async load(): Promise<void> {
    if (this.snapshot().loading) return;
    this.patch({ loading: true, error: null });
    try {
      const data = await firstValueFrom(this.api.adminDataWeaponsList());
      this.patch({ data, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  /** Rows of one kind. */
  rows(kind: WeaponKind): WeaponRecord[] {
    const d = this.data();
    switch (kind) {
      case 'combination':
        return d.combinations;
      case 'caliber':
        return d.calibers;
      case 'weapon':
        return d.weapons;
      case 'category':
        return d.categories;
    }
  }

  async createRecord<K extends WeaponKind>(kind: K, body: WeaponInputByKind[K]): Promise<WeaponRecord | null> {
    return this.mutate(() => {
      switch (kind) {
        case 'combination':
          return firstValueFrom(this.api.adminDataWeaponsCreateCombination({ body: body as WeaponCombinationInputDto }));
        case 'caliber':
          return firstValueFrom(this.api.adminDataWeaponsCreateCaliber({ body: body as CaliberInputDto }));
        case 'weapon':
          return firstValueFrom(this.api.adminDataWeaponsCreateWeapon({ body: body as WeaponInputDto }));
        default:
          return firstValueFrom(this.api.adminDataWeaponsCreateCategory({ body: body as WeaponCategoryInputDto }));
      }
    });
  }

  async updateRecord<K extends WeaponKind>(kind: K, id: string, body: WeaponUpdateByKind[K]): Promise<WeaponRecord | null> {
    return this.mutate(() => {
      switch (kind) {
        case 'combination':
          return firstValueFrom(this.api.adminDataWeaponsUpdateCombination({ id, body: body as WeaponCombinationUpdateDto }));
        case 'caliber':
          return firstValueFrom(this.api.adminDataWeaponsUpdateCaliber({ id, body: body as CaliberUpdateDto }));
        case 'weapon':
          return firstValueFrom(this.api.adminDataWeaponsUpdateWeapon({ id, body: body as WeaponUpdateDto }));
        default:
          return firstValueFrom(this.api.adminDataWeaponsUpdateCategory({ id, body: body as WeaponCategoryUpdateDto }));
      }
    });
  }

  /** Resolves to true when deleted; a 409 «in use» lands in `inUse` (and false), other errors in `error`. */
  async deleteRecord(kind: WeaponKind, id: string): Promise<boolean> {
    this.patch({ saving: true, error: null, inUse: null });
    try {
      switch (kind) {
        case 'combination':
          await firstValueFrom(this.api.adminDataWeaponsDeleteCombination({ id }));
          break;
        case 'caliber':
          await firstValueFrom(this.api.adminDataWeaponsDeleteCaliber({ id }));
          break;
        case 'weapon':
          await firstValueFrom(this.api.adminDataWeaponsDeleteWeapon({ id }));
          break;
        default:
          await firstValueFrom(this.api.adminDataWeaponsDeleteCategory({ id }));
      }
      await this.reload();
      this.patch({ saving: false });
      return true;
    } catch (error) {
      const body = apiErrorBody(error) as { kind?: WeaponKind; inUse?: number } | string | null;
      if ((error as { status?: number })?.status === 409 && body && typeof body === 'object' && body.inUse !== undefined) {
        this.patch({ saving: false, inUse: { kind: body.kind ?? kind, inUse: body.inUse } });
      } else {
        this.patch({ saving: false, error: apiErrorMessage(error) });
      }
      return false;
    }
  }

  /** XLSX of the four lists (B1 5.22–5.25 «Exportieren»); the caller triggers the download. */
  async exportXlsx(lang: string): Promise<Blob | null> {
    try {
      return await firstValueFrom(this.api.adminDataWeaponsExport({ lang }));
    } catch (error) {
      this.patch({ error: apiErrorMessage(error) });
      return null;
    }
  }

  clearError(): void {
    this.patch({ error: null, inUse: null });
  }

  private async mutate(run: () => Promise<WeaponRecord>): Promise<WeaponRecord | null> {
    this.patch({ saving: true, error: null, inUse: null });
    try {
      const saved = await run();
      await this.reload();
      this.patch({ saving: false });
      return saved;
    } catch (error) {
      this.patch({ saving: false, error: apiErrorMessage(error) });
      return null;
    }
  }

  private async reload(): Promise<void> {
    const data = await firstValueFrom(this.api.adminDataWeaponsList());
    this.patch({ data });
  }
}
