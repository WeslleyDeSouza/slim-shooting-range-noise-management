import type { Provider } from '@angular/core';
import { DEFAULT_MAP_CONFIG, MapConfigService } from './map-config.service';
import {
  MAP_ENGINE,
  MapConfig,
  MapEngine,
  MapEngineHandlers,
  MapExportImage,
  MapExportRequest,
  MapPin,
  MapPlantPart,
} from './map.model';

/** Ground resolutions (m per px) the fake reports for its twelve Zoomstufen. */
const FAKE_RESOLUTIONS = [250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25];

/**
 * Stand-in for the map library in unit tests: records what the viewer asks
 * for and lets a spec drive the callbacks (view change, mouse position, tile
 * error). No canvas, no network.
 */
export class FakeMapEngine implements MapEngine {
  baseMap: string;
  plantParts: MapPlantPart[] = [];
  pins: MapPin[] = [];
  visible = { plantParts: true, points: true };
  fits = 0;
  zoom = 6;
  exports: MapExportRequest[] = [];
  destroyed = false;
  /** Set to make the next export fail (tainted canvas, timeout). */
  failExport = false;

  constructor(
    readonly config: MapConfig,
    readonly handlers: MapEngineHandlers,
  ) {
    this.baseMap = config.defaultBaseMap;
    this.emitView();
  }

  emitView(): void {
    this.handlers.view({ zoom: this.zoom, resolution: FAKE_RESOLUTIONS[this.zoom] ?? 1, center: [2618420, 1176900] });
  }

  setBaseMap(id: string): void {
    this.baseMap = id;
  }

  setPlantParts(parts: MapPlantPart[]): void {
    this.plantParts = parts;
  }

  setPins(pins: MapPin[]): void {
    this.pins = pins;
  }

  setLayerVisible(layer: 'plantParts' | 'points', visible: boolean): void {
    this.visible[layer] = visible;
  }

  fit(): void {
    this.fits++;
  }

  zoomBy(delta: number): void {
    this.zoom = Math.max(0, Math.min(this.config.zoom.levels.length - 1, this.zoom + delta));
    this.emitView();
  }

  exportImage(request: MapExportRequest): Promise<MapExportImage> {
    this.exports.push(request);
    if (this.failExport) return Promise.reject(new Error('export failed'));
    return Promise.resolve({ dataUrl: 'data:image/jpeg;base64,AAAA', widthPx: 100, heightPx: 60, scale: 5000, center: [2618420, 1176900] });
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export interface FakeMap {
  /** The engine of the last viewer that started (null until then, or when `fail` is set). */
  engine: FakeMapEngine | null;
  /** Make the map library «fail to load» — the viewer reports `unavailable`. */
  fail: boolean;
  providers: Provider[];
}

/** `providers: [...fakeMap.providers]` — the viewer runs with the default configuration and the fake engine. */
export function provideFakeMap(config: MapConfig = DEFAULT_MAP_CONFIG): FakeMap {
  const fake: FakeMap = { engine: null, fail: false, providers: [] };
  fake.providers = [
    { provide: MapConfigService, useValue: { load: () => Promise.resolve(config) } },
    {
      provide: MAP_ENGINE,
      useValue: (_target: HTMLElement, c: MapConfig, handlers: MapEngineHandlers) => {
        if (fake.fail) return Promise.reject(new Error('map library not available'));
        fake.engine = new FakeMapEngine(c, handlers);
        return Promise.resolve(fake.engine);
      },
    },
  ];
  return fake;
}
