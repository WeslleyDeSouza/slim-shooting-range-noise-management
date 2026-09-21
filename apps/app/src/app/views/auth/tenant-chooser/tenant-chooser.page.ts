import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { AuthFacade, Tenant, toAuthError } from '../auth.facade';
import { sanitizeAdminReturnUrl, takeReturnUrl } from '../return-url';

const I18N = 'auth';

/**
 * Tenant chooser («Mandant wählen»), ELO card design. Auto-continues when
 * exactly one tenant is available; otherwise lists the organisations and
 * signs into the picked one, then redirects to the admin (or returnUrl).
 */
@Component({
  selector: 'app-tenant-chooser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './tenant-chooser.page.html',
})
export class TenantChooserPage implements OnInit {
  protected readonly prefix = I18N;
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly selecting = signal<string | null>(null);
  readonly error = signal('');
  readonly success = signal(false);
  readonly autoLogin = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const tenants = await this.auth.listTenants();
      this.tenants.set(tenants);
      if (tenants.length === 1) {
        this.autoLogin.set(true);
        await this.select(tenants[0]);
      }
    } catch (error) {
      this.autoLogin.set(false);
      this.error.set(
        toAuthError(error, {
          network: this.t('error_network'),
          generic: this.t('error_generic'),
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  tenantName(tenant: Tenant): string {
    return this.auth.tenantName(tenant);
  }

  tenantId(tenant: Tenant): string {
    return this.auth.tenantId(tenant);
  }

  initials(tenant: Tenant): string {
    return this.tenantName(tenant)
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  isCurrent(tenant: Tenant): boolean {
    return this.auth.isCurrentTenant(tenant);
  }

  async select(tenant: Tenant): Promise<void> {
    this.error.set('');
    this.selecting.set(this.tenantId(tenant));
    try {
      await this.auth.selectTenant(tenant);
      this.success.set(true);
      // After the login the admin dashboard is the destination — a returnUrl
      // (deep link from the guard, parked by the login page or still in the
      // query string) is honoured only when it points into the admin.
      const returnUrl =
        takeReturnUrl() ??
        sanitizeAdminReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) ??
        APP_ROUTES.admin.home;
      // navigateByUrl keeps the deep link's own query string and fragment.
      setTimeout(() => this.router.navigateByUrl(returnUrl), 400);
    } catch (error) {
      this.error.set(
        toAuthError(error, {
          network: this.t('error_network'),
          generic: this.t('error_generic'),
        }),
      );
    } finally {
      this.selecting.set(null);
    }
  }

  firstName(): string {
    return this.auth.currentUserFirstName();
  }
}
