import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { APP_ROUTES } from '@slim/shared';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import type { AppEntity } from '@ui-slim/apiClient';
import { AppAutofocusDirective } from '../../../_common/autofocus.directive';
import { AppsFacade } from '../_data/apps.facade';

const I18N = 'admin.apps';
const OVERVIEW = APP_ROUTES.admin.dataManagement.apps;

/**
 * Katalog-Formular (`/admin/apps/create` bzw. `edit/:id`): Titel als
 * i18n-Key, Pfad, roleKey (Berechtigungsvokabular), Kategorie, Reihenfolge
 * und der Sichtbarkeits-Schalter (`hiddenInMenu` invertiert).
 */
@Component({
  selector: 'app-elo-app-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AppAutofocusDirective],
  templateUrl: './app-form.component.html',
  styleUrl: './app-form.component.scss',
})
export class EloAppFormComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly facade = inject(AppsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly current = signal<AppEntity | null>(null);
  readonly isEdit = computed(() => !!this.current());

  private submitted = false;

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    path: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\/.+/)],
    }),
    roleKey: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl<number>(1, { nonNullable: true }),
    orderIdx: new FormControl<number>(1, { nonNullable: true }),
    icon: new FormControl('', { nonNullable: true }),
    visible: new FormControl(true, { nonNullable: true }),
  });

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    await this.facade.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    const app = await this.facade.get(Number(id));
    if (!app) {
      void this.router.navigateByUrl(OVERVIEW);
      return;
    }
    this.current.set(app);
    this.form.patchValue({
      title: app.title,
      path: app.path ?? '',
      roleKey: app.roleKey ?? '',
      categoryId: app.categoryId,
      orderIdx: app.orderIdx,
      icon: app.icon ?? '',
      visible: !app.hiddenInMenu,
    });
  }

  invalid(field: 'title' | 'path'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const body: Partial<AppEntity> = {
      title: value.title.trim(),
      path: value.path.trim(),
      roleKey: value.roleKey.trim() || undefined,
      categoryId: Number(value.categoryId),
      orderIdx: Number(value.orderIdx) || 1,
      icon: value.icon.trim() || undefined,
      hiddenInMenu: !value.visible,
      domain: this.current()?.domain ?? 'business',
    };

    const current = this.current();
    const ok = current
      ? await this.facade.update(current.appId, body)
      : await this.facade.create(body);
    this.saving.set(false);
    if (ok) {
      void this.router.navigateByUrl(OVERVIEW);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl(OVERVIEW);
  }
}
