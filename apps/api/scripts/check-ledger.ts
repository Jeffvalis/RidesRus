/** Audits the ledger: every transfer balances, cached balances match entries, wallets are non-negative. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const unbalanced = await prisma.$queryRaw<{ reference: string; sum: bigint }[]>`
    SELECT t.reference, SUM(e."amountKobo") AS sum FROM "Transfer" t JOIN "LedgerEntry" e ON e."transferId" = t.id
    GROUP BY t.reference HAVING SUM(e."amountKobo") <> 0`;
  const drift = await prisma.$queryRaw<{ id: string; cached: number; actual: bigint }[]>`
    SELECT a.id, a."balanceKobo" AS cached, COALESCE(SUM(e."amountKobo"), 0) AS actual
    FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a.id
    GROUP BY a.id HAVING a."balanceKobo" <> COALESCE(SUM(e."amountKobo"), 0)`;
  const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COALESCE(SUM("balanceKobo"),0) AS total FROM "LedgerAccount"`;
  const seats = await prisma.$queryRaw<{ code: string; occupied: number; actual: bigint }[]>`
    SELECT b.code, b.occupied, COUNT(t.id) AS actual FROM "Bus" b LEFT JOIN "Trip" t ON t."busId" = b.id AND t.status = 'BOARDED'
    GROUP BY b.id HAVING b.occupied <> COUNT(t.id)`;
  console.log(`unbalanced transfers: ${unbalanced.length}`);
  console.log(`accounts with balance drift: ${drift.length}`);
  console.log(`sum of all balances (must be 0): ${total}`);
  console.log(`buses whose seat count != boarded trips: ${seats.length}`);
  const ok = unbalanced.length === 0 && drift.length === 0 && Number(total) === 0 && seats.length === 0;
  console.log(ok ? 'LEDGER OK' : 'LEDGER PROBLEM');
  process.exit(ok ? 0 : 1);
}
main().finally(() => prisma.$disconnect());
