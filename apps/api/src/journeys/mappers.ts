import { HailDTO, TripDTO } from '@ridesrus/core';
import { Hail, Trip } from '../generated/prisma/client';
import { NetworkService } from '../fleet/network.service';

export function toHailDTO(hail: Hail, network: NetworkService): HailDTO {
  return {
    id: hail.id,
    busId: hail.busId,
    busCode: network.bus(hail.busId).code,
    stopId: hail.stopId,
    stopName: network.stopName(hail.stopId) ?? 'Unknown stop',
    status: hail.status,
    createdAt: hail.createdAt.getTime(),
    expiresAt: hail.expiresAt.getTime(),
  };
}

export function toTripDTO(trip: Trip, network: NetworkService): TripDTO {
  return {
    id: trip.id,
    busId: trip.busId,
    busCode: network.bus(trip.busId).code,
    status: trip.status,
    fareKobo: trip.fareKobo,
    boardStopId: trip.boardStopId,
    boardStopName: network.stopName(trip.boardStopId),
    dropoffStopId: trip.dropoffStopId,
    dropoffStopName: network.stopName(trip.dropoffStopId),
    boardedAt: trip.boardedAt.getTime(),
    completedAt: trip.completedAt?.getTime() ?? null,
    rating: trip.rating,
  };
}

/** Prisma unique-constraint violation, optionally on a specific index/column. */
export function isUniqueViolation(err: unknown, target?: string): boolean {
  const e = err as { code?: string; meta?: { target?: unknown; constraint?: unknown }; message?: string };
  if (e?.code !== 'P2002') return false;
  if (!target) return true;
  const haystack = JSON.stringify(e.meta ?? {}) + (e.message ?? '');
  return haystack.includes(target);
}
