import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { AreaSwitcherComponent } from './area-switcher.component';

const area = (id: string, name: string, no: string): AreaResultDto =>
  ({ id, name, coordinationSectionNo: no, sectoralPlanNo: null, enabled: true }) as unknown as AreaResultDto;

const AREAS = [area('a', 'Geissalp', '1104.020'), area('b', 'Thun', '1200.010'), area('c', 'Bière', '1305.001')];

describe('AreaSwitcherComponent', () => {
  let fixture: ComponentFixture<AreaSwitcherComponent>;
  let picks: string[];
  let stars: string[];

  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  const all = (selector: string) => Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
  const search = () => el('[data-testid="area-switch-search"]') as HTMLInputElement;
  const key = (k: string) => {
    search().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaSwitcherComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            translate: (k: string) => k,
            sectionChanged$: new Subject<void>(),
            languageChanged$: new Subject<void>(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreaSwitcherComponent);
    fixture.componentRef.setInput('areas', AREAS);
    fixture.componentRef.setInput('favoriteIds', ['b']);
    picks = [];
    stars = [];
    fixture.componentInstance.pick.subscribe((id) => picks.push(id));
    fixture.componentInstance.favoriteToggle.subscribe((id) => stars.push(id));
    fixture.detectChanges();
  });

  it('shows the placeholder without a selection and the two-line card with one', () => {
    expect(el('[data-testid="area-switch-trigger"]')?.textContent).toContain('shell.area_pick');
    expect(el('[data-testid="area-switch-star"]')).toBeNull();

    fixture.componentRef.setInput('selected', AREAS[0]);
    fixture.detectChanges();
    expect(el('.area-switch__trigger .area-switch__name')?.textContent?.trim()).toBe('Geissalp');
    expect(el('.area-switch__trigger .area-switch__no')?.textContent?.trim()).toBe('1104.020');
    expect(el('[data-testid="area-switch-star"]')).not.toBeNull();
  });

  it('opens the popover with favourites first, marks the selected range and hides empty groups', () => {
    fixture.componentRef.setInput('selected', AREAS[0]);
    fixture.detectChanges();
    el('[data-testid="area-switch-trigger"]')?.click();
    fixture.detectChanges();

    const panel = el('[data-testid="area-switch-panel"]');
    expect(panel).not.toBeNull();
    expect(all('.area-switch__heading').map((h) => h.textContent?.trim())).toEqual(['shell.area_favorites', 'shell.area_others']);
    const options = all('[data-testid="area-switch-option"]');
    expect(options.map((o) => o.querySelector('.area-switch__name')?.textContent?.trim())).toEqual(['Thun', 'Geissalp', 'Bière']);
    // Thun is a favourite and appears only once.
    expect(options.filter((o) => o.textContent?.includes('Thun'))).toHaveLength(1);
    const selected = options.find((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected?.textContent).toContain('Geissalp');
    expect(selected?.querySelector('.area-switch__check')).not.toBeNull();

    fixture.componentRef.setInput('favoriteIds', []);
    fixture.detectChanges();
    expect(all('.area-switch__heading').map((h) => h.textContent?.trim())).toEqual(['shell.area_others']);
  });

  it('searches name and number and says when nothing matches', () => {
    el('[data-testid="area-switch-trigger"]')?.click();
    fixture.detectChanges();
    search().value = '1305';
    search().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(all('[data-testid="area-switch-option"]').map((o) => o.querySelector('.area-switch__name')?.textContent?.trim())).toEqual(['Bière']);

    search().value = 'xyz';
    search().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(all('[data-testid="area-switch-option"]')).toHaveLength(0);
    expect(el('[data-testid="area-switch-empty"]')?.textContent).toContain('shell.area_no_match');
  });

  it('supports arrow keys, Enter and Escape and returns the focus to the trigger', () => {
    fixture.componentRef.setInput('selected', AREAS[0]);
    fixture.detectChanges();
    const trigger = el('[data-testid="area-switch-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    // Active option starts on the selected range (Geissalp, index 1 after the favourite Thun).
    expect(search().getAttribute('aria-activedescendant')).toContain('-a');
    key('ArrowDown');
    expect(search().getAttribute('aria-activedescendant')).toContain('-c');
    key('ArrowUp');
    key('ArrowUp');
    expect(search().getAttribute('aria-activedescendant')).toContain('-b');
    key('Enter');
    expect(picks).toEqual(['b']);
    expect(el('[data-testid="area-switch-panel"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el('[data-testid="area-switch-panel"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('the star only toggles the favourite — no popover, no navigation', () => {
    fixture.componentRef.setInput('selected', AREAS[0]);
    fixture.detectChanges();
    el('[data-testid="area-switch-star"]')?.click();
    fixture.detectChanges();
    expect(stars).toEqual(['a']);
    expect(picks).toEqual([]);
    expect(el('[data-testid="area-switch-panel"]')).toBeNull();
    expect(el('[data-testid="area-switch-star"]')?.getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('favoriteIds', ['a']);
    fixture.detectChanges();
    expect(el('[data-testid="area-switch-star"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('picks an option by click', () => {
    el('[data-testid="area-switch-trigger"]')?.click();
    fixture.detectChanges();
    all('[data-testid="area-switch-option"]')[2].click();
    fixture.detectChanges();
    expect(picks).toEqual(['c']);
    expect(el('[data-testid="area-switch-panel"]')).toBeNull();
  });
});
