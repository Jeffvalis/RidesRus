# RidesRus architecture

## The shape of the system

```
 Passenger app ──┐                         ┌── Postgres (source of truth: people, trips, money, shifts)
 Driver console ─┼── REST + Socket.IO ── API ─┤
 Fleet HQ ───────┘                         └── in-memory fleet state (positions, occupancy mirror)
                                               │
                                     Flutterwave (hosted checkout, verified webhooks)
```

Everything is TypeScript. `packages/core` is imported by all four apps and holds the things that must never disagree:

| Module | What it owns |
| --- | --- |
| `route.ts` | Corridor geometry and the loop model (below), ETAs, next stop, nearest stop |
| `lifecycle.ts` | Hail and trip state machines, hail TTL, QR window, seat bands |
| `contracts.ts` | zod request schemas, response DTOs, typed socket events, error codes |
| `money.ts` | Integer kobo, formatting, top-up limits |
| `brand.ts` | Design tokens taken from the original design flows |
| `api-client.ts` | The fetch wrapper every client uses, with typed `ApiError.code` |

## The journey

```
Rider            Hail ──────────────▶ Scan QR ───────────▶ Pick stop ──────▶ Arrive ─────▶ Rate
                   │                     │                     │                 │
API            PENDING ─ack─▶ ACK   [one transaction]     trip.dropoff     geofence or driver tap
                   │              seat++ (if room)              │          completes trips, seat--
                   │              wallet −₦500 (if funds)       │
                   │              ledger: wallet → revenue      │
                   │              hail → BOARDED, trip created  │
Driver console  "2 waiting at Chevron"   "Ada O. paid & seated"   "3 getting off at Ikate"
```

A trip exists only after payment, so "boarded" is a fact rather than an intention. Hails expire after 10 minutes. The drop-off is a field on the trip, not a state, so a rider can change it until arrival.

## Decisions (and what changed from v2)

The v2 MVP looked complete screen by screen, but the screens weren't connected. Seat counts were `Math.random()`. The driver console listened on a bus ID the simulator never used. "Confirm & Board" charged nothing. The passenger app (Clerk) and the API (its own JWTs) had separate user databases. No endpoint checked auth, and the QR carried its own fare. The rebuild fixes each of these as a matter of design, not as patches.

**1. One source of truth per fact.**
- Seats: `Bus.occupied`, changed only inside the boarding and drop-off transactions and bounded by a CHECK constraint. The live map reads a mirror of that value.
- Money: the ledger. The wallet balance is a cached sum, updated in the same transaction as every posting.
- The driver's screen: built on the server and pushed. The tablet doesn't reconcile anything itself.

**2. Make wrong states unrepresentable in Postgres.**
Application code checks these rules too. The database is the backstop for the code path someone writes next year:
- `0 ≤ occupied ≤ capacity`
- wallet balance ≥ 0
- one open hail per passenger, and one open ride per passenger
- one open shift per bus, and one open shift per driver
- fares and top-ups > 0
- ratings 1–5

**3. Double-entry ledger in kobo.**
Floats and money don't mix, and a single `walletBalance` column can't explain itself. Every movement is a `Transfer` whose entries sum to zero, keyed by a unique business reference (`fare_<trip>`, `topup_<ref>`, `refund_<trip>`). Re-posting is impossible, and `db:audit` proves the books balance. System accounts (fare revenue, gateway clearing, promo expense) make the P&L readable directly from the data.

**4. Idempotency everywhere a network can lie.**
- Boarding: client key → `Trip.idempotencyKey` unique.
- Top-ups: a conditional `PENDING → SUCCEEDED` flip.
- Driver actions: `DriverActionLog` keyed by the tablet's key.
- Drop-off completion: a conditional status update.

Every one of these is covered by a concurrency test.

**5. Boarding codes prove presence without trusting the client.**
`rr1.<busId>.<30s window>.<HMAC>` is shown as a QR, with a 6-digit HOTP-style code underneath for broken cameras. A bare "enter the bus ID" fallback (as in the v1 design) was rejected: it would let anyone board from their sofa. The code doesn't carry a fare, and the server prices from the route.

**6. Drivers authenticate per shift, not per person.**
Fleet HQ issues a 6-digit key bound to one driver *and* one bus. It works once and lasts 15 minutes; only its bcrypt hash is stored. The resulting token is checked against a live `Shift` row on every request, so ending a shift revokes access immediately. This is the "Issue Access Key" idea from the v2 admin mock-up, made real.

**7. The route is a loop.**
Buses drive out and back, so a bus's position is `loopPos`: metres around a loop of length 2L. Eastbound is `[0, L)` and westbound is `[L, 2L)`. "Metres until Chevron" is the smallest non-negative `(stop − bus) mod 2L` over the stop's two loop positions. GPS fixes are projected onto the road line, and direction comes from successive projections. The same maths runs on the server (ETAs, geofenced arrivals) and on the client (stop picker), from the same file.

**8. GPS never touches Postgres.**
Positions live in `FleetStateService` and are broadcast once a second as a single `fleet:update`. At pilot scale (6–50 buses, about 50 messages a second) one instance is plenty. *When to add Redis:* the moment we run more than one API instance. Positions move to a Redis hash, and Socket.IO gets the Redis adapter. That's an infrastructure change behind one service, not a redesign. v2 put Redis in on day one without needing it.

**9. Offline-first where it matters: the bus.**
Connectivity on the Lekki-Epe Expressway drops. The console writes every tap to SQLite before anything else, updates its UI optimistically, and drains an ordered outbox when it can. A business-rule rejection (for example, a hail that expired while offline) is recorded and dropped, so it can never wedge the queue. Riders' phones are online by definition, because boarding needs the server.

**10. Email + password auth, owned by the API.**
One identity system (v2 had two). Passwords are hashed with bcrypt. Login takes the same time whether or not the email exists, and errors don't reveal which. Sign-in endpoints are rate-limited per IP. Phone OTP is the obvious next step for Lagos; it slots in beside email in `AuthService`.

**11. Demo mode runs the real system.**
Autopilot buses and 80 simulated riders call the same `HailsService`, `TripsService` and ledger as real users. Every dashboard number therefore comes from real transactions, and a visitor's hail competes with simulated riders for real seats. Demo-only affordances (guest sign-in, "simulate scan", sandbox checkout, 3× speed) are switched off when `DEMO_MODE=false`. The server refuses to start in production with sandbox payments unless demo mode is on.

## Security checklist

- Every route except public map, routes and config is behind a role guard (`passenger`, `driver`, `admin`). Driver tokens are bound to a live shift.
- Request bodies are validated by zod. Errors come back in one shape with stable codes, and stack traces never leak.
- Helmet; a CORS allow-list on HTTP and sockets; trust proxy for accurate rate limits.
- Secrets are validated at boot (≥ 32 chars). The JWT and QR secrets are separate so they can be rotated independently.
- Webhooks are authenticated with a timing-safe comparison of `verif-hash`, then re-verified against the Flutterwave API before any credit.
- The public map exposes positions and load, but never riders. Drivers see "Ada O.", not full names.

## What's next

1. **Phone OTP sign-in** (Termii or Africa's Talking), keeping email as a fallback.
2. **Push notifications.** A "your bus is 2 minutes away" notification, plus a prompt to pick a stop if the app is closed (PRD feature 4).
3. **Background GPS on the tablet** via a development build with `expo-task-manager`. Kiosk tablets keep the screen on, so foreground tracking covers the pilot.
4. **Multi-route admin.** Create routes and stops from Fleet HQ. Today they're seeded from `core`.
5. **Fare rules.** Distance or zone-based fares and peak pricing. The ledger already supports any amount.
6. **Observability.** Structured logs, a metrics endpoint, and alerts on webhook failures and on buses stuck offline.
7. **Horizontal scale.** Redis-backed fleet state and the Socket.IO adapter (see decision 8).
