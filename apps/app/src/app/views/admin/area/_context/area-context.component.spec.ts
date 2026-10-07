import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AreaContextComponent } from './area-context.component';

const GEISSALP = { id: 'area-1', name: 'Geissalp', coordinationSectionNo: '1104.020', quotaStatus: 'ok', noiseStatus: 'over' } as unknown as AreaResultDto;

class FacadeStub {
  readonly areas = signal<AreaResultDto[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn(async () => undefined);
}

describe('AreaContextComponent', () => {
  let fixture: ComponentFixture<AreaContextComponent>;
  let facade: FacadeStub;

  async function setup(id: string): Promise<void> {
    facade = new FacadeStub();
    const paramMap = convertToParamMap({ id });
    await TestBed.configureTestingModule({
      imports: [AreaContextComponent],
      providers: [
        provideRouter([]),
        { provide: AreaFacade, useValue: facade },
        DataEmitter,
        // The status pill drops explanation parts that still look like a key (`status_area.…`): give the hints a text.
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string, params?: Record<string, string>) =>
              key === 'status_area.named' ? `named(${params?.['kind']}, ${params?.['status']})` : key.replace('status_area.hint.', 'hint ').replace('status_area.kind.', 'kind.'),
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreaContextComponent);
    fixture.detectChanges();
  }

  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  it('shows the navigation of the Schiessplatz of the address', async () => {
    await setup('area-1');
    facade.areas.set([GEISSALP]);
    facade.loaded.set(true);
    fixture.detectChanges();
    expect(el('.area-ctx__name')?.textContent).toContain('Geissalp');
    expect(el('[data-testid="area-tab-details"]')?.getAttribute('href')).toBe('/admin/area/area-1/details');
    expect(el('router-outlet')).not.toBeNull();
    expect(el('[data-testid="area-not-found"]')).toBeNull();
    // Two lights, Kontingent and Lärm: each names its kind (both can read «Überschritten») and explains
    // itself on a click, with a link to the page behind it.
    const pills = fixture.nativeElement.querySelectorAll('.area-ctx__status .slim-badge') as NodeListOf<HTMLElement>;
    expect(pills.length).toBe(2);
    expect(pills[0].textContent?.trim()).toBe('named(kind.quota, status_area.ok)');
    expect(pills[1].textContent?.trim()).toBe('named(kind.noise, status_area.over)');
    expect(el('[data-testid="status-pill-panel"]')).toBeNull();
    pills[0].click();
    fixture.detectChanges();
    expect(el('[data-testid="status-pill-panel"]')?.textContent).toContain('hint quota_ok');
    expect(el('[data-testid="area-status-link-quota"]')?.getAttribute('href')).toBe('/admin/area/area-1/overview#quota');
    // The other light takes over: one panel at a time.
    pills[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="status-pill-panel"]').length).toBe(1);
    expect(el('[data-testid="status-pill-panel"]')?.textContent).toContain('hint noise_over');
    expect(el('[data-testid="area-status-link-noise"]')?.getAttribute('href')).toBe('/admin/area/area-1/details');
    // Regression 02.10.2026: Angular creates the routed page in the namespace of the outlet's parent node.
    // Directly inside the block that was the block's own node, which inherited «SVG» from the icon before
    // it — every page of a Schiessplatz was an SVG element and showed nothing. The outlet needs an HTML parent.
    const parent = el('router-outlet')?.parentElement;
    expect(parent?.getAttribute('data-testid')).toBe('area-page');
    expect(parent?.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
  });

  it('keeps the pages while the list of Schiessplätze is still loading', async () => {
    await setup('area-1');
    expect(el('router-outlet')).not.toBeNull();
    expect(el('[data-testid="area-not-found"]')).toBeNull();
  });

  it('says that the Schiessplatz was not found instead of rendering its pages (unknown id or outside the scope)', async () => {
    await setup('does-not-exist');
    facade.areas.set([GEISSALP]);
    facade.loaded.set(true);
    fixture.detectChanges();
    expect(el('[data-testid="area-not-found"]')?.textContent).toContain('common.area_not_found.title');
    expect(el('[data-testid="area-not-found-back"]')?.getAttribute('href')).toBe('/admin/area');
    // No tabs and no page of the Schiessplatz — nothing asks the API for the unknown id.
    expect(el('[data-testid="area-tab-details"]')).toBeNull();
    expect(el('router-outlet')).toBeNull();
  });

  it('shows the error of the list, not «not found», when the list could not be loaded', async () => {
    await setup('area-1');
    facade.error.set('Server nicht erreichbar');
    facade.loaded.set(true);
    fixture.detectChanges();
    expect(el('[data-testid="area-not-found"]')).toBeNull();
    expect(el('.slim-alert')?.textContent).toContain('Server nicht erreichbar');
  });
});
