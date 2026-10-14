import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActiveJourneyDTO,
  BoardBody,
  BoardingResultDTO,
  ErrorCodes,
  RateTripBody,
  STOP_ARRIVAL_RADIUS_M,
  TripDTO,
  formatNaira,
  shortName,
} from '@ridesrus/core';
import { AppError, conflict, notFound } from '../common/errors';
import { DriverStateService } from '../driver/driver-state.service';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { Trip } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LedgerService, SYSTEM_ACCOUNTS } from '../wallet/ledger.service';
import { isUniqueViolation, toHailDTO, toTripDTO } from './mappers';
import { QrService } from './qr.service';

/** How long a finished trip stays "active" in the app so the rider can rate it. */
const RATING_WINDOW_MS = 20 * 60_000;

@Injectable()
export class TripsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly ledger: LedgerService,
    private readonly qr: QrService,
    private readonly realtime: RealtimeService,
    private readonly driverState: DriverStateService,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit() {
    // GPS geofencing and demo autopilot both report arrivals here.
    this.fleet.onArrival((busId, stopId) => this.arriveAtStop(busId, stopId).then(() => undefined));
  }

  /**
   * Scan → pay → seat, atomically.
   * One transaction takes the seat (conditional on space), debits the wallet
   * (conditional on balance), records the fare in the ledger, links the hail and
   * creates the trip. Any failure rolls back all of it.
   */
  async board(passengerId: string, body: BoardBody): Promise<BoardingResultDTO> {
    const replay = await this.prisma.trip.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
    if (replay) {
      if (replay.passengerId !== passengerId) throw conflict(ErrorCodes.CONFLICT, 'Duplicate scan key.');
      return { trip: toTripDTO(replay, this.network), balanceKobo: await this.ledger.balance(passengerId) };
    }

    const busId = this.qr.verify(body.qrToken);
    if (!this.network.hasBus(busId)) throw new AppError(ErrorCodes.QR_INVALID, "That isn't a RidesRus boarding code.");
    const bus = this.network.bus(busId);
    if (!this.fleet.inService(busId)) {
      throw new AppError(ErrorCodes.BUS_NOT_IN_SERVICE, `${bus.code} isn't taking passengers right now.`, HttpStatus.CONFLICT);
    }
    const { dto: route } = this.network.route(bus.routeId);
    const fareKobo = route.fareKobo;
    const tripId = randomUUID();
    const boardStopId = this.fleet.stopAtBus(busId);

    let trip: Trip;
    let occupied: number;
    let hailId: string | null = null;
    try {
      ({ trip, occupied, hailId } = await this.prisma.$transaction(async (tx) => {
        const seat = await tx.bus.updateMany({
          where: { id: busId, occupied: { lt: bus.capacity } },
          data: { occupied: { increment: 1 } },
        });
        if (seat.count === 0) throw conflict(ErrorCodes.BUS_FULL, `${bus.code} is full. You have not been charged.`);

        const walletId = await this.ledger.walletAccountId(tx, passengerId);
        const { transferId } = await this.ledger.post(tx, {
          kind: 'FARE',
          reference: `fare_${tripId}`,
          description: `Fare · ${bus.code} · Route ${route.code}`,
          entries: [
            { accountId: walletId, amountKobo: -fareKobo },
            { accountId: SYSTEM_ACCOUNTS.FARE_REVENUE, amountKobo: fareKobo },
          ],
        });

        const hail = await tx.hail.findFirst({
          where: { passengerId, busId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
        });
        if (hail) await tx.hail.update({ where: { id: hail.id }, data: { status: 'BOARDED', resolvedAt: new Date() } });
        // A hail for a different bus is superseded by actually boarding this one.
        await tx.hail.updateMany({
          where: { passengerId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
          data: { status: 'CANCELLED', resolvedAt: new Date() },
        });

        const created = await tx.trip.create({
          data: {
            id: tripId,
            passengerId,
            busId,
            shiftId: this.fleet.activeShiftId(busId),
            hailId: hail?.id ?? null,
            boardStopId,
            fareKobo,
            idempotencyKey: body.idempotencyKey,
            fareTransferId: transferId,
          },
        });
        const after = await tx.bus.findUniqueOrThrow({ where: { id: busId }, select: { occupied: true } });
        return { trip: created, occupied: after.occupied, hailId: hail?.id ?? null };
      }));
    } catch (err) {
      if (isUniqueViolation(err, 'idempotencyKey')) return this.board(passengerId, body);
      if (isUniqueViolation(err)) throw conflict(ErrorCodes.ALREADY_ON_TRIP, "You're already on a bus. Finish that trip first.");
      throw err;
    }

    this.fleet.setOccupancy(busId, occupied);
    const dto = toTripDTO(trip, this.network);
    const balanceKobo = await this.ledger.balance(passengerId);
    this.realtime.toPassenger(passengerId, 'trip:updated', dto);
    this.realtime.toPassenger(passengerId, 'wallet:updated', { balanceKobo });
    if (hailId) {
      const hail = await this.prisma.hail.findUnique({ where: { id: hailId } });
      if (hail) this.realtime.toPassenger(passengerId, 'hail:updated', toHailDTO(hail, this.network));
    }
    this.driverState.publishSoon(busId);
    const passenger = await this.prisma.passenger.findUnique({ where: { id: passengerId }, select: { name: true } });
    this.activity.record(
      'BOARD',
      `${shortName(passenger?.name ?? 'Rider')} boarded ${bus.code}${dto.boardStopName ? ` at ${dto.boardStopName}` : ''} · ${formatNaira(fareKobo)}`,
      bus.code,
    );
    return { trip: dto, balanceKobo };
  }

  async setDropoff(passengerId: string, tripId: string, stopId: string): Promise<TripDTO> {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, passengerId } });
    if (!trip) throw notFound('Trip');
    if (trip.status !== 'BOARDED') throw conflict(ErrorCodes.INVALID_TRANSITION, 'This trip has already ended.');
    const stop = this.network.stop(stopId);
    if (stop.routeId !== this.network.bus(trip.busId).routeId) {
      throw new AppError(ErrorCodes.VALIDATION, `${stop.name} isn't on this bus's route.`);
    }
    if (this.fleet.stopAtBus(trip.busId, STOP_ARRIVAL_RADIUS_M) === stopId) {
      throw new AppError(ErrorCodes.VALIDATION, `The bus is already at ${stop.name}. Choose a stop ahead.`);
    }
    const updated = await this.prisma.trip.update({ where: { id: tripId }, data: { dropoffStopId: stopId } });
    const dto = toTripDTO(updated, this.network);
    this.realtime.toPassenger(passengerId, 'trip:updated', dto);
    this.driverState.publishSoon(trip.busId);
    return dto;
  }

  /**
   * The bus is at a stop: everyone whose drop-off is here has arrived.
   * Idempotent — called by GPS geofencing, demo autopilot and the driver's
   * "Stop reached" button, possibly all for the same arrival.
   */
  async arriveAtStop(busId: string, stopId: string): Promise<number> {
    const due = await this.prisma.trip.findMany({ where: { busId, status: 'BOARDED', dropoffStopId: stopId } });
    if (due.length === 0) return 0;
    const completedAt = new Date();

    const { completed, occupied } = await this.prisma.$transaction(async (tx) => {
      const done = await tx.trip.updateMany({
        where: { id: { in: due.map((t) => t.id) }, status: 'BOARDED' },
        data: { status: 'COMPLETED', completedAt },
      });
      if (done.count > 0) {
        await tx.bus.updateMany({ where: { id: busId, occupied: { gte: done.count } }, data: { occupied: { decrement: done.count } } });
      }
      const after = await tx.bus.findUniqueOrThrow({ where: { id: busId }, select: { occupied: true } });
      return { completed: done.count, occupied: after.occupied };
    });
    if (completed === 0) return 0;

    this.fleet.setOccupancy(busId, occupied);
    for (const t of due) {
      this.realtime.toPassenger(t.passengerId, 'trip:updated', toTripDTO({ ...t, status: 'COMPLETED', completedAt }, this.network));
    }
    this.driverState.publishSoon(busId);
    this.activity.record(
      'DROPOFF',
      `${completed} rider${completed > 1 ? 's' : ''} dropped at ${this.network.stopName(stopId)} from ${this.network.bus(busId).code}`,
      this.network.bus(busId).code,
    );
    return completed;
  }

  async rate(passengerId: string, tripId: string, body: RateTripBody): Promise<TripDTO> {
    const updated = await this.prisma.trip.updateMany({
      where: { id: tripId, passengerId, status: 'COMPLETED', rating: null },
      data: { rating: body.rating, comment: body.comment || null, ratedAt: new Date() },
    });
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, passengerId } });
    if (!trip) throw notFound('Trip');
    if (updated.count === 0) throw conflict(ErrorCodes.INVALID_TRANSITION, 'This trip can no longer be rated.');
    const dto = toTripDTO(trip, this.network);
    this.realtime.toPassenger(passengerId, 'trip:updated', dto);
    this.activity.record('RATING', `${'★'.repeat(body.rating)}${'☆'.repeat(5 - body.rating)} for ${dto.busCode}`, dto.busCode);
    return dto;
  }

  /** Admin refund: voids the trip, returns the fare and frees the seat if still aboard. */
  async void(tripId: string): Promise<TripDTO> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw notFound('Trip');
    if (trip.status === 'VOIDED') throw conflict(ErrorCodes.INVALID_TRANSITION, 'Trip already voided.');

    const occupied = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.trip.updateMany({ where: { id: tripId, status: trip.status }, data: { status: 'VOIDED' } });
      if (changed.count === 0) throw conflict(ErrorCodes.CONFLICT, 'Trip changed while voiding; try again.');
      const walletId = await this.ledger.walletAccountId(tx, trip.passengerId);
      await this.ledger.post(tx, {
        kind: 'REFUND',
        reference: `refund_${tripId}`,
        description: `Refund · ${this.network.bus(trip.busId).code}`,
        entries: [
          { accountId: SYSTEM_ACCOUNTS.FARE_REVENUE, amountKobo: -trip.fareKobo },
          { accountId: walletId, amountKobo: trip.fareKobo },
        ],
      });
      if (trip.status === 'BOARDED') {
        await tx.bus.updateMany({ where: { id: trip.busId, occupied: { gte: 1 } }, data: { occupied: { decrement: 1 } } });
      }
      return (await tx.bus.findUniqueOrThrow({ where: { id: trip.busId }, select: { occupied: true } })).occupied;
    });

    this.fleet.setOccupancy(trip.busId, occupied);
    const dto = toTripDTO({ ...trip, status: 'VOIDED' }, this.network);
    this.realtime.toPassenger(trip.passengerId, 'trip:updated', dto);
    this.realtime.toPassenger(trip.passengerId, 'wallet:updated', { balanceKobo: await this.ledger.balance(trip.passengerId) });
    this.driverState.publishSoon(trip.busId);
    this.activity.record('VOID', `Trip on ${dto.busCode} voided and ${formatNaira(trip.fareKobo)} refunded`, dto.busCode);
    return dto;
  }

  /** What the passenger app should show on launch: an open hail, a ride in progress, or a trip to rate. */
  async active(passengerId: string): Promise<ActiveJourneyDTO> {
    const [hail, trip] = await Promise.all([
      this.prisma.hail.findFirst({ where: { passengerId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } } }),
      this.prisma.trip.findFirst({
        where: {
          passengerId,
          OR: [
            { status: 'BOARDED' },
            { status: 'COMPLETED', rating: null, completedAt: { gte: new Date(Date.now() - RATING_WINDOW_MS) } },
          ],
        },
        orderBy: { boardedAt: 'desc' },
      }),
    ]);
    return {
      hail: hail ? toHailDTO(hail, this.network) : null,
      trip: trip ? toTripDTO(trip, this.network) : null,
    };
  }

  async history(passengerId: string, limit = 30): Promise<TripDTO[]> {
    const trips = await this.prisma.trip.findMany({ where: { passengerId }, orderBy: { boardedAt: 'desc' }, take: limit });
    return trips.map((t) => toTripDTO(t, this.network));
  }
}
