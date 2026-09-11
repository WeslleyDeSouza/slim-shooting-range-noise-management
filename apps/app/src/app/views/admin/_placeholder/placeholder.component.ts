import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '@app-galaxy/translate-ui';

export interface PlaceholderData {
  /** Translation key of the page title (common section, e.g. `menu.caliber`). */
  title: string;
  /** Translation keys of the parent breadcrumb items. */
  crumbs?: string[];
}

/**
 * Stand-in for sitemap entries that are not built yet
 * (docs/architecture/sitemap.md). Keeps navigation and breadcrumbs real.
 */
@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="slim-page">
      <ol class="slim-breadcrumbs">
        <li class="slim-breadcrumbs__item"><a routerLink="/">{{ 'shell.home' | translate }}</a></li>
        @for (crumb of data().crumbs ?? []; track crumb) {
          <li class="slim-breadcrumbs__item">{{ crumb | translate }}</li>
        }
        <li class="slim-breadcrumbs__item slim-breadcrumbs__item--current">{{ data().title | translate }}</li>
      </ol>
      <div class="slim-page__header">
        <h1 class="slim-page__title">{{ data().title | translate }}</h1>
      </div>
      <section class="slim-card">
        <div class="slim-empty">
          <svg class="slim-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 14h8"/></svg>
          <div class="slim-empty__title">{{ 'placeholder.title' | translate }}</div>
          <p class="slim-empty__text">{{ 'placeholder.text' | translate }}</p>
        </div>
      </section>
    </div>
  `,
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly data = toSignal(
    this.route.data.pipe(map((d) => d as unknown as PlaceholderData)),
    { initialValue: { title: 'placeholder.title' } as PlaceholderData },
  );
}
