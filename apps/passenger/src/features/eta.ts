import { useMemo } from 'react';
import { BusLiveDTO, RouteDTO, RouteGeometry, distanceAlong } from '@ridesrus/core';

export type Approach = { bus: BusLiveDTO; metres: number; etaSec: number; towards: string };

/** Route geometry, built once per route. */
export function useGeometry(route: RouteDTO | null) {
  return useMemo(() => (route ? new RouteGeometry(route) : null), [route]);
}

function loopPosOf(geometry: RouteGeometry, bus: BusLiveDTO) {
  const { along } = distanceAlong(geometry.path, geometry.cumulative, bus);
  return geometry.loopPos(along, bus.direction);
}

/** How far (and how long) until `bus` next reaches `stopId`, plus where it's heading. */
export function approachOf(geometry: RouteGeometry, route: RouteDTO, bus: BusLiveDTO, stopId: string): Approach {
  const metres = geometry.metresUntilStop(loopPosOf(geometry, bus), stopId);
  const terminus = bus.direction === 'EASTBOUND' ? route.stops[route.stops.length - 1] : route.stops[0];
  return { bus, metres, etaSec: geometry.etaSeconds(metres), towards: terminus.name };
}

/** Buses in service, soonest to the rider's stop first. */
export function useApproaching(route: RouteDTO | null, buses: Record<string, BusLiveDTO>, stopId: string | null): Approach[] {
  const geometry = useGeometry(route);
  return useMemo(() => {
    if (!geometry || !route || !stopId) return [];
    return Object.values(buses)
      .filter((b) => b.inService)
      .map((b) => approachOf(geometry, route, b, stopId))
      .sort((a, b) => a.metres - b.metres);
  }, [geometry, route, buses, stopId]);
}

/**
 * Stops ahead of a bus in its direction of travel, in the order it reaches
 * them (for picking a drop-off). Stops past the terminus are excluded: riding
 * through the turnaround is never quicker than boarding the opposite bus.
 */
export function stopsAhead(geometry: RouteGeometry, route: RouteDTO, bus: BusLiveDTO) {
  const pos = loopPosOf(geometry, bus);
  const terminus = bus.direction === 'EASTBOUND' ? route.stops[route.stops.length - 1] : route.stops[0];
  const toTerminus = geometry.metresUntilStop(pos, terminus.id);
  return route.stops
    .map((s) => {
      const metres = geometry.metresUntilStop(pos, s.id);
      return { stop: s, metres, etaSec: geometry.etaSeconds(metres) };
    })
    .filter((s) => s.metres > 40 && s.metres <= toTerminus + 1)
    .sort((a, b) => a.metres - b.metres);
}
