import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCodes, formatNaira, Kobo, WalletDTO, WalletEntryDTO } from '@ridesrus/core';
import { AppError } from '../common/errors';
import { TransferKind } from '../generated/prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';

/** System accounts, created by the seed. Their balances may go negative by design. */
export const SYSTEM_ACCOUNTS = {
  FARE_REVENUE: 'acct_fare_revenue',
  GATEWAY_CLEARING: 'acct_gateway_clearing',
  PROMO_EXPENSE: 'acct_promo_expense',
} as const;

type Posting = {
  kind: TransferKind;
  /** Unique business key: re-posting the same reference is rejected by the DB. */
  reference: string;
  description: string;
  entries: { accountId: string; amountKobo: Kobo }[];
};

/**
 * Double-entry wallet ledger.
 *
 * Every movement of money is a Transfer whose entries sum to zero, so money is
 * never created or destroyed by a bug — only moved between accounts. Each
 * account keeps a cached balance updated in the same transaction; passenger
 * wallets are debited with a conditional UPDATE (balance >= amount), which makes
 * double-spending impossible even under concurrent boardings, and a CHECK
 * constraint in Postgres backs that up.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async walletAccountId(tx: Tx, passengerId: string): Promise<string> {
    const account = await tx.ledgerAccount.upsert({
      where: { passengerId },
      update: {},
      create: { passengerId, kind: 'PASSENGER_WALLET' },
      select: { id: true },
    });
    return account.id;
  }

  async post(tx: Tx, posting: Posting): Promise<{ transferId: string }> {
    const sum = posting.entries.reduce((s, e) => s + e.amountKobo, 0);
    if (sum !== 0) throw new Error(`Unbalanced transfer ${posting.reference}: entries sum to ${sum}`);
    if (posting.entries.some((e) => !Number.isSafeInteger(e.amountKobo) || e.amountKobo === 0)) {
      throw new Error(`Transfer ${posting.reference} has a non-integer or zero entry`);
    }

    const transfer = await tx.transfer.create({
      data: {
        kind: posting.kind,
        reference: posting.reference,
        description: posting.description,
        entries: { create: posting.entries.map((e) => ({ accountId: e.accountId, amountKobo: e.amountKobo })) },
      },
      select: { id: true },
    });

    // Lock accounts in a stable order so two concurrent transfers can't deadlock.
    const ordered = [...posting.entries].sort((a, b) => a.accountId.localeCompare(b.accountId));
    for (const entry of ordered) {
      if (entry.amountKobo < 0) {
        const debited = await tx.ledgerAccount.updateMany({
          where: {
            id: entry.accountId,
            OR: [{ kind: { not: 'PASSENGER_WALLET' } }, { balanceKobo: { gte: -entry.amountKobo } }],
          },
          data: { balanceKobo: { increment: entry.amountKobo } },
        });
        if (debited.count === 0) {
          throw new AppError(
            ErrorCodes.INSUFFICIENT_FUNDS,
            `Your wallet needs at least ${formatNaira(-entry.amountKobo)}. Top up to continue.`,
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      } else {
        await tx.ledgerAccount.update({
          where: { id: entry.accountId },
          data: { balanceKobo: { increment: entry.amountKobo } },
        });
      }
    }
    return { transferId: transfer.id };
  }

  async balance(passengerId: string): Promise<Kobo> {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { passengerId } });
    return account?.balanceKobo ?? 0;
  }

  async wallet(passengerId: string, limit = 30): Promise<WalletDTO> {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { passengerId } });
    const [entries, openTopUps] = await Promise.all([
      account
        ? this.prisma.ledgerEntry.findMany({
            where: { accountId: account.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { transfer: true },
          })
        : [],
      this.prisma.topUp.findMany({
        where: { passengerId, status: { in: ['PENDING', 'FAILED'] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const ledger: WalletEntryDTO[] = entries.map((e) => ({
      id: e.id,
      kind: e.transfer.kind,
      amountKobo: e.amountKobo,
      description: e.transfer.description,
      status: 'SUCCEEDED',
      createdAt: e.createdAt.getTime(),
    }));
    const pending: WalletEntryDTO[] = openTopUps.map((t) => ({
      id: t.id,
      kind: 'TOPUP',
      amountKobo: t.amountKobo,
      description: t.status === 'FAILED' ? 'Top-up failed' : 'Top-up awaiting payment',
      status: t.status,
      createdAt: t.createdAt.getTime(),
    }));

    return {
      balanceKobo: account?.balanceKobo ?? 0,
      entries: [...pending, ...ledger].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
    };
  }
}
