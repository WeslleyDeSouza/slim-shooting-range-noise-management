import OlMap from 'ol/Map';
import View from 'ol/View';
import { boundingExtent, buffer, createEmpty, extend as extendExtent, isEmpty } from 'ol/extent';
import WKT from 'ol/format/WKT';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { getPointResolution, transform, transformExtent } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import type Source from 'ol/source/Source';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Fill, Stroke, Style, Text } from 'ol/style';
import { apply as applyMapboxStyle } from 'ol-mapbox-style';
import proj4 from 'proj4';
import { drawablePlantParts, plantPartLabel, printScale } from './map.logic';
import type { MapBaseMapConfig, MapConfig, MapEngine, MapEngineHandlers, MapExportImage, MapExportRequest, MapPin, MapPlantPart } from './map.model';

/** The export waits this long for the background tiles before it prints what is there. */
const EXPORT_TIMEOUT_MS = 12_000;

/** The swisstopo base maps («Light Base Map», «Imagery Base Map») are vector tiles in Web Mercator — so is the view. */
const VIEW = 'EPSG:3857';

/** CH1903+ / LV95 (swisstopo): the projection of the data and of every coordinate the user sees. */
const LV95_DEFINITION =
  '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs';

/**
 * OpenLayers behind the `MapEngine` interface (slm 2). Background maps come
 * live from swisstopo (B1 5.4.2 / 5.4.5, no caching in SLIM): a base map is
 * either a vector-tile style (`type: 'style'`, the «Light Base Map» and the
 * «Imagery Base Map» of B1) or a raster tile layer (`type: 'xyz'`). The view
 * runs in Web Mercator like those tiles; data and displayed coordinates are
 * CH1903+ / LV95 and are transformed here, the Massstab uses the ground
 * resolution at the centre of the map.
 *
 * The Anlagenteile are a vector layer. The Empfangspunkte are the buttons
 * the viewer renders (keyboard, screen reader and tests reach them like any
 * button); they stay where the framework put them and are only positioned
 * here, on every rendered frame — moving them into the map would take them
 * away from the framework that owns them.
 */
export function createOlMapEngine(target: HTMLElement, config: MapConfig, handlers: MapEngineHandlers): MapEngine {
  proj4.defs(config.projection, LV95_DEFINITION);
  register(proj4);
  const toView = (coordinate: number[]): number[] => transform(coordinate, config.projection, VIEW);
  const toData = (coordinate: number[]): [number, number] => {
    const [east, north] = transform(coordinate, VIEW, config.projection);
    return [east, north];
  };
  const wkt = new WKT();
  const levels = config.zoom.levels;

  // Background maps: created on first use, so a session only loads the styles it shows.
  const baseGroups = new Map<string, LayerGroup>();
  const watchTiles = (source: Source | null) => {
    (source as unknown as { on?: (type: string, listener: () => void) => void } | null)?.on?.('tileloaderror', () => handlers.tileError());
  };
  const baseGroup = (base: MapBaseMapConfig): LayerGroup => {
    let group = baseGroups.get(base.id);
    if (group) return group;
    group = new LayerGroup({ opacity: base.opacity ?? 1 });
    baseGroups.set(base.id, group);
    if (base.type === 'style') {
      const styled = group;
      applyMapboxStyle(styled, base.url)
        .then(() => styled.getLayersArray().forEach((layer) => watchTiles(layer.getSource())))
        .catch(() => handlers.tileError());
    } else {
      const source = new XYZ({ url: base.url, crossOrigin: 'anonymous', attributions: base.attribution, maxZoom: base.maxZoom ?? 19 });
      watchTiles(source);
      group.getLayers().push(new TileLayer({ source }));
    }
    return group;
  };
  const backgrounds = new LayerGroup();
  const showBaseMap = (id: string) => {
    const base = config.baseMaps.find((b) => b.id === id) ?? config.baseMaps[0];
    const group = baseGroup(base);
    backgrounds.getLayers().clear();
    backgrounds.getLayers().push(group);
  };
  showBaseMap(config.defaultBaseMap);

  const plantPartSource = new VectorSource();
  const style = config.layers.plantParts;
  const plantPartLayer = new VectorLayer({
    source: plantPartSource,
    visible: style.visible,
    zIndex: 10,
    style: (feature, resolution) =>
      new Style({
        stroke: new Stroke({ color: style.stroke, width: style.strokeWidth }),
        fill: new Fill({ color: style.fill }),
        text:
          resolution <= style.labelMaxResolution
            ? new Text({
                text: String(feature.get('label') ?? ''),
                font: '600 12px Helvetica, Arial, sans-serif',
                fill: new Fill({ color: style.stroke }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                overflow: true,
              })
            : undefined,
      }),
  });

  const view = new View({
    projection: VIEW,
    extent: transformExtent(config.extent, config.projection, VIEW),
    minZoom: levels[0],
    maxZoom: levels[levels.length - 1],
    constrainResolution: true,
    center: toView(config.defaultCenter),
    zoom: levels[0],
  });

  const map = new OlMap({
    target,
    layers: [backgrounds, plantPartLayer],
    view,
    controls: [], // the viewer brings its own (B1 Abbildung 16)
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false }),
  });

  let pins: MapPin[] = [];
  let pinsVisible = config.layers.points.visible;
  /** Zoomstufe a running zoom animation heads for, so quick clicks add up. */
  let targetLevel: number | null = null;

  /** Index of the Zoomstufe the view is at (the levels are consecutive zooms of the tile pyramid). */
  const levelOf = (zoom: number) => Math.max(0, Math.min(levels.length - 1, Math.round(zoom) - levels[0]));
  /** Metres on the ground per pixel at the centre — Web Mercator stretches with the latitude. */
  const groundResolution = (resolution: number, center: number[]) => getPointResolution(VIEW, resolution, center, 'm');

  /** Places every pin at the pixel of its coordinate (`--x` / `--y` of the design-system pin). */
  const positionPins = () => {
    for (const pin of pins) {
      const pixel = pinsVisible ? map.getPixelFromCoordinate(toView([pin.east, pin.north])) : null;
      pin.element.style.display = pixel ? '' : 'none'; // the pin sets its own `display`, the `hidden` attribute would lose
      if (pixel) {
        pin.element.style.setProperty('--x', `${Math.round(pixel[0])}px`);
        pin.element.style.setProperty('--y', `${Math.round(pixel[1])}px`);
      }
    }
  };

  const emitView = () => {
    const center = view.getCenter();
    const resolution = view.getResolution();
    if (!center || !resolution) return;
    handlers.view({ zoom: levelOf(view.getZoom() ?? levels[0]), resolution: groundResolution(resolution, center), center: toData(center) });
  };
  map.on('moveend', () => {
    targetLevel = null;
    emitView();
  });
  map.on('postrender', positionPins);
  map.on('pointermove', (event) => handlers.pointer(event.dragging ? null : toData(event.coordinate)));
  const leave = () => handlers.pointer(null);
  map.getViewport().addEventListener('pointerleave', leave);

  const objectsExtent = () => {
    const extent = createEmpty();
    const parts = plantPartSource.getFeatures().length ? plantPartSource.getExtent() : null;
    if (parts) extendExtent(extent, parts);
    if (pins.length) extendExtent(extent, boundingExtent(pins.map((p) => toView([p.east, p.north]))));
    return extent;
  };

  const fit = () => {
    const extent = objectsExtent();
    if (isEmpty(extent)) {
      view.setCenter(toView(config.defaultCenter));
      view.setZoom(levels[0]);
    } else {
      // A single point has no size: give it a neighbourhood instead of the finest Zoomstufe.
      view.fit(buffer(extent, 60), { padding: Array(4).fill(config.zoom.fitPadding), maxZoom: levels[0] + config.zoom.fitMaxLevel });
    }
    emitView();
  };

  return {
    setBaseMap: showBaseMap,

    setPlantParts(parts: MapPlantPart[]) {
      plantPartSource.clear();
      for (const part of drawablePlantParts(parts, config.extent)) {
        try {
          const feature = wkt.readFeature(part.geometry as string, { dataProjection: config.projection, featureProjection: VIEW });
          feature.setId(part.id);
          feature.set('label', plantPartLabel(part));
          plantPartSource.addFeature(feature);
        } catch {
          // a geometry the format cannot read is left out, the others still show
        }
      }
    },

    setPins(next: MapPin[]) {
      pins = next;
      positionPins();
    },

    setLayerVisible(layer, visible) {
      if (layer === 'plantParts') {
        plantPartLayer.setVisible(visible);
        return;
      }
      pinsVisible = visible;
      positionPins();
    },

    fit,

    zoomBy(delta) {
      // From the Zoomstufe the view is heading for: a second click during the animation must not be lost.
      const from = targetLevel ?? levelOf(view.getZoom() ?? levels[0]);
      targetLevel = Math.max(0, Math.min(levels.length - 1, from + delta));
      view.cancelAnimations();
      view.animate({ zoom: levels[0] + targetLevel, duration: 150 });
    },

    exportImage(request: MapExportRequest): Promise<MapExportImage> {
      const size = map.getSize();
      const resolution = view.getResolution();
      const center = view.getCenter();
      if (!size || !resolution || !center) return Promise.reject(new Error('map not ready'));
      const width = Math.round((request.widthMm * request.dpi) / 25.4);
      const height = Math.round((request.heightMm * request.dpi) / 25.4);
      // Same area as on screen, at the pixel density of the export.
      const printResolution = resolution / Math.min(width / size[0], height / size[1]);

      return new Promise<MapExportImage>((resolve, reject) => {
        let done = false;
        const restore = () => {
          map.setSize(size);
          view.setConstrainResolution(true);
          view.setResolution(resolution);
          view.setCenter(center);
        };
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d') as CanvasRenderingContext2D;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            for (const layerCanvas of Array.from(map.getViewport().querySelectorAll<HTMLCanvasElement>('.ol-layer canvas, canvas.ol-layer'))) {
              if (!layerCanvas.width) continue;
              const opacity = layerCanvas.parentElement?.style.opacity || layerCanvas.style.opacity;
              context.globalAlpha = opacity === '' ? 1 : Number(opacity);
              const matrixText = layerCanvas.style.transform.match(/^matrix\(([^(]*)\)$/);
              const matrix = matrixText
                ? matrixText[1].split(',').map(Number)
                : [parseFloat(layerCanvas.style.width) / layerCanvas.width, 0, 0, parseFloat(layerCanvas.style.height) / layerCanvas.height, 0, 0];
              context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
              context.drawImage(layerCanvas, 0, 0);
            }
            context.globalAlpha = 1;
            context.setTransform(1, 0, 0, 1, 0, 0);
            drawPins(context, request, (coordinate) => map.getPixelFromCoordinate(toView(coordinate)));
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            resolve({
              dataUrl,
              widthPx: width,
              heightPx: height,
              scale: printScale(groundResolution(printResolution, center), request.dpi),
              center: toData(center),
            });
          } catch (error) {
            reject(error);
          } finally {
            restore();
          }
        };
        const timer = setTimeout(finish, EXPORT_TIMEOUT_MS);
        map.once('rendercomplete', finish);
        map.setSize([width, height]);
        view.setConstrainResolution(false);
        view.setResolution(printResolution);
        view.setCenter(center);
      });
    },

    destroy() {
      map.getViewport().removeEventListener('pointerleave', leave);
      map.setTarget(undefined);
    },
  };
}

/** The Empfangspunkte of the export: a filled circle in the Ampel colour with the code, sized in mm. */
function drawPins(context: CanvasRenderingContext2D, request: MapExportRequest, pixelOf: (coordinate: [number, number]) => number[] | null): void {
  const radius = (2.6 * request.dpi) / 25.4;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${Math.round(radius * 0.95)}px Helvetica, Arial, sans-serif`;
  for (const pin of request.pins) {
    const pixel = pixelOf([pin.east, pin.north]);
    if (!pixel) continue;
    context.beginPath();
    context.arc(pixel[0], pixel[1], radius, 0, 2 * Math.PI);
    context.fillStyle = pin.color;
    context.fill();
    context.lineWidth = Math.max(1, radius / 5);
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.fillStyle = '#ffffff';
    context.fillText(pin.code, pixel[0], pixel[1]);
  }
}
