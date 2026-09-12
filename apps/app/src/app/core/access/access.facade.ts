import { Injectable, computed, inject, Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_STORE } from '@app-galaxy/auth-ui';
import { AdminAppsTenantService } from '@ui-slim/apiClient';
import { SignalStore } from '../store/signal-store';

interface AccessState {
  /** galaxy app ids (`app_app.appId`) the signed-in user has any right for (R/W/root). */
  appIds: number[];
  loaded: boolean;
  loading: boolean;
}

/**
 * App rights of the signed-in user for the current tenant (B1 8.1.2): the
 * galaxy `GET admin/apps/app/user/:userId` lists every app a role of the
 * user grants a right for; apps without a right («X») are missing. The
 * shell hides menu entries the user may not open — the API guards stay the
 * authority (`AppsRolesGuard`), this is convenience only. Reloaded on every
 * DATA_RELOAD (tenant switch) through the layout's `getData()`.
 */
@Injectable({ providedIn: 'root' })
export class AccessFacade extends SignalStore<AccessState> {
  private readonly apps = inject(AdminAppsTenantService);
  private readonly session = inject(AUTH_STORE.SessionStore);

  readonly appIds = this.select((s) => s.appIds);
  readonly loaded = this.select((s) => s.loaded);

  constructor() {
    super({ appIds: [], loaded: false, loading: false });
  }

  /** `true` while the rights are unknown (nothing hidden before the first answer). */
  can(appId: number): Signal<boolean> {
    return computed(() => !this.loaded() || this.appIds().includes(appId));
  }

  async load(): Promise<void> {
    const userId = String(
      (this.session as unknown as { changed(): { user?: { userId?: string } } | null }).changed()?.user?.userId ?? '',
    );
    if (!userId || this.snapshot().loading) return;
    this.patch({ loading: true });
    try {
      const apps = await firstValueFrom(this.apps.adminAppsGetUserApps({ userId }));
      this.patch({ appIds: apps.map((a) => a.appId), loaded: true, loading: false });
    } catch {
      // Unknown rights: keep the menu complete, the API answers 403 where needed.
      this.patch({ loading: false });
    }
  }

  /** Forget the rights (sign-out / tenant switch) so the next load starts clean. */
  reset(): void {
    this.patch({ appIds: [], loaded: false, loading: false });
  }
}
