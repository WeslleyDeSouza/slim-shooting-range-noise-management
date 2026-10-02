import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { GENERAL_HELP_TOPIC, helpStepKeys, helpTopicFor } from '../../../core/help/help-topics';

/**
 * Kontextsensitive Hilfe (B1 12.4, slm 53): the help of the page that is
 * open, in a side panel. Opened with the question mark of the header or F1
 * (admin layout). The texts are already loaded (locale section `help`), so
 * the panel shows without a request. Links to the whole online help and to
 * the Benutzerhandbuch as PDF.
 */
@Component({
  selector: 'app-help-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  styleUrl: './help-drawer.component.scss',
  template: `
    <div class="slim-sheet slim-sheet--open help" role="dialog" aria-modal="true" aria-labelledby="help-title" data-testid="help-drawer">
      <button type="button" class="slim-sheet__backdrop" [attr.aria-label]="'common.close' | translate" (click)="closed.emit()"></button>
      <div class="slim-sheet__panel help__panel">
        <header class="slim-sheet__header">
          <div class="slim-sheet__title" id="help-title">{{ 'help.ui.title' | translate }}</div>
          <button type="button" class="slim-sheet__close" data-testid="help-close" [attr.aria-label]="'common.close' | translate" (click)="closed.emit()">×</button>
        </header>
        <div class="slim-sheet__body help__body">
          <section [attr.data-topic]="topic().id" data-testid="help-topic">
            <h2 class="help__topic">{{ 'help.topics.' + topic().id + '.title' | translate }}</h2>
            <p class="help__intro">{{ 'help.topics.' + topic().id + '.intro' | translate }}</p>
            <ul class="help__steps">
              @for (key of steps(); track key) {
                <li>{{ key | translate }}</li>
              }
            </ul>
          </section>

          @if (topic().id !== general.id) {
            <section class="help__general" data-testid="help-general">
              <h3 class="help__sub">{{ 'help.topics.general.title' | translate }}</h3>
              <ul class="help__steps">
                @for (key of generalSteps; track key) {
                  <li>{{ key | translate }}</li>
                }
              </ul>
            </section>
          }
        </div>
        <footer class="slim-sheet__footer help__footer">
          <a class="slim-btn slim-btn--secondary" data-testid="help-online" [routerLink]="onlineHelp" [fragment]="topic().id" (click)="closed.emit()">
            {{ 'help.ui.open_manual' | translate }}
          </a>
          @if (hasManual()) {
            <button type="button" class="slim-btn" data-testid="help-pdf" (click)="manual.emit()">{{ 'help.ui.pdf' | translate }}</button>
          }
        </footer>
      </div>
    </div>
  `,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class HelpDrawerComponent {
  /** Address of the page the help is for (router url). */
  readonly url = input.required<string>();
  /** A Benutzerhandbuch (PDF) is stored in the erweiterte Konfiguration. */
  readonly hasManual = input(false);

  readonly closed = output<void>();
  /** The user asks for the PDF. */
  readonly manual = output<void>();

  protected readonly general = GENERAL_HELP_TOPIC;
  protected readonly generalSteps = helpStepKeys(GENERAL_HELP_TOPIC);
  protected readonly onlineHelp = APP_ROUTES.admin.help;
  protected readonly topic = computed(() => helpTopicFor(this.url()));
  protected readonly steps = computed(() => helpStepKeys(this.topic()));
}
