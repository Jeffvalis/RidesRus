import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DriverStateDTO, DriverStopGroup, STOP_ARRIVAL_RADIUS_M, shortName } from '@ridesrus/core';
import { APP_CONFIG, AppConfig } from '../config';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

const REFRESH_MS = 3_000;

/**
 * Builds the driver console's entire screen state on the server and pushes it
 * over the socket. The tablet renders what it's given — no client-side
 * reconciliation of hails, trips and seats that could drift out of sync.
 */
@Injectable()
export class DriverStateService implements OnModuleInit, OnModuleDestroy {
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly realtime: RealtimeService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    // ETAs change as the bus moves, so on-shift consoles get a gentle refresh.
    if (this.config.NODE_ENV !== 'test') {
      this.timer = setInterval(() => {
        for (const bus of this.network.allBuses()) if (this.fleet.activeShiftId(bus.id)) this.publishSoon(bus.id);
      }, REFRESH_MS);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    for (const t of this.pending.values()) clearTimeout(t);
  }

  /** Coalesces bursts (e.g. five boardings in a second) into one push. */
  publishSoon(busId: string) {
    if (!this.fleet.activeShiftId(busId) || this.pending.has(busId)) return;
    this.pending.set(
      busId,
      setTimeout(async () => {
        this.pending.delete(busId);
        const state = await this.build(busId).catch(() => null);
        if (state) this.realtime.toBus(busId, 'driver:state', state);
      }, 150),
    );
  }

  async build(busId: string): Promise<DriverStateDTO | null> {
    const shiftId = this.fleet.activeShiftId(busId);
    if (!shiftId) return null;
    const bus = this.network.bus(busId);
    const { dto: route, geometry } = this.network.route(bus.routeId);

    const [shift, hails, onboard, recent, fare] = await Promise.all([
      this.prisma.shift.findUnique({ where: { id: shiftId }, include: { driver: true } }),
      this.prisma.hail.findMany({ where: { busId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } } }),
      this.prisma.trip.findMany({ where: { busId, status: 'BOARDED' }, select: { dropoffStopId: true } }),
      this.prisma.trip.findMany({
        where: { shiftId },
        orderBy: { boardedAt: 'desc' },
        take: 6,
        include: { passenger: { select: { name: true } } },
      }),
      this.prisma.trip.aggregate({ where: { shiftId, status: { not: 'VOIDED' } }, _sum: { fareKobo: true } }),
    ]);
    if (!shift) return null;

    const live = this.fleet.position(busId);
    const approach = (stopId: string) => {
      const metres = live ? geometry.metresUntilStop(live.loopPos, stopId) : 0;
      return { metres: Math.round(metres), etaSec: geometry.etaSeconds(metres) };
    };
    const group = (stopId: string, count: number): DriverStopGroup => ({
      stopId,
      stopName: this.network.stopName(stopId) ?? 'Unknown stop',
      count,
      ...approach(stopId),
    });

    const pickupMap = new Map<string, { ids: string[]; acked: boolean }>();
    for (const h of hails) {
      const g = pickupMap.get(h.stopId) ?? { ids: [], acked: true };
      g.ids.push(h.id);
      g.acked &&= h.status === 'ACKNOWLEDGED';
      pickupMap.set(h.stopId, g);
    }
    const dropMap = new Map<string, number>();
    let undecided = 0;
    for (const t of onboard) {
      if (t.dropoffStopId) dropMap.set(t.dropoffStopId, (dropMap.get(t.dropoffStopId) ?? 0) + 1);
      else undecided++;
    }

    const next = live ? geometry.nextStop(live.loopPos) : null;
    // "At" a stop means within the arrival radius, so the console never offers a stop the bus has already left.
    const at = this.fleet.stopAtBus(busId, STOP_ARRIVAL_RADIUS_M);

    return {
      shift: { id: shift.id, startedAt: shift.startedAt.getTime(), expiresAt: shift.expiresAt.getTime() },
      driver: { id: shift.driver.id, code: shift.driver.code, name: shift.driver.name },
      bus: { id: bus.id, code: bus.code, plate: bus.plate, capacity: bus.capacity },
      route: { id: route.id, code: route.code, name: route.name, fareKobo: route.fareKobo },
      occupied: this.fleet.occupied(busId),
      position: live ? { lat: live.lat, lng: live.lng, heading: Math.round(live.heading), direction: live.direction } : null,
      currentStop: at ? { ...group(at, dropMap.get(at) ?? 0), metres: 0, etaSec: 0 } : null,
      nextStop: next && Number.isFinite(next.metres) ? group(next.stopId, dropMap.get(next.stopId) ?? 0) : null,
      pickups: [...pickupMap.entries()]
        .map(([stopId, g]) => ({ ...group(stopId, g.ids.length), hailIds: g.ids, acknowledged: g.acked }))
        .sort((a, b) => a.metres - b.metres),
      dropoffs: [...dropMap.entries()].map(([stopId, n]) => group(stopId, n)).sort((a, b) => a.metres - b.metres),
      undecided,
      recentBoardings: recent.map((t) => ({ tripId: t.id, passengerName: shortName(t.passenger.name), at: t.boardedAt.getTime() })),
      todayFareKobo: fare._sum.fareKobo ?? 0,
    };
  }
}
