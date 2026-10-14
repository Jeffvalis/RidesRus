/**
 * The passenger journey, as explicit state machines.
 *
 *   Hail:  PENDING ──ack──▶ ACKNOWLEDGED ──board──▶ BOARDED
 *            │                  │
 *            ├──cancel / expire─┴──▶ CANCELLED | EXPIRED
 *
 *   Trip:  BOARDED ──arrive at drop-off──▶ COMPLETED
 *            └──driver/admin void (refund)──▶ VOIDED
 *
 * A trip only exists once a passenger has scanned the bus QR and paid, so
 * "boarded" is a fact, not an intention. Drop-off stop is a field on the trip,
 * not a state: passengers can set or change it any time before arrival.
 */
export const HAIL_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'BOARDED', 'CANCELLED', 'EXPIRED'] as const;
export type HailStatus = (typeof HAIL_STATUSES)[number];

export const TRIP_STATUSES = ['BOARDED', 'COMPLETED', 'VOIDED'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

const HAIL_TRANSITIONS: Record<HailStatus, readonly HailStatus[]> = {
  PENDING: ['ACKNOWLEDGED', 'BOARDED', 'CANCELLED', 'EXPIRED'],
  ACKNOWLEDGED: ['BOARDED', 'CANCELLED', 'EXPIRED'],
  BOARDED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  BOARDED: ['COMPLETED', 'VOIDED'],
  COMPLETED: [],
  VOIDED: [],
};

export const canTransitionHail = (from: HailStatus, to: HailStatus) => HAIL_TRANSITIONS[from].includes(to);
export const canTransitionTrip = (from: TripStatus, to: TripStatus) => TRIP_TRANSITIONS[from].includes(to);

export const ACTIVE_HAIL_STATUSES: readonly HailStatus[] = ['PENDING', 'ACKNOWLEDGED'];

/** A hail nobody boards within this window lapses, freeing the driver's attention. */
export const HAIL_TTL_MS = 10 * 60 * 1000;

/** Boarding QR codes rotate on this window; the server accepts the current and previous one. */
export const QR_WINDOW_MS = 30 * 1000;

/** Seat-availability bands from the PRD: white = empty, green = seats, red = full. */
export type SeatBand = 'EMPTY' | 'AVAILABLE' | 'FULL';

export function seatBand(occupied: number, capacity: number): SeatBand {
  if (occupied >= capacity) return 'FULL';
  if (occupied === 0) return 'EMPTY';
  return 'AVAILABLE';
}
