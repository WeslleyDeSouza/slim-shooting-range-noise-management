import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { MapPoint, MapViewerComponent } from '@ui-slim/map';
import { StatusPillComponent } from '../../../../common/status-pill.component';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';

/**
 * Vollansicht of the map of one Schiessplatz (`slm 2`, B1 5.10 / 5.12: «Die
 * Karte soll bei Bedarf als Vollansicht in einem separaten Tab geöffnet
 * werden können»): the GIS-Kartenviewer over the whole page with the
 * Anlagenteile and Empfangspunkte of a Zustand (`?state=<id>`, default the
 * current one). A chosen Empfangspunkt shows its Grenzwert and
 * Beurteilungspegel nach Anhang 9 / 7 next to the map.
 */
@Component({
  selector: 'app-area-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, DecimalPipe, MapViewerComponent, StatusPillComponent],
  styleUrl: './area-map.component.scss',
  template: `
    <div class="slim-page amap">
      <div class="slim-page__header">
        <div>
          <h1 class="slim-page__title" data-testid="amap-title">{{ 'map_page.title' | translate: { area: title() || '…' } }}</h1>
          @if (calculation(); as c) {
            <p class="slim-page__subtitle" data-testid="amap-state">{{ 'map_page.state' | translate: { name: c.name } }}</p>
          }
        </div>
        <div class="slim-page__actions">
          <a class="slim-btn slim-btn--secondary" [routerLink]="detailsLink()" data-testid="amap-back">
            <span class="slim-btn__label">{{ 'map_page.back' | translate }}</span>
          </a>
        </div>
      </div>

      @if (error(); as message) {
        <div class="slim-alert slim-alert--danger" data-testid="amap-error"><div class="slim-alert__body">{{ message | translate }}</div></div>
      }

      @if (hasCoordinates()) {
        <div class="amap__layout">
          <slim-map-viewer
            class="amap__map"
            data-testid="amap-map"
            pinTestId="amap-pin"
            [points]="points()"
            [plantParts]="plantParts()"
            [selectedId]="selectedId()"
            [title]="title()"
            (pointSelected)="selectedId.set($event)"
          />
          <aside class="slim-card amap__info" data-testid="amap-info">
            @if (selected(); as r) {
              <div class="slim-card__header">
                <h2 class="slim-card__title">{{ 'details.receiver.title' | translate: { code: r.code } }}</h2>
                <app-status-pill [status]="r.state" />
              </div>
              <div class="slim-card__body">
                <p class="slim-text--muted amap__address">{{ r.address }} · ES {{ r.sensitivityLevel }}</p>
                <ul class="slim-list slim-list--divided">
                  @for (row of r.rows; track row.annex + row.limitKind) {
                    @if (row.applicable) {
                      <li class="slim-list__item amap__row" data-testid="amap-row">
                        <span class="slim-list__content">
                          <span class="slim-list__title">{{ 'details.annex_' + row.annex | translate }}</span>
                          <span class="slim-list__meta">{{ 'details.' + row.limitKind | translate }} {{ row.limit }} dB</span>
                        </span>
                        <span class="slim-list__trailing amap__level">{{ row.level !== null ? (row.level | number: '1.1-1') + ' dB' : '–' }}</span>
                      </li>
                    }
                  }
                </ul>
              </div>
            } @else {
              <div class="slim-empty"><div class="slim-empty__text">{{ 'map_page.select_hint' | translate }}</div></div>
            }
          </aside>
        </div>
      } @else {
        <div class="slim-card">
          <div class="slim-empty">
            @if (loading()) {
              <span class="slim-spinner"></span>
            } @else {
              <div class="slim-empty__text" data-testid="amap-empty">{{ 'map_page.no_data' | translate }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AreaMapComponent extends ComponentBase {
  private readonly facade = inject(AssessmentFacade);
  private readonly maps = inject(MapFacade);
  private readonly areas = inject(AreaFacade);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  /** The area id lives on the parent route (`/admin/area/:id/map`). */
  private readonly areaId = toSignal((this.route.parent ?? this.route).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: (this.route.parent ?? this.route).snapshot.paramMap.get('id') ?? '',
  });
  private readonly stateParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('state'))), {
    initialValue: this.route.snapshot.queryParamMap.get('state'),
  });

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly receivers = this.facade.receivers;
  protected readonly plantParts = this.maps.plantParts;
  protected readonly calculation = computed(() => this.facade.assessment()?.calculation ?? null);
  protected readonly hasCoordinates = computed(() => this.receivers().some((r) => r.east !== null && r.north !== null));

  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.receivers().find((r) => r.id === this.selectedId()) ?? null);

  protected readonly points = computed<MapPoint[]>(() =>
    this.receivers().map((r) => ({
      id: r.id,
      code: r.code,
      east: r.east,
      north: r.north,
      state: r.state,
      label: `${r.code}, ${this.translate.translate('details.state.' + r.state) ?? r.state}`,
    })),
  );
  protected readonly title = computed(() => {
    const area = this.areas.byId(this.areaId());
    return area ? `${area.coordinationSectionNo} ${area.name}` : '';
  });
  protected readonly detailsLink = computed(() => APP_ROUTES.admin.area.details(this.areaId()));

  constructor() {
    super();
    // The Anlagenteile belong to the state the assessment answered for.
    effect(() => {
      const areaId = this.areaId();
      const state = this.calculation()?.id ?? null;
      untracked(() => {
        if (areaId && state) void this.maps.load(areaId, state);
      });
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    const areaId = this.areaId();
    const state = this.stateParam();
    if (areaId) void this.facade.load(areaId, state ? { calculationId: state } : {});
  }
}
