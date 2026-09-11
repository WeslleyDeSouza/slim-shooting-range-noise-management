import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { AuthFacade, toAuthError } from '../auth.facade';

const I18N = 'auth';

/**
 * Two-factor step between login and tenant-login, own route like the MFE
 * remote had (`/auth/two-fa-login`). Logic from `_mocks/auth/two-fa-login`
 * (verify → session, resend with a 60 s cooldown, verified state before the
 * redirect) in the ELO card design with the 6 code boxes.
 *
 * State comes from the facade's `pendingTwoFactor` (set by the login when
 * the server demands the factor). A deep link with `?email=` still works —
 * resending then goes through the verification-mail endpoint, since no
 * password is around for a fresh sign-in.
 */
@Component({
  selector: 'app-two-fa-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './two-fa-login.page.html',
})
export class TwoFaLoginPage implements OnInit {
  protected readonly prefix = I18N;
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly digits = signal<string[]>(Array(6).fill(''));
  readonly loading = signal(false);
  readonly error = signal('');
  readonly shake = signal(false);
  readonly verified = signal(false);
  readonly resendCooldown = signal(0);
  readonly email = signal('');

  readonly canResend = computed(
    () => this.resendCooldown() === 0 && !this.loading(),
  );

  private cooldown?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const pending = this.auth.pendingTwoFactor();
    const queryEmail = this.route.snapshot.queryParamMap.get('email');
    const email = pending?.email || queryEmail || '';
    if (!email) {
      // Nothing to verify — back to the start of the flow.
      void this.router.navigate(['../login'], { relativeTo: this.route });
      return;
    }
    this.email.set(email);
    this.destroyRef.onDestroy(() => clearInterval(this.cooldown));
  }

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  private triggerShake(): void {
    this.shake.set(false);
    requestAnimationFrame(() => this.shake.set(true));
    setTimeout(() => this.shake.set(false), 600);
  }

  maskedEmail(): string {
    const [local, domain] = this.email().split('@');
    if (!domain) {
      return this.email();
    }
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    // Pasting the whole code into any box fills all six.
    if (value.length > 1) {
      const digits = Array(6).fill('');
      value
        .slice(0, 6)
        .split('')
        .forEach((digit, i) => (digits[i] = digit));
      this.digits.set(digits);
      this.focusBox(Math.min(value.length, 5));
      return;
    }
    this.digits.update((digits) =>
      digits.map((digit, i) => (i === index ? value : digit)),
    );
    if (value && index < 5) {
      this.focusBox(index + 1);
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focusBox(index - 1);
    }
    if (event.key === 'Enter') {
      void this.verify();
    }
  }

  private focusBox(index: number): void {
    setTimeout(() =>
      document
        .querySelectorAll<HTMLInputElement>('.auth-otp input')
        [index]?.focus(),
    );
  }

  async verify(): Promise<void> {
    const code = this.digits().join('');
    if (code.length < 6) {
      this.error.set(this.t('otp_incomplete'));
      this.triggerShake();
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await this.auth.verifyTwoFactor(this.email(), code);
      if (result.resetPasswordRequired && result.userId) {
        // Admin-created account behind 2FA: the server accepted any password
        // and demands an own one — continue in the forced-reset step.
        await this.router.navigateByUrl(
          `/auth/reset/${encodeURIComponent(this.email())}/id/${result.userId}`,
        );
        return;
      }
      this.verified.set(true);
      setTimeout(
        () =>
          this.router.navigate(['../tenant-login'], {
            relativeTo: this.route,
            queryParamsHandling: 'preserve',
          }),
        800,
      );
    } catch (error) {
      this.error.set(
        toAuthError(error, {
          network: this.t('error_network'),
          generic: this.t('otp_invalid'),
        }),
      );
      this.digits.set(Array(6).fill(''));
      this.focusBox(0);
      this.triggerShake();
    } finally {
      this.loading.set(false);
    }
  }

  async resend(): Promise<void> {
    if (!this.canResend()) {
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      if (this.auth.pendingTwoFactor()) {
        // Fresh sign-in → fresh 2FA mail (the server holds the tokens back).
        await this.auth.resendTwoFactorCode();
      } else {
        // Deep link without credentials: the verification mail carries the
        // same token (mock behaviour).
        await this.auth.resendVerification(this.email());
      }
      this.startCooldown();
    } catch (error) {
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

  private startCooldown(): void {
    this.resendCooldown.set(60);
    clearInterval(this.cooldown);
    this.cooldown = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        clearInterval(this.cooldown);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  back(): void {
    this.auth.pendingTwoFactor.set(null);
    void this.router.navigate(['../login'], { relativeTo: this.route });
  }
}
