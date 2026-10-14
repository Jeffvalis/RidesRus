import request from 'supertest';
import { naira } from '@ridesrus/core';
import { FlutterwaveProvider } from '../src/wallet/flutterwave.provider';
import { PAYMENT_PROVIDER } from '../src/wallet/payment-provider';
import { SandboxProvider } from '../src/wallet/sandbox.provider';
import { TopUpsService } from '../src/wallet/topups.service';
import { LedgerService } from '../src/wallet/ledger.service';
import { createHarness, Harness, key } from './harness';

describe('HTTP: auth, driver shifts, offline replay, payments', () => {
  let h: Harness;
  let http: ReturnType<typeof request>;
  let admin: string;

  beforeAll(async () => {
    h = await createHarness();
    http = request(h.app.getHttpServer());
    const res = await http.post('/auth/admin/login').send({ email: 'admin@ridesrus.app', password: 'fleet-hq-demo' }).expect(201);
    admin = res.body.token;
  });
  afterAll(() => h.close());

  it('validates bodies with the shared contracts and returns stable error codes', async () => {
    const res = await http.post('/auth/passenger/register').send({ name: 'A', email: 'nope', password: 'x' }).expect(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual(['email', 'name', 'password']);
  });

  it('protects routes by role', async () => {
    await http.get('/wallet').expect(401);
    await http.get('/wallet').set('authorization', 'Bearer forged.token.here').expect(401);
    await http.get('/admin/overview').set('authorization', `Bearer ${(await h.passenger()).token}`).expect(403);
    await http.get('/admin/overview').set('authorization', `Bearer ${admin}`).expect(200);
  });

  it('does not reveal whether an email is registered', async () => {
    const a = await http.post('/auth/passenger/login').send({ email: 'ada@ridesrus.app', password: 'wrong-password' }).expect(401);
    const b = await http.post('/auth/passenger/login').send({ email: 'nobody@example.com', password: 'wrong-password' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('shift keys: one-time, bound to a bus, revoked when the shift ends', async () => {
    const bus = (await http.get('/admin/buses').set('authorization', `Bearer ${admin}`)).body[0];
    const driver = (await http.post('/admin/drivers').set('authorization', `Bearer ${admin}`).send({ name: 'Bisi Ade', phone: '+2348031112222' }).expect(201)).body;
    expect(driver.code).toMatch(/^RR-\d{4}$/);

    const { pin } = (await http.post(`/admin/drivers/${driver.id}/shift-keys`).set('authorization', `Bearer ${admin}`).send({ busId: bus.id }).expect(201)).body;
    const login = await http.post('/auth/driver/login').send({ driverCode: driver.code, pin }).expect(201);
    await http.post('/auth/driver/login').send({ driverCode: driver.code, pin }).expect(401); // single use

    const token = login.body.token;
    const state = (await http.get('/driver/state').set('authorization', `Bearer ${token}`).expect(200)).body;
    expect(state.bus.id).toBe(bus.id);
    expect(state.driver.code).toBe(driver.code);
    const qr = (await http.get('/driver/qr').set('authorization', `Bearer ${token}`).expect(200)).body;
    expect(qr.token).toMatch(new RegExp(`^rr1\\.${bus.id}\\.`));

    await http.post('/driver/shift/end').set('authorization', `Bearer ${token}`).expect(200);
    await http.get('/driver/state').set('authorization', `Bearer ${token}`).expect(401);
  });

  it('offline driver actions replay idempotently and never block the queue', async () => {
    const { bus, shift, driver } = await h.busInService('RR-105');
    const { TokenService } = await import('../src/auth/token.service');
    const token = h.app.get(TokenService).issue({ role: 'driver', sub: driver.id, shiftId: shift.id, busId: bus.id }).token;
    const actions = [
      { type: 'ACK_HAIL', idempotencyKey: key(), at: Date.now(), hailIds: ['does-not-exist'] },
      { type: 'ARRIVE_STOP', idempotencyKey: key(), at: Date.now(), stopId: 'stop_not_real' },
      { type: 'ARRIVE_STOP', idempotencyKey: key(), at: Date.now(), stopId: 'stop_chevron' },
    ];
    const first = (await http.post('/driver/actions').set('authorization', `Bearer ${token}`).send({ actions }).expect(200)).body;
    expect(first.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, true]);
    const again = (await http.post('/driver/actions').set('authorization', `Bearer ${token}`).send({ actions }).expect(200)).body;
    expect(again.every((r: { replayed: boolean }) => r.replayed)).toBe(true);
    expect(again.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, true]);
  });

  it('top-ups credit exactly once no matter how many times settlement runs', async () => {
    const p = await h.passenger();
    const topUps = h.app.get(TopUpsService);
    const sandbox = h.app.get<SandboxProvider>(PAYMENT_PROVIDER);
    const { reference } = await topUps.start(p.id, naira(3_000));

    expect(await topUps.settle(reference)).toBe('PENDING');
    sandbox.complete(reference, true);
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => topUps.settle(reference)));

    expect(outcomes.every((o) => o === 'SUCCEEDED')).toBe(true);
    expect(await h.app.get(LedgerService).balance(p.id)).toBe(naira(3_000));
  });

  it('declined top-ups never credit', async () => {
    const p = await h.passenger();
    const topUps = h.app.get(TopUpsService);
    const { reference } = await topUps.start(p.id, naira(1_000));
    h.app.get<SandboxProvider>(PAYMENT_PROVIDER).complete(reference, false);
    expect(await topUps.settle(reference)).toBe('FAILED');
    expect(await h.app.get(LedgerService).balance(p.id)).toBe(0);
  });

  it('Flutterwave webhooks must carry the shared secret hash', () => {
    const flw = new FlutterwaveProvider('sk', 'expected-hash', 'ridesrus://wallet');
    const body = { event: 'charge.completed', data: { tx_ref: 'topup_abc' } };
    expect(flw.referenceFromWebhook({ 'verif-hash': 'expected-hash' }, body)).toBe('topup_abc');
    expect(flw.referenceFromWebhook({ 'verif-hash': 'wrong-hash-xx' }, body)).toBeNull();
    expect(flw.referenceFromWebhook({}, body)).toBeNull();
  });

  it('the public map exposes positions but no personal data', async () => {
    await h.busInService('RR-106');
    const fleet = (await http.get('/fleet').expect(200)).body;
    expect(fleet.length).toBeGreaterThan(0);
    expect(Object.keys(fleet[0]).sort()).toEqual(
      ['band', 'capacity', 'code', 'direction', 'heading', 'id', 'inService', 'lat', 'lng', 'nextStopEtaSec', 'nextStopId', 'occupied', 'plate', 'routeId', 'source', 'updatedAt'].sort(),
    );
  });
});
