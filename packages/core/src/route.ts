import { LatLng, cumulativeDistances, distanceAlong, haversine } from './geo';
import { naira, Kobo } from './money';

/**
 * Route geometry.
 *
 * A route is a physical line (west → east) that buses drive out and back.
 * We model a bus's position as `loopPos` — metres travelled around the loop
 * of length 2L:  [0, L) = eastbound, [L, 2L) = westbound.  Every question the
 * product asks ("what's the next stop?", "how far until Chevron?", "which
 * drop-offs come first?") becomes one modular subtraction on that loop.
 */
export type StopSeed = { id: string; name: string; lat: number; lng: number };

export type RouteSeed = {
  id: string;
  code: string;
  name: string;
  fareKobo: Kobo;
  /** Average operating speed used for ETAs, metres/second. */
  avgSpeedMps: number;
  stops: StopSeed[];
  /** Road geometry west → east. Must start at the first stop and end at the last. */
  path: LatLng[];
};

/**
 * Lekki – Victoria Island corridor (Lekki-Epe Expressway).
 * Coordinates are approximate and good to a few tens of metres — fine for a
 * pilot map; replace with a surveyed GTFS shape before launch.
 */
export const LEKKI_VI_CORRIDOR: RouteSeed = {
  id: 'route_lekki_vi',
  code: '42A',
  name: 'Victoria Island – Ajah',
  fareKobo: naira(500),
  avgSpeedMps: 5.5, // ≈ 20 km/h, realistic Lekki traffic average
  stops: [
    { id: 'stop_falomo', name: 'Falomo', lat: 6.4447, lng: 3.4262 },
    { id: 'stop_ozumba', name: 'Ozumba Mbadiwe', lat: 6.4362, lng: 3.4378 },
    { id: 'stop_lekki_toll', name: 'Lekki Toll Gate', lat: 6.4352, lng: 3.4551 },
    { id: 'stop_lekki_phase1', name: 'Lekki Phase 1', lat: 6.4404, lng: 3.4722 },
    { id: 'stop_ikate', name: 'Ikate', lat: 6.4421, lng: 3.4912 },
    { id: 'stop_jakande', name: 'Jakande', lat: 6.4432, lng: 3.5112 },
    { id: 'stop_chevron', name: 'Chevron', lat: 6.4447, lng: 3.5302 },
    { id: 'stop_vgc', name: 'VGC', lat: 6.4566, lng: 3.5478 },
    { id: 'stop_ajah', name: 'Ajah', lat: 6.4679, lng: 3.5697 },
  ],
  path: [
    { lat: 6.4447, lng: 3.4262 },
    { lat: 6.4419, lng: 3.4301 },
    { lat: 6.4385, lng: 3.4339 },
    { lat: 6.4362, lng: 3.4378 },
    { lat: 6.4347, lng: 3.4442 },
    { lat: 6.4344, lng: 3.4503 },
    { lat: 6.4352, lng: 3.4551 },
    { lat: 6.4371, lng: 3.4622 },
    { lat: 6.4389, lng: 3.4675 },
    { lat: 6.4404, lng: 3.4722 },
    { lat: 6.4413, lng: 3.4815 },
    { lat: 6.4421, lng: 3.4912 },
    { lat: 6.4427, lng: 3.5012 },
    { lat: 6.4432, lng: 3.5112 },
    { lat: 6.4440, lng: 3.5208 },
    { lat: 6.4447, lng: 3.5302 },
    { lat: 6.4482, lng: 3.5368 },
    { lat: 6.4527, lng: 3.5426 },
    { lat: 6.4566, lng: 3.5478 },
    { lat: 6.4612, lng: 3.5571 },
    { lat: 6.4649, lng: 3.5640 },
    { lat: 6.4679, lng: 3.5697 },
  ],
};

export type Direction = 'EASTBOUND' | 'WESTBOUND';

/** Precomputed geometry for fast per-ping maths. Build once per route. */
export class RouteGeometry {
  readonly path: LatLng[];
  readonly cumulative: number[];
  /** Physical line length L (m). The loop is 2L. */
  readonly length: number;
  /** Position of each stop along the physical line (m from the west terminus). */
  readonly stopPos: Map<string, number>;

  constructor(readonly route: Pick<RouteSeed, 'stops' | 'path' | 'avgSpeedMps'>) {
    this.path = route.path;
    this.cumulative = cumulativeDistances(route.path);
    this.length = this.cumulative[this.cumulative.length - 1];
    this.stopPos = new Map(route.stops.map((s) => [s.id, distanceAlong(this.path, this.cumulative, s).along]));
  }

  get loopLength() {
    return this.length * 2;
  }

  directionAt(loopPos: number): Direction {
    return this.wrap(loopPos) < this.length ? 'EASTBOUND' : 'WESTBOUND';
  }

  /** Physical position (m from west terminus) for a loop position. */
  linePos(loopPos: number): number {
    const p = this.wrap(loopPos);
    return p < this.length ? p : this.loopLength - p;
  }

  /** Loop position for a physical position travelling in `direction`. */
  loopPos(linePos: number, direction: Direction): number {
    return direction === 'EASTBOUND' ? linePos : this.loopLength - linePos;
  }

  wrap(loopPos: number): number {
    const L2 = this.loopLength;
    return ((loopPos % L2) + L2) % L2;
  }

  /** Metres the bus must still drive before it next reaches `stopId`. */
  metresUntilStop(busLoopPos: number, stopId: string): number {
    const s = this.stopPos.get(stopId);
    if (s === undefined) throw new Error(`Unknown stop ${stopId}`);
    const here = this.wrap(busLoopPos);
    const candidates = [s, this.loopLength - s];
    return Math.min(...candidates.map((c) => this.wrap(c - here)));
  }

  etaSeconds(metres: number): number {
    return Math.round(metres / this.route.avgSpeedMps);
  }

  /** The next stop strictly ahead of the bus (ignores one it is sitting at, < 25 m). */
  nextStop(busLoopPos: number): { stopId: string; metres: number } {
    let best = { stopId: this.route.stops[0].id, metres: Infinity };
    for (const stop of this.route.stops) {
      const m = this.metresUntilStop(busLoopPos, stop.id);
      if (m > 25 && m < best.metres) best = { stopId: stop.id, metres: m };
    }
    return best;
  }

  /** Nearest stop to an arbitrary point, e.g. a passenger hailing from the roadside. */
  nearestStop(p: LatLng): { stopId: string; metres: number } {
    let best = { stopId: this.route.stops[0].id, metres: Infinity };
    for (const stop of this.route.stops) {
      const m = haversine(p, stop);
      if (m < best.metres) best = { stopId: stop.id, metres: m };
    }
    return best;
  }
}

/** Radius within which a bus counts as "at" a stop. */
export const STOP_ARRIVAL_RADIUS_M = 40;
