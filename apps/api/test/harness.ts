import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/main';
import { loadConfig } from '../src/config';
import { AuthService } from '../src/auth/auth.service';
import { FleetStateService } from '../src/fleet/fleet-state.service';
import { NetworkService } from '../src/fleet/network.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TopUpsService } from '../src/wallet/topups.service';

export type Harness = Awaited<ReturnType<typeof createHarness>>;

let driverSeq = Math.floor(Math.random() * 5000);

export async function createHarness() {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DEMO_MODE: 'false',
    PAYMENTS_PROVIDER: 'sandbox',
    JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
    QR_SECRET: 'qr-secret-qr-secret-qr-secret-qr-secret-12',
  });
  const app: INestApplication = await createApp(config);
  await app.init();
  const prisma = app.get(PrismaService);
  const fleet = app.get(FleetStateService);
  const network = app.get(NetworkService);
  const auth = app.get(AuthService);
  const topUps = app.get(TopUpsService);

  /** Puts a driver on shift on a bus and parks it at a stop so it's in service. */
  async function busInService(code: string, opts: { capacity?: number; atStop?: string } = {}) {
    const bus = await prisma.bus.findUniqueOrThrow({ where: { code } });
    await prisma.trip.updateMany({ where: { busId: bus.id, status: 'BOARDED' }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await prisma.bus.update({ where: { id: bus.id }, data: { occupied: 0, ...(opts.capacity ? { capacity: opts.capacity } : {}) } });
    await network.reload();
    fleet.setOccupancy(bus.id, 0);
    await prisma.shift.updateMany({ where: { busId: bus.id, endedAt: null }, data: { endedAt: new Date() } });
    const n = ++driverSeq;
    const driver = await prisma.driver.create({ data: { code: `RR-${String(n).padStart(4, '0')}`, name: 'Test Driver', phone: `+23470${String(n).padStart(8, '0')}` } });
    const shift = await prisma.shift.create({ data: { driverId: driver.id, busId: bus.id, expiresAt: new Date(Date.now() + 3600_000) } });
    fleet.setShift(bus.id, shift.id);
    const geometry = network.geometryForBus(bus.id);
    fleet.setSimulated(bus.id, geometry.stopPos.get(opts.atStop ?? 'stop_falomo')! + 1);
    return { bus: network.bus(bus.id), shift, driver };
  }

  async function passenger(balanceKobo = 0) {
    const res = await auth.registerPassenger({ name: 'Test Rider', email: `t-${randomUUID()}@example.com`, password: 'password123' });
    if (balanceKobo > 0) await topUps.grantPromo(res.passenger.id, balanceKobo, `test_${randomUUID()}`, 'Test credit');
    return { id: res.passenger.id, token: res.token };
  }

  return { app, config, prisma, fleet, network, busInService, passenger, close: () => app.close() };
}

export const key = () => randomUUID();
