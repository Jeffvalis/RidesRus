/**
 * Seeds the network (route, stops, 6 buses — the PRD's initial rollout), system
 * ledger accounts, an admin, demo drivers and the simulated rider pool.
 * Idempotent: safe to run on every deploy.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { LEKKI_VI_CORRIDOR, naira } from '@ridesrus/core';
import { PrismaClient } from '../src/generated/prisma/client';
import { SIM_RIDER_DOMAIN } from '../src/demo/autopilot.service';
import { SYSTEM_ACCOUNTS } from '../src/wallet/ledger.service';

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl }) });

const BUSES = [
  { code: 'RR-101', plate: 'LND-101-XA' },
  { code: 'RR-102', plate: 'LND-102-XA' },
  { code: 'RR-103', plate: 'LND-103-XA' },
  { code: 'RR-104', plate: 'EKY-104-KJ' },
  { code: 'RR-105', plate: 'EKY-105-KJ' },
  { code: 'RR-106', plate: 'EKY-106-KJ' },
];

const DRIVERS = [
  { code: 'RR-9942', name: 'David Koko', phone: '+2348030000001' },
  { code: 'RR-1021', name: 'Sarah Jide', phone: '+2348030000002' },
  { code: 'RR-3044', name: 'Tunde Ola', phone: '+2348030000003' },
  { code: 'RR-8821', name: 'Michael Ojo', phone: '+2348030000004' },
];

const FIRST = ['Ada', 'Chidi', 'Funmi', 'Ibrahim', 'Kemi', 'Musa', 'Ngozi', 'Segun', 'Tola', 'Uche', 'Yemi', 'Zainab', 'Bola', 'Emeka', 'Halima', 'Femi'];
const LAST = ['Okafor', 'Adeyemi', 'Bello', 'Eze', 'Balogun', 'Nwosu', 'Lawal', 'Okoro', 'Afolabi', 'Danjuma'];

async function main() {
  const r = LEKKI_VI_CORRIDOR;
  await prisma.route.upsert({
    where: { id: r.id },
    update: { code: r.code, name: r.name, fareKobo: r.fareKobo, avgSpeedMps: r.avgSpeedMps, path: r.path },
    create: { id: r.id, code: r.code, name: r.name, fareKobo: r.fareKobo, avgSpeedMps: r.avgSpeedMps, path: r.path },
  });
  for (const [seq, s] of r.stops.entries()) {
    await prisma.stop.upsert({
      where: { id: s.id },
      update: { name: s.name, lat: s.lat, lng: s.lng, seq },
      create: { id: s.id, routeId: r.id, name: s.name, lat: s.lat, lng: s.lng, seq },
    });
  }
  for (const b of BUSES) {
    await prisma.bus.upsert({ where: { code: b.code }, update: {}, create: { ...b, capacity: 18, routeId: r.id } });
  }

  await prisma.ledgerAccount.upsert({ where: { id: SYSTEM_ACCOUNTS.FARE_REVENUE }, update: {}, create: { id: SYSTEM_ACCOUNTS.FARE_REVENUE, kind: 'FARE_REVENUE' } });
  await prisma.ledgerAccount.upsert({ where: { id: SYSTEM_ACCOUNTS.GATEWAY_CLEARING }, update: {}, create: { id: SYSTEM_ACCOUNTS.GATEWAY_CLEARING, kind: 'GATEWAY_CLEARING' } });
  await prisma.ledgerAccount.upsert({ where: { id: SYSTEM_ACCOUNTS.PROMO_EXPENSE }, update: {}, create: { id: SYSTEM_ACCOUNTS.PROMO_EXPENSE, kind: 'PROMO_EXPENSE' } });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ridesrus.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'fleet-hq-demo';
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: 'Fleet HQ', passwordHash: await bcrypt.hash(adminPassword, 10) },
  });

  for (const d of DRIVERS) await prisma.driver.upsert({ where: { code: d.code }, update: {}, create: d });

  const demoPassenger = 'ada@ridesrus.app';
  if (!(await prisma.passenger.findUnique({ where: { email: demoPassenger } }))) {
    await prisma.passenger.create({
      data: {
        name: 'Ada Okafor',
        email: demoPassenger,
        phone: '+2348090000001',
        passwordHash: await bcrypt.hash('ridesrus-demo', 10),
        account: { create: { kind: 'PASSENGER_WALLET' } },
      },
    });
  }
  const ada = await prisma.passenger.findUniqueOrThrow({ where: { email: demoPassenger }, include: { account: true } });
  const welcomeRef = `seed_credit_${ada.id}`;
  if (!(await prisma.transfer.findUnique({ where: { reference: welcomeRef } }))) {
    const amount = naira(5_000);
    await prisma.$transaction([
      prisma.transfer.create({
        data: {
          kind: 'PROMO',
          reference: welcomeRef,
          description: 'Welcome credit',
          entries: { create: [{ accountId: SYSTEM_ACCOUNTS.PROMO_EXPENSE, amountKobo: -amount }, { accountId: ada.account!.id, amountKobo: amount }] },
        },
      }),
      prisma.ledgerAccount.update({ where: { id: SYSTEM_ACCOUNTS.PROMO_EXPENSE }, data: { balanceKobo: { decrement: amount } } }),
      prisma.ledgerAccount.update({ where: { id: ada.account!.id }, data: { balanceKobo: { increment: amount } } }),
    ]);
  }

  const simHash = await bcrypt.hash(`sim-${Date.now()}-${Math.random()}`, 10);
  for (let i = 0; i < 80; i++) {
    const email = `rider-${String(i).padStart(2, '0')}@${SIM_RIDER_DOMAIN}`;
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    await prisma.passenger.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: simHash, isGuest: true, account: { create: { kind: 'PASSENGER_WALLET' } } },
    });
  }

  console.log('Seeded: route 42A (9 stops), 6 buses, 4 drivers, 80 simulated riders.');
  console.log(`  Fleet HQ   ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : adminPassword}`);
  console.log(`  Passenger  ${demoPassenger} / ridesrus-demo  (₦5,000 wallet)`);
  console.log(`  Drivers    ${DRIVERS.map((d) => d.code).join(', ')} — issue a shift key from Fleet HQ to sign in`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
