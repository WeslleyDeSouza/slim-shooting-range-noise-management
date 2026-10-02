import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { MapConfig } from './map.model';

/** Where the administrator edits the viewer (B1 5.4.2) — a static asset, no rebuild needed. */
export const MAP_CONFIG_URL = 'assets/config/map.config.json';

const STYLES = 'https://vectortiles.geo.admin.ch/styles';
const WMTS = 'https://wmts.geo.admin.ch/1.0.0';
const baseMap = (id: string, type: 'style' | 'xyz', url: string) => ({
  id,
  labelKey: `map.base.${id}`,
  type,
  url,
  attribution: '© swisstopo',
  thumbnail: `assets/map/base-${id}.jpg`,
});

/**
 * The content of `map.config.json` as fallback when the file cannot be
 * loaded: the swisstopo «Light Base Map» (vector tiles) as default, the
 * «Imagery Base Map» (Orthofoto with place names) and the Landeskarte as
 * alternatives (B1 5.4.5), twelve Zoomstufen (5.4.3). A spec keeps both in
 * step.
 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  projection: 'EPSG:2056',
  extent: [2420000, 1030000, 2900000, 1350000],
  zoom: { levels: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], fitMaxLevel: 17, fitPadding: 56 },
  defaultCenter: [2660000, 1190000],
  defaultBaseMap: 'light',
  baseMaps: [
    baseMap('light', 'style', `${STYLES}/ch.swisstopo.lightbasemap.vt/style.json`),
    baseMap('imagery', 'style', `${STYLES}/ch.swisstopo.imagerybasemap.vt/style.json`),
    { ...baseMap('topo', 'xyz', `${WMTS}/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg`), maxZoom: 19 },
  ],
  selectionColor: '#006699',
  layers: {
    plantParts: { visible: true, stroke: '#17181c', fill: 'rgba(23, 24, 28, 0.18)', strokeWidth: 2, labelMaxResolution: 7 },
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
  const usable = config.baseMaps?.length && config.baseMaps.every((b) => b.url && (b.type === 'style' || b.type === 'xyz'));
  if (!usable || !config.zoom?.levels?.length) return DEFAULT_MAP_CONFIG;
  if (!config.baseMaps.some((b) => b.id === config.defaultBaseMap)) config.defaultBaseMap = config.baseMaps[0].id;
  return config;
}
