import { ErrorCodes, QR_WINDOW_MS, naira } from '@ridesrus/core';
import { HailsService } from '../src/journeys/hails.service';
import { QrService } from '../src/journeys/qr.service';
import { TripsService } from '../src/journeys/trips.service';
import { LedgerService } from '../src/wallet/ledger.service';
import { createHarness, Harness, key } from './harness';

const FARE = naira(500);

/** Rejects with an AppError carrying `code`. */
async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

describe('boarding, seats and fares', () => {
  let h: Harness;
  let trips: TripsService;
  let hails: HailsService;
  let qr: QrService;
  let ledger: LedgerService;

  beforeAll(async () => {
    h = await createHarness();
    trips = h.app.get(TripsService);
    hails = h.app.get(HailsService);
    qr = h.app.get(QrService);
    ledger = h.app.get(LedgerService);
  });
  afterAll(() => h.close());

  it('scan → pay → seat: charges the route fare, takes a seat, links the hail', async () => {
    const { bus } = await h.busInService('RR-101', { atStop: 'stop_falomo' });
    const p = await h.passenger(naira(2_000));
    const hail = await hails.create(p.id, { busId: bus.id, lat: 6.4447, lng: 3.4262 });
    expect(hail.stopName).toBe('Falomo');

    const { trip, balanceKobo } = await trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() });

    expect(trip.status).toBe('BOARDED');
    expect(trip.fareKobo).toBe(FARE);
    expect(trip.boardStopName).toBe('Falomo');
    expect(balanceKobo).toBe(naira(1_500));
    expect(h.fleet.occupied(bus.id)).toBe(1);
    expect((await h.prisma.hail.findUniqueOrThrow({ where: { id: hail.id } })).status).toBe('BOARDED');
  });

  it('never oversells a bus: 25 riders racing for 18 seats → exactly 18 boardings, 7 uncharged refusals', async () => {
    const { bus } = await h.busInService('RR-102');
    const riders = await Promise.all(Array.from({ length: 25 }, () => h.passenger(naira(1_000))));
    const token = qr.issue(bus.id).token;

    const results = await Promise.allSettled(riders.map((r) => trips.board(r.id, { qrToken: token, idempotencyKey: key() })));

    const ok = results.filter((r) => r.status === 'fulfilled');
    const full = results.filter((r) => r.status === 'rejected' && (r.reason as { code?: string }).code === ErrorCodes.BUS_FULL);
    expect(ok).toHaveLength(18);
    expect(full).toHaveLength(7);
    expect((await h.prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).occupied).toBe(18);

    const balances = await Promise.all(riders.map((r) => ledger.balance(r.id)));
    expect(balances.filter((b) => b === naira(500))).toHaveLength(18);
    expect(balances.filter((b) => b === naira(1_000))).toHaveLength(7); // refused riders were not charged
  });

  it('cannot double-spend: five simultaneous scans with only one fare in the wallet', async () => {
    const { bus } = await h.busInService('RR-103');
    const p = await h.passenger(FARE);
    const token = qr.issue(bus.id).token;

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => trips.board(p.id, { qrToken: token, idempotencyKey: key() })));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await ledger.balance(p.id)).toBe(0);
    expect((await h.prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).occupied).toBe(1);
  });

  it('a retried scan with the same key returns the same trip and charges once', async () => {
    const { bus } = await h.busInService('RR-104');
    const p = await h.passenger(naira(2_000));
    const body = { qrToken: qr.issue(bus.id).token, idempotencyKey: key() };

    const [a, b] = await Promise.all([trips.board(p.id, body), trips.board(p.id, body)]);

    expect(a.trip.id).toBe(b.trip.id);
    expect(await ledger.balance(p.id)).toBe(naira(1_500));
  });

  it('insufficient funds: refused with a clear code, no seat taken', async () => {
    const { bus } = await h.busInService('RR-105');
    const p = await h.passenger(naira(200));
    await expectCode(trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() }), ErrorCodes.INSUFFICIENT_FUNDS);
    expect((await h.prisma.bus.findUniqueOrThrow({ where: { id: bus.id } })).occupied).toBe(0);
    expect(await ledger.balance(p.id)).toBe(naira(200));
  });

  it('rejects forged and expired codes', async () => {
    const { bus } = await h.busInService('RR-106');
    const p = await h.passenger(naira(2_000));
    const good = qr.issue(bus.id).token;
    await expectCode(trips.board(p.id, { qrToken: good.slice(0, -2) + 'xx', idempotencyKey: key() }), ErrorCodes.QR_INVALID);
    await expectCode(trips.board(p.id, { qrToken: good.replace(bus.id, 'some-other-bus'), idempotencyKey: key() }), ErrorCodes.QR_INVALID);
    const old = qr.issue(bus.id, Date.now() - 3 * QR_WINDOW_MS).token;
    await expectCode(trips.board(p.id, { qrToken: old, idempotencyKey: key() }), ErrorCodes.QR_EXPIRED);
    // Manual fallback: "RR-106 · 482 913" typed from the tablet screen.
    const { shortCode, busCode } = qr.issue(bus.id);
    expect(qr.verify(`${busCode} · ${shortCode.slice(0, 3)} ${shortCode.slice(3)}`)).toBe(bus.id);
    expect(qr.verify(`${busCode.toLowerCase()}:${shortCode}`)).toBe(bus.id);
    const wrong = String((Number(shortCode) + 1) % 1_000_000).padStart(6, '0');
    expect(() => qr.verify(`${busCode}:${wrong}`)).toThrow();
    // The previous window is still accepted (clock skew / slow scan).
    const recent = qr.issue(bus.id, Date.now() - QR_WINDOW_MS).token;
    await expect(trips.board(p.id, { qrToken: recent, idempotencyKey: key() })).resolves.toBeDefined();
  });

  it('a bus with no driver on shift is not in service', async () => {
    const { bus } = await h.busInService('RR-101');
    h.fleet.setShift(bus.id, null);
    const p = await h.passenger(naira(2_000));
    await expectCode(trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() }), ErrorCodes.BUS_NOT_IN_SERVICE);
    await expectCode(hails.create(p.id, { busId: bus.id, lat: 6.4447, lng: 3.4262 }), ErrorCodes.BUS_NOT_IN_SERVICE);
  });

  it('arriving at the drop-off completes the trip and frees the seat, exactly once', async () => {
    const { bus } = await h.busInService('RR-101', { atStop: 'stop_falomo' });
    const p = await h.passenger(naira(2_000));
    const { trip } = await trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() });
    await trips.setDropoff(p.id, trip.id, 'stop_lekki_toll');
    expect(h.fleet.occupied(bus.id)).toBe(1);

    const [first, second] = await Promise.all([trips.arriveAtStop(bus.id, 'stop_lekki_toll'), trips.arriveAtStop(bus.id, 'stop_lekki_toll')]);

    expect(first + second).toBe(1);
    expect(h.fleet.occupied(bus.id)).toBe(0);
    const done = await h.prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(done.status).toBe('COMPLETED');

    const rated = await trips.rate(p.id, trip.id, { rating: 5, comment: 'Smooth ride' });
    expect(rated.rating).toBe(5);
    await expectCode(trips.rate(p.id, trip.id, { rating: 1 }), ErrorCodes.INVALID_TRANSITION);
  });

  it('cannot pick the stop the bus is sitting at as a drop-off', async () => {
    const { bus } = await h.busInService('RR-102', { atStop: 'stop_ikate' });
    const p = await h.passenger(naira(2_000));
    const { trip } = await trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() });
    await expectCode(trips.setDropoff(p.id, trip.id, 'stop_ikate'), ErrorCodes.VALIDATION);
  });

  it('admin void refunds the fare and frees the seat', async () => {
    const { bus } = await h.busInService('RR-103');
    const p = await h.passenger(naira(1_000));
    const { trip } = await trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() });
    await trips.void(trip.id);
    expect(await ledger.balance(p.id)).toBe(naira(1_000));
    expect(h.fleet.occupied(bus.id)).toBe(0);
    await expectCode(trips.void(trip.id), ErrorCodes.INVALID_TRANSITION);
  });

  it('one hail at a time, and none while already riding', async () => {
    const { bus } = await h.busInService('RR-104');
    const p = await h.passenger(naira(2_000));
    await hails.create(p.id, { busId: bus.id, lat: 6.4447, lng: 3.4262 });
    await expectCode(hails.create(p.id, { busId: bus.id, lat: 6.4447, lng: 3.4262 }), ErrorCodes.HAIL_EXISTS);
    await trips.board(p.id, { qrToken: qr.issue(bus.id).token, idempotencyKey: key() });
    await expectCode(hails.create(p.id, { busId: bus.id, lat: 6.4447, lng: 3.4262 }), ErrorCodes.ALREADY_ON_TRIP);
  });

  it('the ledger stays balanced and matches every cached balance', async () => {
    const [{ unbalanced }] = await h.prisma.$queryRaw<{ unbalanced: bigint }[]>`
      SELECT COUNT(*) AS unbalanced FROM (
        SELECT "transferId" FROM "LedgerEntry" GROUP BY "transferId" HAVING SUM("amountKobo") <> 0) x`;
    const [{ drift }] = await h.prisma.$queryRaw<{ drift: bigint }[]>`
      SELECT COUNT(*) AS drift FROM (
        SELECT a.id FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a.id
        GROUP BY a.id HAVING a."balanceKobo" <> COALESCE(SUM(e."amountKobo"), 0)) x`;
    const [{ total }] = await h.prisma.$queryRaw<{ total: bigint }[]>`SELECT COALESCE(SUM("balanceKobo"), 0) AS total FROM "LedgerAccount"`;
    expect(Number(unbalanced)).toBe(0);
    expect(Number(drift)).toBe(0);
    expect(Number(total)).toBe(0);
  });
});
