import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import { StatusPillComponent } from './status-pill.component';

/** Translations the pill composes; every other key comes back as the key (= missing). */
const TEXTS: Record<string, string> = {
  'status_area.none': 'Keine Daten',
  'status_area.over': 'Überschritten',
  'status_area.none_no_calculation': 'Keine Berechnungsgrundlage',
  'status_area.none_no_usages': 'Keine Nutzungen erfasst',
  'status_area.hint.quota_over': 'Kontingent: über 125 %.',
  'status_area.hint.quota_none': 'Kontingent: keine Ampel.',
  'status_area.hint.noise_none': 'Lärm: keine Ampel.',
  'status_area.hint.no_quota': 'Kombination ohne Kontingent: Soll 0.',
  'status_area.hint.no_usages': 'Keine Nutzungen erfasst.',
  'status_area.hint.no_calculation': 'Kein aktueller Zustand.',
};

describe('StatusPillComponent', () => {
  let fixture: ComponentFixture<StatusPillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusPillComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => TEXTS[key] ?? key,
            sectionChanged$: new Subject<void>(),
            languageChanged$: new Subject<void>(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusPillComponent);
  });

  const badge = () => fixture.nativeElement.querySelector('.slim-badge') as HTMLElement;

  it('says «Keine Daten» precisely when the API names the reason', () => {
    fixture.componentRef.setInput('status', 'none');
    fixture.componentRef.setInput('reason', 'no-calculation');
    fixture.componentRef.setInput('kind', 'noise');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Keine Berechnungsgrundlage');
    expect(badge().getAttribute('title')).toBe('Lärm: keine Ampel. · Kein aktueller Zustand.');

    fixture.componentRef.setInput('reason', 'no-usages');
    fixture.componentRef.setInput('kind', 'quota');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Keine Nutzungen erfasst');
    expect(badge().getAttribute('title')).toBe('Kontingent: keine Ampel. · Keine Nutzungen erfasst.');
  });

  it('keeps the computed red light and explains «no-quota» with the basis in the tooltip', () => {
    fixture.componentRef.setInput('status', 'over');
    fixture.componentRef.setInput('reason', 'no-quota');
    fixture.componentRef.setInput('kind', 'quota');
    fixture.componentRef.setInput('basis', 'Grundlage: Nutzungen 2024–2026');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Überschritten');
    expect(badge().classList.contains('slim-badge--danger')).toBe(true);
    expect(badge().getAttribute('title')).toBe('Kontingent: über 125 %. · Kombination ohne Kontingent: Soll 0. · Grundlage: Nutzungen 2024–2026');
  });

  it('falls back to the generic label and no tooltip without reason and kind (legend)', () => {
    fixture.componentRef.setInput('status', 'none');
    fixture.detectChanges();
    expect(badge().textContent?.trim()).toBe('Keine Daten');
    expect(badge().getAttribute('title')).toBeNull();
  });
});
