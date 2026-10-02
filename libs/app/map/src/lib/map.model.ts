import { InjectionToken } from '@angular/core';

/** One background map of the viewer (B1 5.4.5), a swisstopo WMTS layer in LV95. */
export interface MapBaseMapConfig {
  id: string;
  /** Locale key of the name shown in the switcher. */
  labelKey: string;
  /** Tile URL with `{z}` (TileMatrix), `{x}` (TileCol), `{y}` (TileRow). */
  url: string;
  /** Highest TileMatrix the layer offers (index into `tileGrid.resolutions`). */
  maxMatrix: number;
  /** Copyright note, shown on the map and on the export. */
  attribution: string;
  opacity?: number;
  /** One tile of the layer as the thumbnail of the switcher. */
  thumbnail?: string;
}

/**
 * Configuration of the GIS-Kartenviewer (B1 5.4.2: «ohne dass die
 * Applikation neu kompiliert werden muss … eine JSON-Datei ist vollkommen
 * ausreichend»). Loaded from `assets/config/map.config.json`; the constant
 * `DEFAULT_MAP_CONFIG` is the same content as fallback.
 */
export interface MapConfig {
  /** EPSG code of view, tiles and data — CH1903+ / LV95. */
  projection: string;
  /** [minEast, minNorth, maxEast, maxNorth] the view is limited to. */
  extent: [number, number, number, number];
  tileGrid: { origin: [number, number]; resolutions: number[] };
  zoom: {
    /** Zoomstufen as resolutions in m/px, coarse → fine (B1 5.4.3: 10–12 Stufen). */
    resolutions: number[];
    /** Finest resolution «Default» zooms to when it fits the objects. */
    fitMinResolution: number;
    /** Padding in px around the objects when fitting. */
    fitPadding: number;
  };
  /** Centre used when there is nothing to fit to. */
  defaultCenter: [number, number];
  defaultBaseMap: string;
  baseMaps: MapBaseMapConfig[];
  /** Selektionsfarbe (B1 5.4.2). */
  selectionColor: string;
  layers: {
    plantParts: { visible: boolean; stroke: string; fill: string; strokeWidth: number; labelMaxResolution: number };
    points: { visible: boolean };
  };
  export: {
    /** Offered resolutions of the exported map (B1 5.4.6). */
    dpi: number[];
    defaultDpi: number;
    /** Locale key of the «Rechtliche Einordnung, Disclaimer». */
    disclaimerKey: string;
  };
}

/** Empfangspunkt on the map. `east` / `north` in LV95; points without coordinates are not drawn. */
export interface MapPoint {
  id: string;
  code: string;
  east: number | null;
  north: number | null;
  /** Ampel of the point (`ok`, `warn`, `over`, `none`, `incomplete`), drives the pin colour. */
  state: string;
  /** Accessible name of the pin. */
  label: string;
}

/** Anlageteil on the map: geometry as WKT in LV95. */
export interface MapPlantPart {
  id: string;
  name: string;
  coordinationSectionNo: string;
  geometry: string | null;
}

export interface MapViewState {
  /** Index of the Zoomstufe (0 = coarsest). */
  zoom: number;
  /** m per px. */
  resolution: number;
  center: [number, number];
}

export interface MapPin {
  id: string;
  east: number;
  north: number;
  element: HTMLElement;
}

export interface MapExportRequest {
  widthMm: number;
  heightMm: number;
  dpi: number;
  /** Pins drawn onto the exported image (the on-screen pins are DOM elements). */
  pins: { east: number; north: number; code: string; color: string }[];
}

export interface MapExportImage {
  /** JPEG data URL of the map at the requested size and resolution. */
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  /** Massstab of the printed map (1 : scale). */
  scale: number;
  center: [number, number];
}

export interface MapEngineHandlers {
  view(state: MapViewState): void;
  /** LV95 coordinate under the mouse, null when it leaves the map. */
  pointer(coordinate: [number, number] | null): void;
  /** A background tile could not be loaded (external service down, B1 5.4.5 / FAQ 119). */
  tileError(): void;
}

/** What the viewer needs from the map library — kept behind an interface so the specs run without it. */
export interface MapEngine {
  setBaseMap(id: string): void;
  setPlantParts(parts: MapPlantPart[]): void;
  setPins(pins: MapPin[]): void;
  setLayerVisible(layer: 'plantParts' | 'points', visible: boolean): void;
  /** «Default»: back to the extent of the objects. */
  fit(): void;
  zoomBy(delta: number): void;
  exportImage(request: MapExportRequest): Promise<MapExportImage>;
  destroy(): void;
}

export type MapEngineFactory = (target: HTMLElement, config: MapConfig, handlers: MapEngineHandlers) => Promise<MapEngine>;

/** OpenLayers by default, loaded on demand so the library only reaches users who open a map. */
export const MAP_ENGINE = new InjectionToken<MapEngineFactory>('MAP_ENGINE', {
  providedIn: 'root',
  factory: () => (target, config, handlers) => import('./ol-map-engine').then((m) => m.createOlMapEngine(target, config, handlers)),
});
