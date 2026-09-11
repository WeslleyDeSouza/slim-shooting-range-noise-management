import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import {
  AdminAppsCategoryService,
  AdminAppsTenantService,
} from '@ui-slim/apiClient';
import type { AppCategoryEntity, AppEntity } from '@ui-slim/apiClient';

/**
 * Signals facade of the app catalog (`/admin/apps`): the `app_app` rows
 * that drive menu visibility and the permission vocabulary, plus their
 * categories — entirely on the generated Galaxy clients.
 */
@Injectable()
export class AppsFacade {
  private readonly api = inject(AdminAppsTenantService);
  private readonly categoryApi = inject(AdminAppsCategoryService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly apps = signal<AppEntity[]>([]);
  readonly categories = signal<AppCategoryEntity[]>([]);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [apps, categories] = await Promise.all([
        firstValueFrom(this.api.adminAppsGetApps()),
        firstValueFrom(this.categoryApi.adminAppCategoryGetCategories()),
      ]);
      this.apps.set(((apps as AppEntity[]) ?? []).slice().sort((a, b) =>
        a.categoryId - b.categoryId || a.orderIdx - b.orderIdx,
      ));
      this.categories.set((categories as AppCategoryEntity[]) ?? []);
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load')));
    } finally {
      this.loading.set(false);
    }
  }

  async get(appId: number): Promise<AppEntity | null> {
    try {
      const app = await firstValueFrom(this.api.adminAppsGetAppById({ appId }));
      return (app as AppEntity) ?? null;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load_one')));
      return null;
    }
  }

  async create(body: Partial<AppEntity>): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.adminAppsCreateApp({ body: body as never }));
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_create')));
      return false;
    }
  }

  async update(appId: number, body: Partial<AppEntity>): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.adminAppsUpdateApp({ appId, body: body as never }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_save')));
      return false;
    }
  }

  async remove(appId: number): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.adminAppsDeleteApp({ appId }));
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_delete')));
      return false;
    }
  }

  categoryTitle(categoryId: number): string {
    const category = this.categories().find(
      (entry) => entry.categoryId === categoryId,
    );
    const title = category?.title ?? `${categoryId}`;
    return title.includes('.') ? (this.translate.translate(title) ?? title) : title;
  }

  /** i18n lookup with the key itself as last-resort fallback. */
  private t(key: string): string {
    return this.translate.translate(`admin.apps.${key}`) ?? key;
  }

  private messageOf(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
}
