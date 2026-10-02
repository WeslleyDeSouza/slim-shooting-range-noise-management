import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { MapConfigService } from './map-config.service';
import { exportLayout, MapExportOptions, saveMapImage, saveMapPdf } from './map-export';
import { formatLv95, formatScale, placeablePoints, scaleBar, scaleDenominator } from './map.logic';
import { MAP_ENGINE, MapConfig, MapEngine, MapPlantPart, MapPoint, MapViewState } from './map.model';

const I18N = 'map';

/** Ampel state → design token of the pin colour (used for the export, the on-screen pins are styled by CSS). */
const STATE_TOKEN: Record<string, string> = { ok: 'success', warn: 'warning', over: 'danger' };

/**
 * GIS-Kartenviewer (`slm 2`, B1 5.4, Abbildung 16): swisstopo background
 * maps in CH1903+ / LV95, the Anlagenteile and Empfangspunkte of the host
 * page on top, Massstab «1:XXX» with Ausdehnungsbalken, Zoomstufen with
 * «Default», the coordinates under the mouse, a switcher of the background
 * maps, a layer panel and the export as PDF or image with optional title,
 * copyright, date, disclaimer, scale and centre.
 *
 * The map library sits behind `MAP_ENGINE` (OpenLayers, loaded on demand).
 * The Empfangspunkte are real buttons placed on the map, so keyboard and
 * screen reader reach them. When the library cannot be loaded the viewer
 * emits `unavailable` and the host falls back to its own display.
 */
@Component({
  selector: 'slim-map-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './map-viewer.component.html',
  styleUrl: './map-viewer.component.scss',
  host: { '(document:keydown.escape)': 'closePanels()' },
})
export class MapViewerComponent {
  private readonly configs = inject(MapConfigService);
  private readonly createEngine = inject(MAP_ENGINE);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Empfangspunkte (LV95). */
  readonly points = input<MapPoint[]>([]);
  /** Anlagenteile (WKT in LV95). */
  readonly plantParts = input<MapPlantPart[]>([]);
  readonly selectedId = input<string | null>(null);
  /** Title of the export, e.g. «1104.020 Geissalp». */
  readonly title = input('');
  /** Link of «Vollansicht» (opens in a new tab, B1 5.10); hidden when empty. */
  readonly fullscreenLink = input<string | null>(null);
  /** `data-testid` of the pins, so a host page can keep its own. */
  readonly pinTestId = input('map-pin');

  readonly pointSelected = output<string>();
  /** The map library could not be loaded — the host shows its fallback. */
  readonly unavailable = output<void>();

  protected readonly prefix = I18N;
  private readonly target = viewChild.required<ElementRef<HTMLElement>>('target');
  private readonly pinElements = viewChildren<ElementRef<HTMLElement>>('pin');

  protected readonly config = signal<MapConfig | null>(null);
  private readonly engine = signal<MapEngine | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly view = signal<MapViewState | null>(null);
  protected readonly pointer = signal<[number, number] | null>(null);
  protected readonly tilesFailed = signal(false);

  protected readonly baseMapId = signal('');
  protected readonly panel = signal<'base' | 'layers' | 'export' | null>(null);
  protected readonly layers = signal({ plantParts: true, points: true });

  protected readonly exportOptions = signal<MapExportOptions>({
    format: 'pdf',
    dpi: 150,
    title: true,
    copyright: true,
    date: true,
    disclaimer: true,
    scale: true,
    center: true,
  });
  protected readonly exporting = signal(false);
  protected readonly exportError = signal(false);
  protected readonly legendStates = ['ok', 'warn', 'over', 'none'] as const;
  protected readonly extras: readonly (keyof MapExportOptions & ('title' | 'copyright' | 'date' | 'disclaimer' | 'scale' | 'center'))[] = [
    'title',
    'copyright',
    'date',
    'disclaimer',
    'scale',
    'center',
  ];

  /** Points with usable coordinates, in the order of the input (the pins of the template). */
  protected readonly pins = computed(() => {
    const config = this.config();
    return config ? placeablePoints(this.points(), config.extent) : [];
  });
  protected readonly hiddenPoints = computed(() => this.points().length - this.pins().length);

  protected readonly baseMaps = computed(() => this.config()?.baseMaps ?? []);
  protected readonly baseMap = computed(() => this.baseMaps().find((b) => b.id === this.baseMapId()) ?? null);
  protected readonly zoomCount = computed(() => this.config()?.zoom.resolutions.length ?? 0);
  protected readonly scale = computed(() => {
    const view = this.view();
    return view ? formatScale(scaleDenominator(view.resolution)) : '';
  });
  protected readonly bar = computed(() => {
    const view = this.view();
    return view ? scaleBar(view.resolution) : null;
  });
  protected readonly coordinates = computed(() => formatLv95(this.pointer()));

  constructor() {
    // The map needs its target element: start once the view is there.
    afterNextRender(() => void this.start());
    this.destroyRef.onDestroy(() => this.engine()?.destroy());

    // Anlagenteile → vector layer.
    effect(() => {
      const engine = this.engine();
      const parts = this.plantParts();
      if (engine) untracked(() => engine.setPlantParts(parts));
    });

    // Empfangspunkte → the rendered buttons become overlays; a new set of objects re-centres the map.
    let shown = '';
    effect(() => {
      const engine = this.engine();
      const pins = this.pins();
      const elements = this.pinElements();
      const parts = this.plantParts();
      if (!engine || elements.length !== pins.length) return;
      untracked(() => {
        engine.setPins(pins.map((p, i) => ({ id: p.id, east: p.east, north: p.north, element: elements[i].nativeElement })));
        const key = [...pins.map((p) => p.id), ...parts.map((p) => p.id)].join('|');
        if (key !== shown) {
          shown = key;
          engine.fit();
        }
      });
    });
  }

  private async start(): Promise<void> {
    const config = await this.configs.load();
    this.config.set(config);
    this.baseMapId.set(config.defaultBaseMap);
    this.layers.set({ plantParts: config.layers.plantParts.visible, points: config.layers.points.visible });
    this.exportOptions.update((o) => ({ ...o, dpi: config.export.defaultDpi }));
    try {
      const engine = await this.createEngine(this.target().nativeElement, config, {
        view: (state) => this.view.set(state),
        pointer: (coordinate) => this.pointer.set(coordinate),
        tileError: () => this.tilesFailed.set(true),
      });
      this.engine.set(engine);
      this.status.set('ready');
    } catch {
      this.status.set('failed');
      this.unavailable.emit();
    }
  }

  protected select(point: MapPoint): void {
    this.pointSelected.emit(point.id);
  }

  protected zoom(delta: number): void {
    this.engine()?.zoomBy(delta);
  }

  /** «Default» (B1 5.4.3): back to the extent of the objects. */
  protected reset(): void {
    this.engine()?.fit();
  }

  protected togglePanel(panel: 'base' | 'layers' | 'export'): void {
    this.panel.update((open) => (open === panel ? null : panel));
    this.exportError.set(false);
  }

  protected closePanels(): void {
    this.panel.set(null);
  }

  protected setBaseMap(id: string): void {
    this.baseMapId.set(id);
    this.tilesFailed.set(false);
    this.engine()?.setBaseMap(id);
    this.panel.set(null);
  }

  protected toggleLayer(layer: 'plantParts' | 'points'): void {
    this.layers.update((l) => ({ ...l, [layer]: !l[layer] }));
    this.engine()?.setLayerVisible(layer, this.layers()[layer]);
  }

  protected setExport<K extends keyof MapExportOptions>(key: K, value: MapExportOptions[K]): void {
    this.exportOptions.update((o) => ({ ...o, [key]: value }));
  }

  /** B1 5.4.6: the Kartenausschnitt with the chosen extras at the chosen resolution. */
  protected async export(): Promise<void> {
    const engine = this.engine();
    const config = this.config();
    if (!engine || !config || this.exporting()) return;
    const options = this.exportOptions();
    const layout = exportLayout(options);
    this.exporting.set(true);
    this.exportError.set(false);
    try {
      const image = await engine.exportImage({
        widthMm: layout.mapWidthMm,
        heightMm: layout.mapHeightMm,
        dpi: options.dpi,
        pins: this.layers().points ? this.pins().map((p) => ({ east: p.east, north: p.north, code: p.code, color: stateColor(p.state) })) : [],
      });
      const now = new Date();
      const t = (key: string, params?: Record<string, unknown>) => this.translate.translate(`${I18N}.${key}`, params) ?? key;
      const texts = {
        title: this.title() || t('export.default_title'),
        copyright: this.baseMap()?.attribution ?? '',
        date: t('export.printed', { date: new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(now) }),
        disclaimer: this.translate.translate(config.export.disclaimerKey) ?? '',
        scale: t('export.scale', { scale: formatScale(image.scale) }),
        center: t('export.center', { coordinates: formatLv95(image.center) }),
        fileName: fileName(this.title(), now),
      };
      if (options.format === 'pdf') await saveMapPdf(image, options, texts);
      else saveMapImage(image, texts.fileName);
      this.panel.set(null);
    } catch {
      this.exportError.set(true);
    } finally {
      this.exporting.set(false);
    }
  }
}

/** Colour of a design token as the canvas needs it (the tokens follow the theme). */
function stateColor(state: string): string {
  const token = STATE_TOKEN[state] ?? 'text-4';
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--slim-color-${token}`).trim();
  return value || '#6b7280';
}

/** «karte-1104-020-geissalp-2026-10-02» — safe on every file system. */
function fileName(title: string, now: Date): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return ['karte', slug, now.toISOString().slice(0, 10)].filter(Boolean).join('-');
}
