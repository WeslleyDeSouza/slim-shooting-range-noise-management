import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type { AreaResultDto } from '@ui-slim/apiClient';

interface Group {
  key: 'favorites' | 'others';
  label: string;
  items: AreaResultDto[];
}

let nextId = 0;

/**
 * Schiessplatz-Wechsler of the sidebar: a compact card with the selected
 * range (name + Koordinationsabschnitt-Nr.), a favourite star and a chevron.
 * A click opens a popover with a search field, the favourites and the other
 * ranges the user may open (the list comes from the API, already scoped by
 * the user's rights). Keyboard: arrows, Enter, Escape; the search is
 * focused on open and the focus returns to the trigger on close. The star
 * only toggles the favourite — it never opens the popover or navigates.
 */
@Component({
  selector: 'app-area-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  styleUrl: './area-switcher.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close(true)',
    '(window:resize)': 'reposition()',
  },
  template: `
    <div class="area-switch" [class.area-switch--open]="open()" [class.area-switch--empty]="!selected()">
      <button
        #trigger
        type="button"
        class="area-switch__trigger"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        [attr.title]="'shell.area_switch' | translate"
        data-testid="area-switch-trigger"
        (click)="toggle()"
      >
        @if (selected(); as a) {
          <span class="area-switch__name">{{ a.name }}</span>
          <span class="area-switch__no">{{ a.coordinationSectionNo }}</span>
        } @else {
          <span class="area-switch__placeholder">
            <svg class="area-switch__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            {{ 'shell.area_pick' | translate }}
          </span>
        }
        <svg class="area-switch__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      @if (selected(); as a) {
        <button
          type="button"
          class="area-switch__star"
          [class.area-switch__star--on]="isFavorite(a.id)"
          [attr.aria-pressed]="isFavorite(a.id)"
          [attr.aria-label]="((isFavorite(a.id) ? 'shell.bookmark_remove' : 'shell.bookmark_add') | translate) + ': ' + a.name"
          [attr.title]="(isFavorite(a.id) ? 'shell.bookmark_remove' : 'shell.bookmark_add') | translate"
          data-testid="area-switch-star"
          (click)="onStar($event, a.id)"
        >
          <svg viewBox="0 0 16 16" [attr.fill]="isFavorite(a.id) ? 'currentColor' : 'none'" aria-hidden="true">
            <path [attr.d]="star" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </button>
      }

      @if (open()) {
        <div
          class="area-switch__panel"
          role="dialog"
          [id]="panelId"
          [attr.aria-label]="'shell.area_switch' | translate"
          [style.top.px]="panelTop()"
          [style.left.px]="panelLeft()"
          [style.width.px]="panelWidth()"
          [style.max-height.px]="panelMaxHeight()"
          data-testid="area-switch-panel"
        >
          <div class="slim-search area-switch__search">
            <svg class="slim-search__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" />
            </svg>
            <input
              #search
              class="slim-input slim-search__input area-switch__input"
              type="search"
              role="combobox"
              autocomplete="off"
              aria-autocomplete="list"
              [attr.aria-expanded]="true"
              [attr.aria-controls]="listId"
              [attr.aria-activedescendant]="activeId()"
              [attr.aria-label]="'shell.area_search' | translate"
              [placeholder]="'shell.area_search' | translate"
              [value]="query()"
              (input)="onQuery($any($event.target).value)"
              (keydown)="onKeydown($event)"
              data-testid="area-switch-search"
            />
          </div>
          <ul class="area-switch__list" role="listbox" [id]="listId" [attr.aria-label]="'shell.area_group' | translate">
            @for (group of groups(); track group.key) {
              <li class="area-switch__heading" role="presentation">{{ group.label | translate }}</li>
              @for (a of group.items; track a.id) {
                <!-- Combobox pattern: the options are reached via aria-activedescendant and the
                     arrow keys on the search input, so they are deliberately not focusable. -->
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
                <li
                  role="option"
                  class="area-switch__option"
                  [id]="optionId(a.id)"
                  [class.area-switch__option--active]="activeIndex() === indexOf(a.id)"
                  [class.area-switch__option--selected]="a.id === selected()?.id"
                  [attr.aria-selected]="a.id === selected()?.id"
                  [attr.data-testid]="'area-switch-option'"
                  (mousemove)="activeIndex.set(indexOf(a.id))"
                  (click)="choose(a.id)"
                >
                  <span class="area-switch__option-text">
                    <span class="area-switch__name">{{ a.name }}</span>
                    <span class="area-switch__no">{{ a.coordinationSectionNo }}</span>
                  </span>
                  @if (a.id === selected()?.id) {
                    <svg class="area-switch__check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span class="slim-u-sr-only">{{ 'shell.area_selected' | translate }}</span>
                  }
                </li>
              }
            } @empty {
              <li class="area-switch__empty" role="presentation" data-testid="area-switch-empty">
                {{ 'shell.area_no_match' | translate: { q: query() } }}
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class AreaSwitcherComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Ranges the user may open (scoped by the API). */
  readonly areas = input.required<AreaResultDto[]>();
  readonly selected = input<AreaResultDto | null>(null);
  readonly favoriteIds = input<string[]>([]);

  /** A range was chosen in the popover. */
  readonly pick = output<string>();
  /** The star of the selected range was pressed. */
  readonly favoriteToggle = output<string>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly panelId = `area-switch-panel-${nextId++}`;
  protected readonly listId = `${this.panelId}-list`;
  protected readonly star = 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8z';

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly panelTop = signal(0);
  protected readonly panelLeft = signal(0);
  protected readonly panelWidth = signal(240);
  protected readonly panelMaxHeight = signal(420);

  /** Favourites first, then the others; each filtered by name or number, empty groups hidden. */
  protected readonly groups = computed<Group[]>(() => {
    const q = this.query().trim().toLowerCase();
    const favorites = new Set(this.favoriteIds());
    const matches = (a: AreaResultDto) =>
      !q || a.name.toLowerCase().includes(q) || a.coordinationSectionNo.toLowerCase().includes(q);
    const list = this.areas().filter(matches);
    const groups: Group[] = [
      { key: 'favorites', label: 'shell.area_favorites', items: list.filter((a) => favorites.has(a.id)) },
      { key: 'others', label: 'shell.area_others', items: list.filter((a) => !favorites.has(a.id)) },
    ];
    return groups.filter((g) => g.items.length);
  });
  /** Flat order of the visible options (keyboard navigation). */
  protected readonly flat = computed(() => this.groups().flatMap((g) => g.items));
  protected readonly activeId = computed(() => {
    const a = this.flat()[this.activeIndex()];
    return a ? this.optionId(a.id) : null;
  });

  protected isFavorite(id: string): boolean {
    return this.favoriteIds().includes(id);
  }

  protected optionId(id: string): string {
    return `${this.listId}-${id}`;
  }

  protected indexOf(id: string): number {
    return this.flat().findIndex((a) => a.id === id);
  }

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
    } else {
      this.query.set('');
      const selected = this.selected();
      // Active option = the selected range, in the popover's order (favourites first).
      this.activeIndex.set(selected ? Math.max(0, this.flat().findIndex((a) => a.id === selected.id)) : 0);
      this.reposition();
      this.open.set(true);
      // The input exists after the next change detection.
      setTimeout(() => this.search()?.nativeElement.focus(), 0);
    }
  }

  protected close(restoreFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  protected onStar(event: Event, id: string): void {
    event.stopPropagation();
    this.favoriteToggle.emit(id);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(this.flat().length ? 0 : -1);
  }

  protected choose(id: string): void {
    this.pick.emit(id);
    this.close(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.flat().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() + 1 + count) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        break;
      case 'Home':
        if (count) this.activeIndex.set(0);
        break;
      case 'End':
        if (count) this.activeIndex.set(count - 1);
        break;
      case 'Enter': {
        event.preventDefault();
        const a = this.flat()[this.activeIndex()];
        if (a) this.choose(a.id);
        break;
      }
      case 'Tab':
        this.close(false);
        break;
    }
    this.scrollActiveIntoView();
  }

  /**
   * Fixed position under the trigger so the popover overlays the navigation
   * instead of pushing it down, and is never clipped by the scrolling sidebar.
   */
  protected reposition(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const gap = 6;
    const margin = 12;
    this.panelTop.set(rect.bottom + gap);
    this.panelLeft.set(Math.max(margin, rect.left));
    this.panelWidth.set(Math.max(240, Math.min(rect.width, window.innerWidth - 2 * margin)));
    this.panelMaxHeight.set(Math.max(180, Math.min(440, window.innerHeight - rect.bottom - gap - margin)));
  }

  protected onDocumentClick(event: Event): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private scrollActiveIntoView(): void {
    const id = this.activeId();
    if (!id) return;
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }), 0);
  }
}
