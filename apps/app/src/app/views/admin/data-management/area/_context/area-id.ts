import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Signal } from '@angular/core';
import { map } from 'rxjs';

/** Name of the route parameter that carries the Schiessplatz under `/admin/data-management/area/:areaId/…`. */
export const AREA_ID_PARAM = 'areaId';

/** The nearest `:areaId` up the route tree (the pages sit two levels below the context route). */
export function areaIdRoute(route: ActivatedRoute): ActivatedRoute {
  let current: ActivatedRoute | null = route;
  while (current) {
    if (current.snapshot.paramMap.has(AREA_ID_PARAM)) return current;
    current = current.parent;
  }
  return route;
}

/** Signal of the `:areaId` of the enclosing context route ('' outside of it). */
export function areaIdSignal(route: ActivatedRoute): Signal<string> {
  const owner = areaIdRoute(route);
  return toSignal(owner.paramMap.pipe(map((p) => p.get(AREA_ID_PARAM) ?? '')), {
    initialValue: owner.snapshot.paramMap.get(AREA_ID_PARAM) ?? '',
  });
}
