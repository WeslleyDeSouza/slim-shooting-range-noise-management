import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { MapConfig } from './map.model';

/** Where the administrator edits the viewer (B1 5.4.2) — a static asset, no rebuild needed. */
export const MAP_CONFIG_URL = 'assets/config/map.config.json';

const WMTS = 'https://wmts.geo.admin.ch/1.0.0';
const baseMap = (id: string, layer: string, ext: 'png' | 'jpeg', maxMatrix: number) => ({
  id,
  labelKey: `map.base.${id}`,
  url: `${WMTS}/${layer}/default/current/2056/{z}/{x}/{y}.${ext}`,
  maxMatrix,
  attribution: '© swisstopo',
  thumbnail: `${WMTS}/${layer}/default/current/2056/18/14/11.${ext}`,
});

/**
 * The content of `map.config.json` as fallback when the file cannot be
 * loaded: swisstopo WMTS in LV95 with the «Leichte Basiskarte» as default,
 * SWISSIMAGE and the Landeskarte as alternatives (B1 5.4.5), twelve
 * Zoomstufen (5.4.3). A spec keeps both in step.
 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  projection: 'EPSG:2056',
  extent: [2420000, 1030000, 2900000, 1350000],
  tileGrid: {
    origin: [2420000, 1350000],
    resolutions: [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1],
  },
  zoom: { resolutions: [250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25], fitMinResolution: 1, fitPadding: 56 },
  defaultCenter: [2660000, 1190000],
  defaultBaseMap: 'light',
  baseMaps: [
    baseMap('light', 'ch.swisstopo.leichte-basiskarte_reliefschattierung', 'png', 27),
    baseMap('imagery', 'ch.swisstopo.swissimage', 'jpeg', 28),
    baseMap('topo', 'ch.swisstopo.pixelkarte-farbe', 'jpeg', 27),
  ],
  selectionColor: '#006699',
  layers: {
    plantParts: { visible: true, stroke: '#17181c', fill: 'rgba(23, 24, 28, 0.18)', strokeWidth: 2, labelMaxResolution: 5 },
    points: { visible: true },
  },
  export: { dpi: [96, 150, 300], defaultDpi: 150, disclaimerKey: 'map.export.disclaimer' },
};

/**
 * Loads the viewer configuration once per session. A missing or broken file
 * must not take the map down — the built-in default applies then.
 */
@Injectable({ providedIn: 'root' })
export class MapConfigService {
  private readonly http = inject(HttpClient);
  private pending: Promise<MapConfig> | null = null;

  load(): Promise<MapConfig> {
    this.pending ??= firstValueFrom(this.http.get<Partial<MapConfig>>(MAP_CONFIG_URL))
      .then((file) => merge(file))
      .catch(() => DEFAULT_MAP_CONFIG);
    return this.pending;
  }
}

/** The file wins per top-level key; a file without base maps or Zoomstufen would leave the map unusable. */
function merge(file: Partial<MapConfig> | null): MapConfig {
  if (!file || typeof file !== 'object') return DEFAULT_MAP_CONFIG;
  const config = { ...DEFAULT_MAP_CONFIG, ...file };
  if (!config.baseMaps?.length || !config.zoom?.resolutions?.length || !config.tileGrid?.resolutions?.length) return DEFAULT_MAP_CONFIG;
  if (!config.baseMaps.some((b) => b.id === config.defaultBaseMap)) config.defaultBaseMap = config.baseMaps[0].id;
  return config;
}
