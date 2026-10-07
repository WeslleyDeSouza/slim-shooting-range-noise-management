import { Component } from '@angular/core';
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
  'status_area.kind.quota': 'Kontingent',
  'status_area.named': '{{kind}}: {{status}}',
};

@Component({
  imports: [StatusPillComponent],
  template: `
    <app-status-pill kind="quota" named panel status="over" reason="no-quota" basis="Grundlage: Nutzungen 2024–2026">
      <a href="#quota" data-testid="link">Zur Übersicht Kontingente</a>
    </app-status-pill>
    <button type="button" data-testid="outside">ausserhalb</button>
  `,
})
class HostComponent {}

describe('StatusPillComponent', () => {
  let fixture: ComponentFixture<StatusPillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusPillComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string, params: Record<string, string> = {}) =>
              (TEXTS[key] ?? key).replace(/{{(\w+)}}/g, (_, name: string) => params[name] ?? ''),
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

  it('stays a plain badge without a panel unless `panel` is set', () => {
    fixture.componentRef.setInput('status', 'over');
    fixture.componentRef.setInput('kind', 'quota');
    fixture.detectChanges();
    expect(badge().tagName).toBe('SPAN');
    badge().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="status-pill-panel"]')).toBeNull();
  });

  describe('named, with panel (context bar of a Schiessplatz)', () => {
    let host: ComponentFixture<HostComponent>;
    const trigger = () => host.nativeElement.querySelector('.slim-badge') as HTMLButtonElement;
    const panel = () => host.nativeElement.querySelector('[data-testid="status-pill-panel"]') as HTMLElement | null;

    beforeEach(() => {
      host = TestBed.createComponent(HostComponent);
      host.detectChanges();
    });

    it('names the kind in the label and is a button without tooltip', () => {
      expect(trigger().tagName).toBe('BUTTON');
      expect(trigger().textContent?.trim()).toBe('Kontingent: Überschritten');
      expect(trigger().classList.contains('slim-badge--danger')).toBe(true);
      expect(trigger().getAttribute('data-reason')).toBe('no-quota');
      expect(trigger().getAttribute('title')).toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(panel()).toBeNull();
    });

    it('opens the explanation with reason, basis and the projected link on a click', () => {
      trigger().click();
      host.detectChanges();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      const lines = Array.from(panel()?.querySelectorAll('p') ?? []).map((p) => p.textContent?.trim());
      expect(lines).toEqual(['Kontingent: über 125 %.', 'Kombination ohne Kontingent: Soll 0.', 'Grundlage: Nutzungen 2024–2026']);
      expect(panel()?.querySelector('[data-testid="link"]')?.textContent).toContain('Zur Übersicht Kontingente');

      // A second click on the light closes it again.
      trigger().click();
      host.detectChanges();
      expect(panel()).toBeNull();
    });

    it('closes on a click outside, on Escape (focus back on the light) and on its link', () => {
      trigger().click();
      host.detectChanges();
      (host.nativeElement.querySelector('[data-testid="outside"]') as HTMLElement).click();
      host.detectChanges();
      expect(panel()).toBeNull();

      trigger().click();
      host.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      host.detectChanges();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger());

      trigger().click();
      host.detectChanges();
      const link = panel()?.querySelector('[data-testid="link"]') as HTMLAnchorElement;
      link.addEventListener('click', (event) => event.preventDefault());
      link.click();
      host.detectChanges();
      expect(panel()).toBeNull();
    });
  });
});
