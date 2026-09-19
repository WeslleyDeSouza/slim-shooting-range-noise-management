import { Injectable, computed, inject, Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService, AppAccessDto } from '@ui-slim/apiClient';
import { SignalStore } from '../store/signal-store';

/** Access level of the galaxy `app_role_right` (generated model). */
export type AppAccess = AppAccessDto['access'];

/** Rights that allow a mutation: everything but plain `read` (B1 8.1.2 «W»). */
const WRITE: readonly AppAccess[] = ['write', 'delete', 'root'];

interface AccessState {
  /** appId → best access of the signed-in user in the current tenant. */
  access: Record<number, AppAccess>;
  loaded: boolean;
  loading: boolean;
}

/**
 * App rights of the signed-in user for the current tenant (B1 8.1.2), from
 * `GET admin/access` (`AccessModule` of the API: the user's active roles ×
 * `app_role_right`, best right per app). The shell hides menu entries the
 * user may not open and the masks switch to read-only where the right is
 * `read` — the API guards stay the authority, this is convenience only.
 * Reloaded on every DATA_RELOAD (tenant switch) through the layout's `getData()`.
 */
@Injectable({ providedIn: 'root' })
export class AccessFacade extends SignalStore<AccessState> {
  private readonly api = inject(AdminAccessService);

  readonly access = this.select((s) => s.access);
  readonly appIds = this.select((s) => Object.keys(s.access).map(Number));
  readonly loaded = this.select((s) => s.loaded);

  constructor() {
    super({ access: {}, loaded: false, loading: false });
  }

  /** `true` while the rights are unknown (nothing hidden before the first answer). */
  can(appId: number): Signal<boolean> {
    return computed(() => !this.loaded() || appId in this.access());
  }

  /**
   * Write right on an app. Unlike `can()` this is `false` until the rights
   * are known: a mask opens read-only and unlocks, never the other way round.
   */
  canWrite(appId: number): Signal<boolean> {
    return computed(() => WRITE.includes(this.access()[appId]));
  }

  async load(): Promise<void> {
    if (this.snapshot().loading) return;
    this.patch({ loading: true });
    try {
      const rows = await firstValueFrom(this.api.adminAccessMine());
      const access: Record<number, AppAccess> = {};
      for (const row of rows) access[row.appId] = row.access;
      this.patch({ access, loaded: true, loading: false });
    } catch {
      // Unknown rights: keep the menu complete, the API answers 403 where needed.
      this.patch({ loading: false });
    }
  }

  /** Forget the rights (sign-out / tenant switch) so the next load starts clean. */
  reset(): void {
    this.patch({ access: {}, loaded: false, loading: false });
  }
}
