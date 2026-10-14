import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  BusLiveDTO,
  Direction,
  LocationPing,
  STOP_ARRIVAL_RADIUS_M,
  bearing,
  distanceAlong,
  haversine,
  pointAlong,
  seatBand,
} from '@ridesrus/core';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NetworkService } from './network.service';

type LiveBus = {
  busId: string;
  lat: number;
  lng: number;
  heading: number;
  /** Metres around the out-and-back loop; see RouteGeometry. */
  loopPos: number;
  direction: Direction;
  source: 'GPS' | 'SIMULATED';
  updatedAt: number;
  lastStopId: string | null;
  lastStopAt: number;
};

export type ArrivalHandler = (busId: string, stopId: string) => Promise<void> | void;

/** A GPS fix older than this means the tablet is offline; demo autopilot may take over. */
export const GPS_STALE_MS = 20_000;
const BROADCAST_MS = 1_000;
/** Ignore fixes this far from the route line for stop detection (detours, bad GPS). */
const OFF_ROUTE_M = 250;

/**
 * Live, in-memory picture of the fleet: where each bus is, which way it's going,
 * how full it is and whether it's in service. High-frequency GPS never touches
 * Postgres. Occupancy is mirrored from the DB (the source of truth) after every
 * boarding/drop-off transaction.
 *
 * Single-instance by design for the pilot (6–50 buses ≈ 50 msgs/s). To run
 * multiple API instances, move `live` into Redis and add the Socket.IO Redis
 * adapter — see docs/architecture.md.
 */
@Injectable()
export class FleetStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Fleet');
  private readonly live = new Map<string, LiveBus>();
  private readonly occupancy = new Map<string, number>();
  /** busId → shiftId for buses with a driver signed in. */
  private readonly shifts = new Map<string, string>();
  private readonly arrivalHandlers: ArrivalHandler[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly realtime: RealtimeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onModuleInit() {
    const [buses, shifts] = await Promise.all([
      this.prisma.bus.findMany({ select: { id: true, occupied: true } }),
      this.prisma.shift.findMany({ where: { endedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    for (const b of buses) this.occupancy.set(b.id, b.occupied);
    for (const s of shifts) this.shifts.set(s.busId, s.id);
    if (this.config.NODE_ENV !== 'test') this.timer = setInterval(() => this.broadcast(), BROADCAST_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  onArrival(handler: ArrivalHandler) {
    this.arrivalHandlers.push(handler);
  }

  /* ─────────────── Shifts & occupancy ─────────────── */

  setShift(busId: string, shiftId: string | null) {
    if (shiftId) this.shifts.set(busId, shiftId);
    else this.shifts.delete(busId);
  }

  activeShiftId(busId: string): string | null {
    return this.shifts.get(busId) ?? null;
  }

  setOccupancy(busId: string, occupied: number) {
    this.occupancy.set(busId, occupied);
  }

  occupied(busId: string): number {
    return this.occupancy.get(busId) ?? 0;
  }

  /** A bus can take hails and boardings if a driver is on shift, or (demo) autopilot is driving it. */
  inService(busId: string): boolean {
    if (this.shifts.has(busId)) return true;
    const bus = this.live.get(busId);
    return this.config.DEMO_MODE && !!bus && bus.source === 'SIMULATED';
  }

  hasFreshGps(busId: string): boolean {
    const bus = this.live.get(busId);
    return !!bus && bus.source === 'GPS' && Date.now() - bus.updatedAt < GPS_STALE_MS;
  }

  position(busId: string): LiveBus | null {
    return this.live.get(busId) ?? null;
  }

  /** Nearest stop to the bus if it is effectively at one (used to stamp boarding stops). */
  stopAtBus(busId: string, radiusM = 150): string | null {
    const bus = this.live.get(busId);
    if (!bus) return null;
    const nearest = this.network.geometryForBus(busId).nearestStop(bus);
    return nearest.metres <= radiusM ? nearest.stopId : null;
  }

  /* ─────────────── Position updates ─────────────── */

  /** A real GPS fix from a driver tablet. */
  ingestGps(busId: string, ping: LocationPing) {
    const geometry = this.network.geometryForBus(busId);
    const prev = this.live.get(busId);
    const { along, offset } = distanceAlong(geometry.path, geometry.cumulative, ping);

    let direction: Direction = prev?.direction ?? 'EASTBOUND';
    const prevLine = prev ? geometry.linePos(prev.loopPos) : along;
    if (along - prevLine > 3) direction = 'EASTBOUND';
    else if (prevLine - along > 3) direction = 'WESTBOUND';
    if (along > geometry.length - 60) direction = 'WESTBOUND';
    if (along < 60) direction = 'EASTBOUND';

    const heading =
      ping.heading ?? (prev && haversine(prev, ping) > 3 ? bearing(prev, ping) : (prev?.heading ?? 0));

    const next: LiveBus = {
      busId,
      lat: ping.lat,
      lng: ping.lng,
      heading,
      loopPos: offset <= OFF_ROUTE_M ? geometry.loopPos(along, direction) : (prev?.loopPos ?? 0),
      direction,
      source: 'GPS',
      updatedAt: Date.now(),
      lastStopId: prev?.lastStopId ?? null,
      lastStopAt: prev?.lastStopAt ?? 0,
    };
    this.live.set(busId, next);
    if (offset <= OFF_ROUTE_M) this.detectArrival(next);
  }

  /** Autopilot position (demo mode), expressed directly as a loop position. */
  setSimulated(busId: string, loopPos: number) {
    const geometry = this.network.geometryForBus(busId);
    const prev = this.live.get(busId);
    const pos = pointAlong(geometry.path, geometry.cumulative, geometry.linePos(loopPos));
    const heading = prev && haversine(prev, pos) > 1 ? bearing(prev, pos) : (prev?.heading ?? 90);
    const next: LiveBus = {
      busId,
      ...pos,
      heading,
      loopPos: geometry.wrap(loopPos),
      direction: geometry.directionAt(loopPos),
      source: 'SIMULATED',
      updatedAt: Date.now(),
      lastStopId: prev?.lastStopId ?? null,
      lastStopAt: prev?.lastStopAt ?? 0,
    };
    this.live.set(busId, next);
    this.detectArrival(next);
  }

  private detectArrival(bus: LiveBus) {
    const geometry = this.network.geometryForBus(bus.busId);
    const nearest = geometry.nearestStop(bus);
    if (nearest.metres > STOP_ARRIVAL_RADIUS_M) return;
    // Once per pass: same stop again only after the bus has clearly left and come back.
    if (nearest.stopId === bus.lastStopId && Date.now() - bus.lastStopAt < 5 * 60_000) return;
    bus.lastStopId = nearest.stopId;
    bus.lastStopAt = Date.now();
    for (const handler of this.arrivalHandlers) {
      Promise.resolve(handler(bus.busId, nearest.stopId)).catch((err) =>
        this.logger.error(`Arrival handler failed for ${bus.busId}@${nearest.stopId}: ${err?.message ?? err}`),
      );
    }
  }

  /* ─────────────── Read models ─────────────── */

  toDTO(busId: string): BusLiveDTO | null {
    const bus = this.live.get(busId);
    if (!bus) return null;
    const info = this.network.bus(busId);
    const geometry = this.network.geometryForBus(busId);
    const next = geometry.nextStop(bus.loopPos);
    const occupied = this.occupied(busId);
    return {
      id: busId,
      code: info.code,
      plate: info.plate,
      routeId: info.routeId,
      lat: bus.lat,
      lng: bus.lng,
      heading: Math.round(bus.heading),
      direction: bus.direction,
      occupied,
      capacity: info.capacity,
      band: seatBand(occupied, info.capacity),
      nextStopId: next.stopId,
      nextStopEtaSec: Number.isFinite(next.metres) ? geometry.etaSeconds(next.metres) : null,
      inService: this.inService(busId),
      source: bus.source,
      updatedAt: bus.updatedAt,
    };
  }

  snapshot(): BusLiveDTO[] {
    return [...this.live.keys()]
      .map((id) => this.toDTO(id))
      .filter((b): b is BusLiveDTO => !!b && (b.inService || Date.now() - b.updatedAt < GPS_STALE_MS));
  }

  /** Metres / seconds until a bus reaches a stop. */
  approach(busId: string, stopId: string): { metres: number; etaSec: number } | null {
    const bus = this.live.get(busId);
    if (!bus) return null;
    const geometry = this.network.geometryForBus(busId);
    const metres = geometry.metresUntilStop(bus.loopPos, stopId);
    return { metres, etaSec: geometry.etaSeconds(metres) };
  }

  private broadcast() {
    this.realtime.toFleet('fleet:update', { buses: this.snapshot(), at: Date.now() });
  }
}
