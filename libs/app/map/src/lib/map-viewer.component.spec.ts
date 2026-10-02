import { Component, Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { FakeMap, provideFakeMap } from './map-testing';
import { MapViewerComponent } from './map-viewer.component';
import type { MapPlantPart, MapPoint } from './map.model';

/** Keys pass through; interpolation like the real pipe. */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    return Object.entries(params ?? {}).reduce((t, [k, v]) => `${t} ${k}=${v}`, key);
  }
}

const POINTS: MapPoint[] = [
  { id: 'p1', code: 'E1', east: 2618180, north: 1176916, state: 'over', label: 'E1, überschritten' },
  { id: 'p2', code: 'E2', east: 2618836, north: 1176894, state: 'ok', label: 'E2, eingehalten' },
  { id: 'p3', code: 'E6', east: null, north: null, state: 'none', label: 'E6, keine Berechnung' },
];
const PARTS: MapPlantPart[] = [
  { id: 'a1', name: 'Stellungsrm B 2', coordinationSectionNo: '1104.020.07', geometry: 'POLYGON((2618540 1176683, 2618620 1176683, 2618620 1176733, 2618540 1176733, 2618540 1176683))' },
];

describe('MapViewerComponent (slm 2, B1 5.4 / Abbildung 16)', () => {
  let fixture: ComponentFixture<MapViewerComponent>;
  let fake: FakeMap;
  let selected: string[];
  let unavailable: number;

  async function setup(options: { fail?: boolean; fullscreenLink?: string } = {}): Promise<void> {
    fake = provideFakeMap();
    fake.fail = Boolean(options.fail);
    await TestBed.configureTestingModule({
      imports: [MapViewerComponent],
      providers: [...fake.providers, { provide: TranslateService, useValue: { translate: (key: string) => key } }],
    })
      .overrideComponent(MapViewerComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(MapViewerComponent);
    fixture.componentRef.setInput('points', POINTS);
    fixture.componentRef.setInput('plantParts', PARTS);
    fixture.componentRef.setInput('title', '1104.020 Geissalp');
    fixture.componentRef.setInput('pinTestId', 'pin');
    if (options.fullscreenLink) fixture.componentRef.setInput('fullscreenLink', options.fullscreenLink);
    selected = [];
    unavailable = 0;
    fixture.componentInstance.pointSelected.subscribe((id) => selected.push(id));
    fixture.componentInstance.unavailable.subscribe(() => unavailable++);
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const all = (testId: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));
  const text = (testId: string) => el(testId)?.textContent?.replace(/\s+/g, ' ').trim();

  it('hands Anlagenteile and the placeable Empfangspunkte to the map and fits to them once', async () => {
    await setup();
    expect(el('map-viewer').getAttribute('data-status')).toBe('ready');
    expect(fake.engine?.plantParts).toEqual(PARTS);
    // E6 has no coordinates: no pin, and the viewer says so.
    expect(fake.engine?.pins.map((p) => [p.id, p.east, p.north])).toEqual([
      ['p1', 2618180, 1176916],
      ['p2', 2618836, 1176894],
    ]);
    expect(all('pin').map((p) => p.textContent?.trim())).toEqual(['E1', 'E2']);
    expect(text('map-hidden-points')).toContain('n=1');
    expect(fake.engine?.fits).toBe(1);

    // The same objects again (a reload of the page data) do not move the map.
    fixture.componentRef.setInput('points', [...POINTS]);
    await settle();
    expect(fake.engine?.fits).toBe(1);
  });

  it('renders the Empfangspunkte as buttons with the Ampel state and reports the chosen one', async () => {
    await setup();
    const [e1, e2] = all('pin');
    expect(e1.classList).toContain('slim-map__pin--over');
    expect(e1.getAttribute('aria-label')).toBe('E1, überschritten');
    expect(e2.classList).toContain('slim-map__pin--ok');
    e2.click();
    expect(selected).toEqual(['p2']);
    fixture.componentRef.setInput('selectedId', 'p2');
    await settle();
    expect(all('pin')[1].classList).toContain('slim-map__pin--active');
    expect(all('pin')[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('shows Massstab 1:XXX, the Ausdehnungsbalken and the Zoomstufe, and follows the view (B1 5.4.3)', async () => {
    await setup();
    // Zoomstufe 7 of 12 = 2.5 m per pixel.
    expect(text('map-zoom-level')).toBe('7');
    expect(text('map-scale')).toBe('1:8’929');
    expect(text('map-scale-bar')).toBe('200 m');
    el<HTMLButtonElement>('map-zoom-in').click();
    await settle();
    expect(text('map-zoom-level')).toBe('8');
    expect(text('map-scale')).toBe('1:7’143');
    el<HTMLButtonElement>('map-zoom-out').click();
    el<HTMLButtonElement>('map-zoom-out').click();
    await settle();
    expect(text('map-zoom-level')).toBe('6');
    // «Default» goes back to the extent of the objects.
    el<HTMLButtonElement>('map-reset').click();
    expect(fake.engine?.fits).toBe(2);
  });

  it('disables the zoom buttons at the first and the last Zoomstufe', async () => {
    await setup();
    for (let i = 0; i < 12; i++) fake.engine?.zoomBy(1);
    await settle();
    expect(text('map-zoom-level')).toBe('12');
    expect(el<HTMLButtonElement>('map-zoom-in').disabled).toBe(true);
    for (let i = 0; i < 12; i++) fake.engine?.zoomBy(-1);
    await settle();
    expect(text('map-zoom-level')).toBe('1');
    expect(el<HTMLButtonElement>('map-zoom-out').disabled).toBe(true);
  });

  it('shows the LV95 coordinates under the mouse (B1 5.4.4)', async () => {
    await setup();
    expect(text('map-coordinates')).toContain('–');
    fake.engine?.handlers.pointer([2618420.4, 1176899.6]);
    await settle();
    expect(text('map-coordinates')).toContain('2’618’420, 1’176’900');
    fake.engine?.handlers.pointer(null);
    await settle();
    expect(text('map-coordinates')).toContain('–');
  });

  it('switches the background map from the configured list (B1 5.4.5)', async () => {
    await setup();
    expect(fake.engine?.baseMap).toBe('light');
    expect(el('map-base-imagery')).toBeNull(); // folded
    el<HTMLButtonElement>('map-base').click();
    await settle();
    expect(el('map-base-imagery')).not.toBeNull();
    expect(el('map-base-topo')).not.toBeNull();
    expect(el('map-base-light')).toBeNull(); // the current one is the toggle itself
    el<HTMLButtonElement>('map-base-imagery').click();
    await settle();
    expect(fake.engine?.baseMap).toBe('imagery');
    expect(el('map-base-imagery')).toBeNull(); // folded again
    expect(text('map-base')).toContain('map.base.imagery');
  });

  it('toggles the layers Anlagenteile and Empfangspunkte and explains the colours', async () => {
    await setup();
    el<HTMLButtonElement>('map-layers').click();
    await settle();
    expect(el('map-layers-panel').textContent).toContain('map.legend.over');
    el<HTMLInputElement>('map-layer-plant-parts').click();
    await settle();
    expect(fake.engine?.visible).toEqual({ plantParts: false, points: true });
    el<HTMLInputElement>('map-layer-points').click();
    await settle();
    expect(fake.engine?.visible).toEqual({ plantParts: false, points: false });
  });

  it('tells the user when a background tile cannot be loaded and keeps working (FAQ 119)', async () => {
    await setup();
    expect(el('map-tiles-failed')).toBeNull();
    fake.engine?.handlers.tileError();
    await settle();
    expect(text('map-tiles-failed')).toContain('map.tiles_failed');
    expect(all('pin')).toHaveLength(2);
  });

  it('exports the Kartenausschnitt at the chosen resolution, with the pins and without the extras that are unticked (B1 5.4.6)', async () => {
    await setup();
    el<HTMLButtonElement>('map-export').click();
    await settle();
    const dpi = el<HTMLSelectElement>('map-export-dpi');
    expect(Array.from(dpi.options).map((o) => o.textContent?.trim())).toEqual(['96 dpi', '150 dpi', '300 dpi']);
    dpi.value = '300';
    dpi.dispatchEvent(new Event('change'));
    // Image export: no PDF library involved, the dialog hides the extras of the PDF.
    const format = el<HTMLSelectElement>('map-export-format');
    format.value = 'image';
    format.dispatchEvent(new Event('change'));
    await settle();
    expect(el('map-export-title')).toBeNull();

    const clicks: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    el<HTMLButtonElement>('map-export-run').click();
    await settle();
    click.mockRestore();

    expect(fake.engine?.exports).toHaveLength(1);
    const request = fake.engine?.exports[0];
    // All extras are still ticked (PDF default), so the map gets the A4 area below the title and above three footer lines.
    expect(request).toMatchObject({ dpi: 300, widthMm: 277, heightMm: 162 });
    expect(request?.pins.map((p) => p.code)).toEqual(['E1', 'E2']);
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatch(/^karte-1104-020-geissalp-\d{4}-\d{2}-\d{2}\.jpg$/);
    expect(el('map-export-panel')).toBeNull(); // closed after a successful export
  });

  it('keeps the dialog open and says so when the export fails', async () => {
    await setup();
    el<HTMLButtonElement>('map-export').click();
    await settle();
    (fake.engine as NonNullable<FakeMap['engine']>).failExport = true;
    el<HTMLButtonElement>('map-export-run').click();
    await settle();
    expect(text('map-export-error')).toContain('map.export.failed');
    expect(el<HTMLButtonElement>('map-export-run').disabled).toBe(false);
  });

  it('offers the Vollansicht in a new tab when the host gives a link', async () => {
    await setup({ fullscreenLink: '/admin/area/a1/map?state=s1' });
    const link = el<HTMLAnchorElement>('map-fullscreen');
    expect(link.getAttribute('href')).toBe('/admin/area/a1/map?state=s1');
    expect(link.target).toBe('_blank');
  });

  it('reports `unavailable` when the map library cannot be loaded, so the host can fall back', async () => {
    await setup({ fail: true });
    expect(unavailable).toBe(1);
    expect(el('map-viewer').getAttribute('data-status')).toBe('failed');
    expect(text('map-failed')).toContain('map.failed');
    expect(el('map-zoom-in')).toBeNull();
  });

  it('shows the state before a change as a dot next to the pin (simulation)', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('.slim-map__ghost')).toBeNull();
    fixture.componentRef.setInput('points', [{ ...POINTS[0], state: 'ok', previousState: 'over', previousLabel: 'Ist: 60.8 dB' }, POINTS[1]]);
    await settle();
    const ghost = fixture.nativeElement.querySelector('.slim-map__ghost') as HTMLElement;
    expect(ghost.classList).toContain('slim-map__ghost--over');
    expect(ghost.title).toBe('Ist: 60.8 dB');
    // The map positions the dot at the coordinate of its point, after the pins.
    expect(fake.engine?.pins.map((p) => [p.id, p.element.tagName])).toEqual([
      ['p1', 'BUTTON'],
      ['p2', 'BUTTON'],
      ['p1', 'SPAN'],
    ]);
  });

  it('releases the map when the viewer is destroyed', async () => {
    await setup();
    const engine = fake.engine;
    fixture.destroy();
    expect(engine?.destroyed).toBe(true);
  });
});

@Component({
  imports: [MapViewerComponent],
  template: `
    <slim-map-viewer [points]="points" [selectedId]="selected()" [popup]="true">
      <p slimMapPopup data-testid="host-popup">Grenzwert {{ selected() }}</p>
    </slim-map-viewer>
  `,
})
class PopupHostComponent {
  readonly points = POINTS;
  readonly selected = signal<string | null>(null);
}

describe('MapViewerComponent — popover of the selected point', () => {
  it('projects the content of the host at the selected point and keeps it inside the map', async () => {
    const fake = provideFakeMap();
    await TestBed.configureTestingModule({
      imports: [PopupHostComponent],
      providers: [...fake.providers, { provide: TranslateService, useValue: { translate: (key: string) => key } }],
    })
      .overrideComponent(MapViewerComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    const fixture = TestBed.createComponent(PopupHostComponent);
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
    };
    await settle();
    const popup = () => fixture.nativeElement.querySelector('[data-testid="map-popup"]') as HTMLElement | null;
    expect(popup()).toBeNull();

    fixture.componentInstance.selected.set('p2');
    await settle();
    expect(popup()?.textContent).toContain('Grenzwert p2');
    const placed = fake.engine?.pins.find((p) => p.keepInside);
    expect(placed).toMatchObject({ id: 'p2', east: 2618836, north: 1176894 });
    expect(placed?.element).toBe(popup());

    // A point without coordinates has no pin, so no popover either.
    fixture.componentInstance.selected.set('p3');
    await settle();
    expect(popup()).toBeNull();
  });
});
