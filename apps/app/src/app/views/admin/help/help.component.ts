import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { HELP_TOPICS, helpStepKeys } from '../../../core/help/help-topics';
import { saveBlob, SettingsFacade } from '../../../core/settings/settings.facade';

/**
 * Online-Hilfe (B1 12.4, slm 53: «integrierte Online-Hilfe»): every help
 * topic of the application on one page, in the order of the sitemap, with a
 * table of contents; the kontextsensitive help of the header links here
 * (`#<topic>`, the router scrolls to it: `anchorScrolling` in app.config.ts). The Benutzerhandbuch as PDF (erweiterte Konfiguration 5.28)
 * is offered for download when one is stored.
 */
@Component({
  selector: 'app-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  styleUrl: './help.component.scss',
  template: `
    <div class="slim-page ohelp">
      <div class="slim-page__header">
        <div>
          <h1 class="slim-page__title" data-testid="ohelp-title">{{ 'help.ui.manual_title' | translate }}</h1>
          <p class="slim-page__subtitle">{{ 'help.ui.manual_subtitle' | translate }}</p>
        </div>
        <div class="slim-page__actions">
          @if (manual(); as m) {
            <button type="button" class="slim-btn slim-btn--secondary" data-testid="ohelp-pdf" (click)="downloadManual()">
              <span class="slim-btn__label">{{ 'help.ui.pdf' | translate }}</span>
            </button>
          }
        </div>
      </div>
      @if (!manual()) {
        <p class="slim-text--muted slim-u-mb-4" data-testid="ohelp-no-pdf">{{ 'help.ui.no_pdf' | translate }}</p>
      }

      <div class="ohelp__layout">
        <nav class="slim-card ohelp__toc" [attr.aria-label]="'help.ui.toc' | translate" id="ohelp-toc">
          <div class="slim-card__header"><h2 class="slim-card__title">{{ 'help.ui.toc' | translate }}</h2></div>
          <ol class="ohelp__toc-list">
            @for (topic of topics; track topic.id) {
              <li>
                <a class="ohelp__toc-link" [routerLink]="route" [fragment]="topic.id" data-testid="ohelp-toc-link">{{ 'help.topics.' + topic.id + '.title' | translate }}</a>
              </li>
            }
          </ol>
        </nav>

        <div class="ohelp__topics">
          @for (topic of topics; track topic.id) {
            <section class="slim-card ohelp__topic" [id]="topic.id" data-testid="ohelp-topic">
              <div class="slim-card__header">
                <h2 class="slim-card__title">{{ 'help.topics.' + topic.id + '.title' | translate }}</h2>
              </div>
              <div class="slim-card__body">
                <p class="ohelp__intro">{{ 'help.topics.' + topic.id + '.intro' | translate }}</p>
                <ul class="ohelp__steps">
                  @for (key of stepKeys(topic); track key) {
                    <li>{{ key | translate }}</li>
                  }
                </ul>
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
})
export class HelpComponent extends ComponentBase {
  private readonly settings = inject(SettingsFacade);

  protected readonly topics = HELP_TOPICS;
  protected readonly stepKeys = helpStepKeys;
  protected readonly route = APP_ROUTES.admin.help;
  protected readonly manual = this.settings.manual;

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    void this.settings.load();
  }

  protected async downloadManual(): Promise<void> {
    const manual = this.manual();
    if (!manual) return;
    const blob = await this.settings.manualFile();
    if (blob) saveBlob(blob, manual.fileName);
  }
}
