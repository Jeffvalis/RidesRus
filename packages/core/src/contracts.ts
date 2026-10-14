import { z } from 'zod';
import { Direction } from './route';
import { HailStatus, SeatBand, TripStatus } from './lifecycle';
import { Kobo, TOPUP_MAX, TOPUP_MIN } from './money';

/* ───────────────────────────── Request bodies ───────────────────────────── */
// Validated identically on the client (form errors) and the server (ZodPipe).

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(8, 'Use at least 8 characters').max(128);

export const RegisterPassengerBody = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(80),
  email,
  password,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{10,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type RegisterPassengerBody = z.infer<typeof RegisterPassengerBody>;

export const LoginBody = z.object({ email, password: z.string().min(1, 'Enter your password') });
export type LoginBody = z.infer<typeof LoginBody>;

export const DriverLoginBody = z.object({
  driverCode: z.string().trim().toUpperCase().regex(/^RR-\d{4}$/, 'Driver IDs look like RR-1234'),
  pin: z.string().regex(/^\d{6}$/, 'The access key is 6 digits'),
});
export type DriverLoginBody = z.infer<typeof DriverLoginBody>;

export const CreateHailBody = z.object({
  busId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateHailBody = z.infer<typeof CreateHailBody>;

export const BoardBody = z.object({
  /** The scanned QR token, or a manual code typed as "RR-102:482913". */
  qrToken: z.string().trim().min(10).max(300),
  /** Client-generated; retries of the same scan never double-charge. */
  idempotencyKey: z.string().min(8).max(64),
});
export type BoardBody = z.infer<typeof BoardBody>;

export const SetDropoffBody = z.object({ stopId: z.string().min(1) });
export type SetDropoffBody = z.infer<typeof SetDropoffBody>;

export const RateTripBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type RateTripBody = z.infer<typeof RateTripBody>;

export const TopUpBody = z.object({
  amountKobo: z.number().int().min(TOPUP_MIN).max(TOPUP_MAX),
});
export type TopUpBody = z.infer<typeof TopUpBody>;

export const LocationPing = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullish(),
  speedMps: z.number().min(0).max(60).nullish(),
  accuracyM: z.number().min(0).nullish(),
  at: z.number().int(),
});
export type LocationPing = z.infer<typeof LocationPing>;

/** Driver actions are queued offline on the tablet and replayed in order. */
export const DriverAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ACK_HAIL'), idempotencyKey: z.string().min(8), at: z.number().int(), hailIds: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('ARRIVE_STOP'), idempotencyKey: z.string().min(8), at: z.number().int(), stopId: z.string() }),
]);
export type DriverAction = z.infer<typeof DriverAction>;

export const DriverActionsBody = z.object({ actions: z.array(DriverAction).min(1).max(100) });
export type DriverActionsBody = z.infer<typeof DriverActionsBody>;

export const CreateDriverBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,15}$/, 'Enter a valid phone number'),
});
export type CreateDriverBody = z.infer<typeof CreateDriverBody>;

export const IssueShiftKeyBody = z.object({ busId: z.string().min(1) });
export type IssueShiftKeyBody = z.infer<typeof IssueShiftKeyBody>;

/* ───────────────────────────── Response shapes ──────────────────────────── */

export type PassengerDTO = { id: string; name: string; email: string; phone: string | null; isGuest: boolean };
export type AuthResponse<T> = { token: string; expiresAt: number } & T;

export type StopDTO = { id: string; name: string; lat: number; lng: number; seq: number };
export type RouteDTO = {
  id: string;
  code: string;
  name: string;
  fareKobo: Kobo;
  /** Effective speed used for ETAs (already scaled in demo mode), m/s. */
  avgSpeedMps: number;
  stops: StopDTO[];
  path: { lat: number; lng: number }[];
};

export type BusLiveDTO = {
  id: string;
  code: string;
  plate: string;
  routeId: string;
  lat: number;
  lng: number;
  heading: number;
  direction: Direction;
  occupied: number;
  capacity: number;
  band: SeatBand;
  nextStopId: string | null;
  nextStopEtaSec: number | null;
  /** True while a driver is on shift and the position is fresh. */
  inService: boolean;
  /** 'GPS' from a driver tablet, 'SIMULATED' from demo autopilot. */
  source: 'GPS' | 'SIMULATED';
  updatedAt: number;
};

export type HailDTO = {
  id: string;
  busId: string;
  busCode: string;
  stopId: string;
  stopName: string;
  status: HailStatus;
  createdAt: number;
  expiresAt: number;
};

export type TripDTO = {
  id: string;
  busId: string;
  busCode: string;
  status: TripStatus;
  fareKobo: Kobo;
  boardStopId: string | null;
  boardStopName: string | null;
  dropoffStopId: string | null;
  dropoffStopName: string | null;
  boardedAt: number;
  completedAt: number | null;
  rating: number | null;
};

export type ActiveJourneyDTO = { hail: HailDTO | null; trip: TripDTO | null };

export type WalletEntryDTO = {
  id: string;
  kind: 'TOPUP' | 'FARE' | 'REFUND' | 'PROMO';
  amountKobo: Kobo; // signed from the passenger's point of view
  description: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  createdAt: number;
};
export type WalletDTO = { balanceKobo: Kobo; entries: WalletEntryDTO[] };

export type TopUpDTO = { reference: string; checkoutUrl: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' };

export type BoardingResultDTO = { trip: TripDTO; balanceKobo: Kobo };

export type DriverStopGroup = {
  stopId: string;
  stopName: string;
  count: number;
  metres: number;
  etaSec: number;
};

export type DriverStateDTO = {
  shift: { id: string; startedAt: number; expiresAt: number };
  driver: { id: string; code: string; name: string };
  bus: { id: string; code: string; plate: string; capacity: number };
  route: { id: string; code: string; name: string; fareKobo: Kobo };
  occupied: number;
  /** Bus position for the console map. */
  position: { lat: number; lng: number; heading: number; direction: Direction } | null;
  /** The stop the bus is at right now (within ~150 m), if any. */
  currentStop: DriverStopGroup | null;
  nextStop: DriverStopGroup | null;
  pickups: (DriverStopGroup & { hailIds: string[]; acknowledged: boolean })[];
  dropoffs: DriverStopGroup[];
  /** Boarded passengers who haven't picked a stop yet. */
  undecided: number;
  recentBoardings: { tripId: string; passengerName: string; at: number }[];
  todayFareKobo: Kobo;
};

/** `shortCode` is the 6-digit fallback printed under the QR for riders whose camera won't scan. */
export type DriverQrDTO = { token: string; shortCode: string; busCode: string; expiresAt: number; windowMs: number };

export type DriverActionResult = { idempotencyKey: string; ok: boolean; error?: string; replayed: boolean };

export type ActivityDTO = {
  id: string;
  type: 'HAIL' | 'BOARD' | 'DROPOFF' | 'RATING' | 'TOPUP' | 'SHIFT' | 'VOID' | 'SOS';
  message: string;
  busCode?: string;
  at: number;
};

export type AdminOverviewDTO = {
  busesInService: number;
  busesTotal: number;
  passengersOnboard: number;
  seatsTotal: number;
  today: {
    hails: number;
    boardings: number;
    hailConversion: number | null; // boardings from hails / resolved hails
    completedTrips: number;
    fareVolumeKobo: Kobo;
    avgRating: number | null;
    ratingsCount: number;
    dropoffSelectionRate: number | null;
  };
};

export type AdminDriverDTO = {
  id: string;
  code: string;
  name: string;
  phone: string;
  onShift: boolean;
  shiftId: string | null;
  busCode: string | null;
  avgRating: number | null;
  tripsToday: number;
};

export type AdminBusDTO = { id: string; code: string; plate: string; capacity: number; routeCode: string; onShiftDriver: string | null };

export type AdminTripDTO = TripDTO & { passengerName: string; driverName: string | null };

export type IssuedShiftKeyDTO = { driverCode: string; busCode: string; pin: string; expiresAt: number };

export type ApiErrorBody = { statusCode: number; code: string; message: string; issues?: { path: string; message: string }[] };

/* ───────────────────────────── Socket contracts ─────────────────────────── */

export interface ServerToClientEvents {
  'fleet:update': (payload: { buses: BusLiveDTO[]; at: number }) => void;
  'hail:updated': (hail: HailDTO) => void;
  'trip:updated': (trip: TripDTO) => void;
  'wallet:updated': (payload: { balanceKobo: Kobo }) => void;
  'driver:state': (state: DriverStateDTO) => void;
  activity: (event: ActivityDTO) => void;
}

export interface ClientToServerEvents {
  'driver:location': (ping: LocationPing, ack: (res: { ok: boolean; error?: string }) => void) => void;
}

/** Stable error codes clients can branch on. */
export const ErrorCodes = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  BUS_FULL: 'BUS_FULL',
  QR_EXPIRED: 'QR_EXPIRED',
  QR_INVALID: 'QR_INVALID',
  ALREADY_ON_TRIP: 'ALREADY_ON_TRIP',
  HAIL_EXISTS: 'HAIL_EXISTS',
  BUS_NOT_IN_SERVICE: 'BUS_NOT_IN_SERVICE',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
