import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import {
  AdminBusDTO,
  AdminDriverDTO,
  AdminOverviewDTO,
  AdminTripDTO,
  CreateDriverBody,
  ErrorCodes,
  IssuedShiftKeyDTO,
} from '@ridesrus/core';
import { conflict, notFound } from '../common/errors';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { isUniqueViolation, toTripDTO } from '../journeys/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';

const SHIFT_KEY_TTL_MS = 15 * 60_000;
/** Lagos is UTC+1 all year; "today" for operations means the Lagos calendar day. */
const LAGOS_OFFSET_MS = 60 * 60_000;

export function startOfLagosDay(now = Date.now()): Date {
  const lagos = now + LAGOS_OFFSET_MS;
  return new Date(lagos - (lagos % 86_400_000) - LAGOS_OFFSET_MS);
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly activity: ActivityService,
  ) {}

  async overview(): Promise<AdminOverviewDTO> {
    const since = startOfLagosDay();
    const buses = this.network.allBuses();
    const [hails, hailsBoarded, hailsResolved, boardings, completed, fare, ratings, withDropoff] = await Promise.all([
      this.prisma.hail.count({ where: { createdAt: { gte: since } } }),
      this.prisma.hail.count({ where: { createdAt: { gte: since }, status: 'BOARDED' } }),
      this.prisma.hail.count({ where: { createdAt: { gte: since }, status: { in: ['BOARDED', 'EXPIRED', 'CANCELLED'] } } }),
      this.prisma.trip.count({ where: { boardedAt: { gte: since } } }),
      this.prisma.trip.count({ where: { boardedAt: { gte: since }, status: 'COMPLETED' } }),
      this.prisma.trip.aggregate({ where: { boardedAt: { gte: since }, status: { not: 'VOIDED' } }, _sum: { fareKobo: true } }),
      this.prisma.trip.aggregate({ where: { ratedAt: { gte: since } }, _avg: { rating: true }, _count: { rating: true } }),
      this.prisma.trip.count({ where: { boardedAt: { gte: since }, dropoffStopId: { not: null } } }),
    ]);
    return {
      busesInService: buses.filter((b) => this.fleet.inService(b.id)).length,
      busesTotal: buses.length,
      passengersOnboard: buses.reduce((s, b) => s + this.fleet.occupied(b.id), 0),
      seatsTotal: buses.reduce((s, b) => s + b.capacity, 0),
      today: {
        hails,
        boardings,
        hailConversion: ratio(hailsBoarded, hailsResolved),
        completedTrips: completed,
        fareVolumeKobo: fare._sum.fareKobo ?? 0,
        avgRating: ratings._avg.rating,
        ratingsCount: ratings._count.rating,
        dropoffSelectionRate: ratio(withDropoff, boardings),
      },
    };
  }

  async drivers(): Promise<AdminDriverDTO[]> {
    const since = startOfLagosDay();
    const drivers = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'asc' },
      include: { shifts: { where: { endedAt: null, expiresAt: { gt: new Date() } }, include: { bus: true }, take: 1 } },
    });
    const stats = await this.prisma.$queryRaw<{ driverId: string; avg: number | null; today: bigint }[]>`
      SELECT s."driverId",
             AVG(t.rating)::float AS avg,
             COUNT(*) FILTER (WHERE t."boardedAt" >= ${since}) AS today
      FROM "Trip" t JOIN "Shift" s ON s.id = t."shiftId"
      GROUP BY s."driverId"`;
    const byDriver = new Map(stats.map((s) => [s.driverId, s]));
    return drivers.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      phone: d.phone,
      onShift: d.shifts.length > 0,
      shiftId: d.shifts[0]?.id ?? null,
      busCode: d.shifts[0]?.bus.code ?? null,
      avgRating: byDriver.get(d.id)?.avg ?? null,
      tripsToday: Number(byDriver.get(d.id)?.today ?? 0),
    }));
  }

  async createDriver(body: CreateDriverBody): Promise<AdminDriverDTO> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `RR-${randomInt(1000, 10000)}`;
      try {
        const d = await this.prisma.driver.create({ data: { code, name: body.name, phone: body.phone } });
        this.activity.record('SHIFT', `New driver enrolled: ${d.name} (${d.code})`);
        return { id: d.id, code: d.code, name: d.name, phone: d.phone, onShift: false, shiftId: null, busCode: null, avgRating: null, tripsToday: 0 };
      } catch (err) {
        if (isUniqueViolation(err, 'phone')) throw conflict(ErrorCodes.CONFLICT, 'A driver with this phone number already exists.');
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw conflict(ErrorCodes.CONFLICT, 'Could not allocate a driver ID; try again.');
  }

  /** The PIN is returned exactly once; only its hash is stored. */
  async issueShiftKey(driverId: string, busId: string): Promise<IssuedShiftKeyDTO> {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw notFound('Driver');
    const bus = this.network.bus(busId);
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + SHIFT_KEY_TTL_MS);
    await this.prisma.$transaction([
      // Issuing a new key revokes any outstanding ones for this driver.
      this.prisma.shiftKey.updateMany({ where: { driverId, usedAt: null }, data: { expiresAt: new Date() } }),
      this.prisma.shiftKey.create({ data: { driverId, busId, pinHash: await bcrypt.hash(pin, 10), expiresAt } }),
    ]);
    return { driverCode: driver.code, busCode: bus.code, pin, expiresAt: expiresAt.getTime() };
  }

  buses(): AdminBusDTO[] {
    return this.network.allBuses().map((b) => ({
      id: b.id,
      code: b.code,
      plate: b.plate,
      capacity: b.capacity,
      routeCode: this.network.route(b.routeId).dto.code,
      onShiftDriver: null,
    }));
  }

  async busesWithDrivers(): Promise<AdminBusDTO[]> {
    const shifts = await this.prisma.shift.findMany({
      where: { endedAt: null, expiresAt: { gt: new Date() } },
      include: { driver: { select: { name: true } } },
    });
    const byBus = new Map(shifts.map((s) => [s.busId, s.driver.name]));
    return this.buses().map((b) => ({ ...b, onShiftDriver: byBus.get(b.id) ?? null }));
  }

  async trips(limit = 50): Promise<AdminTripDTO[]> {
    const trips = await this.prisma.trip.findMany({
      orderBy: { boardedAt: 'desc' },
      take: limit,
      include: { passenger: { select: { name: true } }, shift: { include: { driver: { select: { name: true } } } } },
    });
    return trips.map((t) => ({
      ...toTripDTO(t, this.network),
      passengerName: t.passenger.name,
      driverName: t.shift?.driver.name ?? null,
    }));
  }
}
