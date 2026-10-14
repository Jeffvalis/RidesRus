import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RouteGeometry, STOP_ARRIVAL_RADIUS_M } from '@ridesrus/core';
import { APP_CONFIG, AppConfig } from '../config';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { HailsService } from '../journeys/hails.service';
import { QrService } from '../journeys/qr.service';
import { TripsService } from '../journeys/trips.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';
import { TopUpsService } from '../wallet/topups.service';

export const SIM_RIDER_DOMAIN = 'sim.ridesrus.app';

const TICK_MS = 1_000;
const DWELL_MS = 9_000;

type SimBus = { busId: string; loopPos: number; dwellUntil: number; atStopId: string | null };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * DEMO MODE ONLY — makes the public demo feel like a live morning on the corridor.
 *
 * Buses without a live GPS feed are driven along the route, dwell at stops, and
 * a pool of simulated riders hail, scan, pay, pick drop-offs and rate trips.
 * Crucially, riders go through the *same* services as real users (HailsService,
 * TripsService, LedgerService), so every number on the dashboards is produced
 * by real transactions — nothing is faked at the presentation layer. A real
 * visitor can hail the same buses alongside them.
 */
@Injectable()
export class AutopilotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Autopilot');
  private readonly buses = new Map<string, SimBus>();
  private riders: string[] = [];
  private readonly busy = new Set<string>();
  private readonly decidedRatings = new Set<string>();
  private timers: NodeJS.Timeout[] = [];
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly hails: HailsService,
    private readonly trips: TripsService,
    private readonly qr: QrService,
    private readonly ledger: LedgerService,
    private readonly topUps: TopUpsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.DEMO_MODE || this.config.NODE_ENV === 'test') return;
    const riders = await this.prisma.passenger.findMany({
      where: { email: { endsWith: `@${SIM_RIDER_DOMAIN}` } },
      select: { id: true },
    });
    this.riders = riders.map((r) => r.id);
    const onboard = await this.prisma.trip.findMany({ where: { passengerId: { in: this.riders }, status: 'BOARDED' } });
    for (const t of onboard) this.busy.add(t.passengerId);

    const all = this.network.allBuses();
    all.forEach((bus, i) => {
      const geometry = this.network.geometryForBus(bus.id);
      // Spread buses evenly around the loop so the map looks like a real timetable.
      this.buses.set(bus.id, { busId: bus.id, loopPos: (geometry.loopLength * i) / all.length, dwellUntil: 0, atStopId: null });
    });

    this.timers.push(setInterval(() => this.tick(), TICK_MS));
    this.timers.push(setInterval(() => this.rateFinishedTrips().catch(() => undefined), 10_000));
    this.logger.log(`Driving ${all.length} buses with ${this.riders.length} simulated riders`);
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      for (const sim of this.buses.values()) {
        if (this.fleet.hasFreshGps(sim.busId)) {
          // A real tablet is reporting; keep our cursor in sync so we resume smoothly if it drops.
          const live = this.fleet.position(sim.busId);
          if (live) sim.loopPos = live.loopPos;
          continue;
        }
        if (sim.dwellUntil > now) {
          this.fleet.setSimulated(sim.busId, sim.loopPos);
          continue;
        }
        if (sim.atStopId) await this.depart(sim);
        this.advance(sim);
      }
      await this.acknowledgeForDriverlessBuses();
    } catch (err) {
      this.logger.warn(`tick failed: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private advance(sim: SimBus) {
    const geometry = this.network.geometryForBus(sim.busId);
    const step = geometry.route.avgSpeedMps * rand(0.75, 1.25) * this.config.DEMO_SPEEDUP * (TICK_MS / 1000);
    const next = geometry.nextStop(sim.loopPos);
    if (next.metres <= step) {
      sim.loopPos = geometry.wrap(sim.loopPos + next.metres);
      sim.atStopId = next.stopId;
      sim.dwellUntil = Date.now() + DWELL_MS;
      this.fleet.setSimulated(sim.busId, sim.loopPos);
      this.arrive(sim).catch((e) => this.logger.warn(`arrive: ${e.message}`));
      return;
    }
    sim.loopPos = geometry.wrap(sim.loopPos + step);
    this.fleet.setSimulated(sim.busId, sim.loopPos);
  }

  /** At a stop: hailed riders board, plus the odd walk-up. Drop-offs are completed by the geofence. */
  private async arrive(sim: SimBus) {
    const stopId = sim.atStopId!;
    const waiting = await this.prisma.hail.findMany({
      where: { busId: sim.busId, stopId, status: { in: ['PENDING', 'ACKNOWLEDGED'] }, passengerId: { in: this.riders } },
    });
    for (const hail of waiting) await this.board(sim.busId, hail.passengerId);
    const walkUps = Math.random() < 0.45 ? randInt(1, 2) : 0;
    for (let i = 0; i < walkUps; i++) {
      const rider = this.idleRider();
      if (rider) await this.board(sim.busId, rider);
    }
  }

  /**
   * Buses with no human driver on shift still need someone to "see" hails —
   * including hails from real demo visitors — or the rider waits on "Hail sent"
   * forever. Autopilot acknowledges them after a short, human-like delay.
   */
  private async acknowledgeForDriverlessBuses() {
    const pending = await this.prisma.hail.findMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 4_000) } },
      select: { id: true, busId: true },
    });
    const byBus = new Map<string, string[]>();
    for (const h of pending) {
      if (this.fleet.activeShiftId(h.busId)) continue; // a real driver acknowledges their own hails
      byBus.set(h.busId, [...(byBus.get(h.busId) ?? []), h.id]);
    }
    for (const [busId, ids] of byBus) await this.hails.acknowledge(busId, ids).catch(() => undefined);
  }

  /** Leaving a stop: riders further down the line hail this bus. */
  private async depart(sim: SimBus) {
    sim.atStopId = null;
    const geometry = this.network.geometryForBus(sim.busId);
    const bus = this.network.bus(sim.busId);
    if (this.fleet.occupied(sim.busId) >= bus.capacity - 2) return;
    const ahead = this.stopsAhead(geometry, sim.loopPos).slice(0, 2);
    for (const stopId of ahead) {
      const count = Math.random() < 0.55 ? randInt(1, 2) : 0;
      for (let i = 0; i < count; i++) {
        const rider = this.idleRider();
        if (!rider) return;
        const stop = this.network.stop(stopId);
        this.busy.add(rider);
        await this.hails
          .create(rider, { busId: sim.busId, lat: stop.lat + rand(-0.0006, 0.0006), lng: stop.lng + rand(-0.0006, 0.0006) })
          .catch(() => this.busy.delete(rider));
      }
    }
  }

  private async board(busId: string, riderId: string) {
    this.busy.add(riderId);
    try {
      const fare = this.network.route(this.network.bus(busId).routeId).dto.fareKobo;
      if ((await this.ledger.balance(riderId)) < fare) {
        await this.topUps.grantPromo(riderId, fare * 10, `sim_topup_${randomUUID()}`, 'Demo wallet top-up');
      }
      const { trip } = await this.trips.board(riderId, { qrToken: this.qr.issue(busId).token, idempotencyKey: randomUUID() });
      const geometry = this.network.geometryForBus(busId);
      const live = this.fleet.position(busId);
      const ahead = live ? this.stopsAhead(geometry, live.loopPos).slice(0, 6) : [];
      if (ahead.length === 0) return;
      const dropoff = pick(ahead);
      // Most riders choose straight away; some take a moment (the driver sees them as "undecided").
      const delay = Math.random() < 0.8 ? rand(1_000, 3_000) : rand(15_000, 30_000);
      setTimeout(() => this.trips.setDropoff(riderId, trip.id, dropoff).catch(() => undefined), delay);
    } catch {
      // Bus full, already on a trip, etc. — exactly the cases real riders hit.
      const onTrip = await this.prisma.trip.count({ where: { passengerId: riderId, status: 'BOARDED' } });
      if (!onTrip) this.busy.delete(riderId);
    }
  }

  /** Stops ahead in the direction of travel, up to the terminus (riders don't ride through the turnaround). */
  private stopsAhead(geometry: RouteGeometry, loopPos: number): string[] {
    const stops = geometry.route.stops;
    const terminus = geometry.directionAt(loopPos) === 'EASTBOUND' ? stops[stops.length - 1] : stops[0];
    const toTerminus = geometry.metresUntilStop(loopPos, terminus.id);
    return stops
      .map((s) => ({ id: s.id, m: geometry.metresUntilStop(loopPos, s.id) }))
      .filter((s) => s.m > STOP_ARRIVAL_RADIUS_M && s.m <= toTerminus + 1)
      .sort((a, b) => a.m - b.m)
      .map((s) => s.id);
  }

  private idleRider(): string | null {
    const idle = this.riders.filter((r) => !this.busy.has(r));
    return idle.length ? pick(idle) : null;
  }

  /** Frees riders whose trips ended, and has about a third of them leave a rating. */
  private async rateFinishedTrips() {
    const finished = await this.prisma.trip.findMany({
      where: { passengerId: { in: this.riders }, status: { in: ['COMPLETED', 'VOIDED'] }, completedAt: { gte: new Date(Date.now() - 120_000) } },
      select: { id: true, passengerId: true, rating: true, status: true },
    });
    const stillHailing = await this.prisma.hail.findMany({
      where: { passengerId: { in: this.riders }, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
      select: { passengerId: true },
    });
    const active = new Set(stillHailing.map((h) => h.passengerId));
    const onboard = await this.prisma.trip.findMany({ where: { passengerId: { in: this.riders }, status: 'BOARDED' }, select: { passengerId: true } });
    for (const t of onboard) active.add(t.passengerId);
    for (const r of [...this.busy]) if (!active.has(r)) this.busy.delete(r);

    for (const t of finished) {
      if (t.status !== 'COMPLETED' || t.rating !== null || this.decidedRatings.has(t.id)) continue;
      this.decidedRatings.add(t.id);
      if (Math.random() > 0.35) continue;
      const rating = pick([5, 5, 5, 4, 4, 4, 3]);
      await this.trips.rate(t.passengerId, t.id, { rating }).catch(() => undefined);
    }
  }
}
