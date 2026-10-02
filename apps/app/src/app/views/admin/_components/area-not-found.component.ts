import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';

/**
 * Shown by the context bars of a Schiessplatz (`/admin/area/:id/*`,
 * `/admin/data-management/area/:areaId/*`) when the id of the address is not
 * among the Schiessplätze of the user: unknown, deleted or outside the
 * area scope of the role. The pages of the Schiessplatz are not rendered.
 */
@Component({
  selector: 'app-area-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="slim-card" data-testid="area-not-found">
      <div class="slim-empty">
        <div class="slim-empty__title">{{ 'common.area_not_found.title' | translate }}</div>
        <p class="slim-empty__text">{{ 'common.area_not_found.text' | translate }}</p>
        <a class="slim-btn slim-btn--primary" data-testid="area-not-found-back" [routerLink]="back()">
          {{ 'common.area_not_found.back' | translate }}
        </a>
      </div>
    </section>
  `,
})
export class AreaNotFoundComponent {
  /** Link of the overview the user goes back to. */
  readonly back = input.required<string>();
}
