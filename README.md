# RidesRus

**Bus-hailing for Lagos.** Riders see every bus on the Lekki–Victoria Island corridor and how many seats are free. They hail one from the roadside, scan a code on the bus to board, and the fare comes out of their wallet. Drivers run the shift from a mounted tablet. Operations watch the whole network live from Fleet HQ.

| App | Who it's for | Stack |
| --- | --- | --- |
| [`apps/passenger`](apps/passenger) | Commuters | Expo (iOS, Android, web) |
| [`apps/driver`](apps/driver) | Drivers, on a bus-mounted Android tablet | Expo (landscape tablet, web) |
| [`apps/admin`](apps/admin) | Fleet operations ("Fleet HQ") | Next.js, static export |
| [`apps/api`](apps/api) | Everything above | NestJS, Socket.IO, Prisma, PostgreSQL |
| [`packages/core`](packages/core) | Shared by all four | TypeScript: domain rules, route geometry, API and socket contracts |

## Run it

You need Node 22 or newer. Docker isn't required, because Postgres runs from npm.

```bash
npm install
npm run dev
```

| | |
| --- | --- |
| Passenger app | http://localhost:8081: tap **Try the live demo** |
| Driver console | http://localhost:8082 |
| Fleet HQ | http://localhost:3000, `admin@ridesrus.app` / `fleet-hq-demo` |
| API health | http://localhost:3005/health |

`npm run dev` starts an embedded Postgres, applies migrations, seeds the network (route 42A, 9 stops, 6 buses, 4 drivers) and launches every app. In **demo mode** an autopilot drives the buses at 3× speed. Eighty simulated riders hail, board, pay, pick stops and rate trips, all through the same services real users hit. So the dashboards show real transactions, not mocked numbers.

**A five-minute tour**
1. **Passenger**: *Try the live demo* → pick a bus arriving at your stop → **Hail** → **Scan** tab → *Simulate scanning* → choose a drop-off. Your ₦500 fare is now in the ledger.
2. **Fleet HQ** → *Drivers & shifts* → **Issue key** for David Koko on any bus. Note the 6-digit key.
3. **Driver console**: sign in as `RR-9942` with that key. Simulated hails arrive; **Acknowledge** them. The rotating boarding QR sits top right. Try **Night** mode.
4. Back in **Fleet HQ**, watch the activity feed. Press **SOS** on the console and an alert appears at the top.

To use a phone, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3005` in `apps/passenger/.env` and run `npx expo start` in that folder.

## What the product does

**Rider**
- Live map of buses, coloured by seats (white = empty, green = seats, red = full), plus a list of buses arriving at *your* stop with ETAs.
- Hail a specific bus. The driver's console shows you grouped by stop, and you see when the driver has acknowledged you.
- Board by scanning a **rotating, signed QR** on the bus screen. If the camera won't scan, type the 6-digit code shown under it. Boarding takes a seat and charges the fare in one database transaction. If the bus is full, you aren't charged.
- Pick your drop-off from the stops ahead, with live ETAs. The driver sees how many people get off where.
- When the bus reaches your stop, the trip completes automatically (GPS geofence or the driver's tap). Then you rate the ride.
- Wallet: top up through hosted checkout (Flutterwave, or a sandbox in demo), with a full transaction history.

**Driver**
- Sign in once per shift with an admin-issued, one-time key bound to a specific bus.
- One glanceable screen: seats taken and free, hail requests by stop, upcoming drop-offs, next stop and ETA, recent boardings, fare total.
- Works offline. Every tap goes into an on-device SQLite queue and syncs when the signal returns, with no double effects.
- Device GPS streams over the socket. The screen stays awake, night mode cuts glare, and SOS alerts Fleet HQ.

**Fleet HQ**
- Live map and fleet table, and an operations feed with pinned SOS alerts.
- The PRD's KPIs, computed from real data: hail→board conversion (target 85%), drop-off selection (90%), average rating (4.2), fares, load.
- Enrol drivers, issue and revoke shift keys, end shifts remotely, void trips with automatic refunds.

## Engineering highlights

- **Invariants enforced by Postgres, not just app code.** CHECK constraints keep seats between 0 and capacity and wallets non-negative. Partial unique indexes allow one open hail and one open ride per passenger, and one open shift per bus and per driver. ([migration](apps/api/prisma/migrations))
- **Double-entry ledger in integer kobo.** Every naira movement is a balanced transfer. Wallet debits are conditional (`balance >= fare`), so concurrent scans can't double-spend. `npm run db:audit -w @ridesrus/api` proves the books balance.
- **Boarding is one atomic transaction:** seat, fare, ledger, hail and trip. The client sends an idempotency key, so retrying a flaky request returns the same trip instead of charging twice.
- **Tamper-proof boarding codes.** `HMAC(busId, 30-second window)`. They carry no fare (the server prices the route), screenshots expire within a minute, and forgeries fail verification.
- **Money is never trusted from a client or webhook body.** Top-ups are credited only after the API verifies the payment with the gateway, exactly once, however many times the redirect, poll and webhook race.
- **The server owns the driver's screen state.** The tablet renders what it's pushed, so it can't drift. Offline actions replay idempotently, and a stale action can't block the queue.
- **One geometry model for every ETA.** Buses run out and back, so position is "metres around the loop". "Next stop", "how far to Chevron" and drop-off ordering are all one modular subtraction ([`route.ts`](packages/core/src/route.ts)).
- **Shared contracts.** The same zod schemas validate forms in the apps and requests in the API. Socket events are typed once in `core`.

## Tests

```bash
npm test
```

- `packages/core`: route geometry, state machines, money formatting, contracts (11 tests).
- `apps/api`: 21 integration tests against a **real** throwaway Postgres. They cover: 25 riders racing for 18 seats (exactly 18 board, 7 aren't charged); 5 simultaneous scans with one fare in the wallet; idempotent retries; forged and expired codes; drop-off completion firing twice; refunds; the auth guard; one-time shift keys; offline action replay; top-ups settled six times at once crediting once; webhook authentication; and a full ledger audit.

## Docs

- [Architecture & decisions](docs/architecture.md): how it fits together, what changed from v2 and why, and what comes next.
- [Deploying](docs/deploy.md): Render (API + Postgres) and Netlify (the three front ends).
- Product history: [original PRD](docs/prd/Product%20Requirements%20Document%20(PRD)%20%E2%80%93%20RidesRus.pdf), [PRD v2](docs/prd/Product_Requirements_Document_v2.md), [TRD v2](docs/trd/Technical_Requirements_v2.md), [design flows](docs/design/flows).

The pre-rebuild MVP is preserved at git tag `v2-mvp-snapshot`.
