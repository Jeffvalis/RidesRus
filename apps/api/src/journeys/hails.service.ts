import { HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { ACTIVE_HAIL_STATUSES, CreateHailBody, ErrorCodes, HAIL_TTL_MS, HailDTO, shortName } from '@ridesrus/core';
import { AppError, conflict, notFound } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config';
import { DriverStateService } from '../driver/driver-state.service';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';
import { RealtimeService } from '../realtime/realtime.service';
import { isUniqueViolation, toHailDTO } from './mappers';

/** Passengers further than this from any stop on the route can't hail. */
const MAX_HAIL_DISTANCE_M = 1_500;
const EXPIRY_SWEEP_MS = 15_000;

@Injectable()
export class HailsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Hails');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly realtime: RealtimeService,
    private readonly driverState: DriverStateService,
    private readonly activity: ActivityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    if (this.config.NODE_ENV !== 'test') {
      this.timer = setInterval(() => this.expireStale().catch((e) => this.logger.error(e)), EXPIRY_SWEEP_MS);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async create(passengerId: string, body: CreateHailBody): Promise<HailDTO> {
    if (!this.network.hasBus(body.busId)) throw notFound('Bus');
    const bus = this.network.bus(body.busId);
    if (!this.fleet.inService(bus.id)) {
      throw new AppError(ErrorCodes.BUS_NOT_IN_SERVICE, `${bus.code} isn't taking passengers right now.`, HttpStatus.CONFLICT);
    }
    if (this.fleet.occupied(bus.id) >= bus.capacity) {
      throw conflict(ErrorCodes.BUS_FULL, `${bus.code} is full. Try the next bus.`);
    }

    const nearest = this.network.geometryForBus(bus.id).nearestStop(body);
    if (nearest.metres > MAX_HAIL_DISTANCE_M) {
      throw new AppError(ErrorCodes.VALIDATION, `You're too far from route stops to hail. Walk to a stop and try again.`);
    }

    const onTrip = await this.prisma.trip.findFirst({ where: { passengerId, status: 'BOARDED' }, select: { id: true } });
    if (onTrip) throw conflict(ErrorCodes.ALREADY_ON_TRIP, "You're already on a bus.");

    try {
      const hail = await this.prisma.hail.create({
        data: {
          passengerId,
          busId: bus.id,
          stopId: nearest.stopId,
          lat: body.lat,
          lng: body.lng,
          expiresAt: new Date(Date.now() + HAIL_TTL_MS),
        },
        include: { passenger: { select: { name: true } } },
      });
      const dto = toHailDTO(hail, this.network);
      this.realtime.toPassenger(passengerId, 'hail:updated', dto);
      this.driverState.publishSoon(bus.id);
      this.activity.record('HAIL', `${shortName(hail.passenger.name)} hailed ${bus.code} at ${dto.stopName}`, bus.code);
      return dto;
    } catch (err) {
      // Partial unique index: one active hail per passenger.
      if (isUniqueViolation(err)) throw conflict(ErrorCodes.HAIL_EXISTS, 'You already have a hail out. Cancel it to hail another bus.');
      throw err;
    }
  }

  async cancel(passengerId: string, hailId: string): Promise<HailDTO> {
    const hail = await this.prisma.hail.findFirst({ where: { id: hailId, passengerId } });
    if (!hail) throw notFound('Hail');
    const updated = await this.prisma.hail.updateMany({
      where: { id: hailId, status: { in: [...ACTIVE_HAIL_STATUSES] } },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
    });
    if (updated.count === 0) throw conflict(ErrorCodes.INVALID_TRANSITION, 'This hail is no longer active.');
    const dto = toHailDTO({ ...hail, status: 'CANCELLED' }, this.network);
    this.realtime.toPassenger(passengerId, 'hail:updated', dto);
    this.driverState.publishSoon(hail.busId);
    return dto;
  }

  /** Driver taps "Acknowledge" — passengers see the driver has seen them. */
  async acknowledge(busId: string, hailIds: string[]): Promise<number> {
    const hails = await this.prisma.hail.findMany({ where: { id: { in: hailIds }, busId, status: 'PENDING' } });
    if (hails.length === 0) return 0;
    const now = new Date();
    await this.prisma.hail.updateMany({
      where: { id: { in: hails.map((h) => h.id) }, status: 'PENDING' },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: now },
    });
    for (const h of hails) {
      this.realtime.toPassenger(h.passengerId, 'hail:updated', toHailDTO({ ...h, status: 'ACKNOWLEDGED', acknowledgedAt: now }, this.network));
    }
    this.driverState.publishSoon(busId);
    return hails.length;
  }

  async expireStale() {
    const stale = await this.prisma.hail.findMany({
      where: { status: { in: [...ACTIVE_HAIL_STATUSES] }, expiresAt: { lt: new Date() } },
    });
    if (stale.length === 0) return;
    await this.prisma.hail.updateMany({
      where: { id: { in: stale.map((h) => h.id) }, status: { in: [...ACTIVE_HAIL_STATUSES] } },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    const buses = new Set<string>();
    for (const h of stale) {
      this.realtime.toPassenger(h.passengerId, 'hail:updated', toHailDTO({ ...h, status: 'EXPIRED' }, this.network));
      buses.add(h.busId);
    }
    for (const b of buses) this.driverState.publishSoon(b);
  }
}
