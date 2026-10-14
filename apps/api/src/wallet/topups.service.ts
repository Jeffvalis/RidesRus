import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Kobo, TopUpDTO, formatNaira, shortName } from '@ridesrus/core';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LedgerService, SYSTEM_ACCOUNTS } from './ledger.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';

/**
 * Wallet top-ups through a hosted checkout.
 *
 *   start()  → PENDING TopUp row + checkout URL
 *   settle() → asks the gateway (never the client) what happened, then credits
 *              the wallet exactly once. Safe to call from the app's poll, the
 *              redirect and the webhook — whichever arrives first wins.
 */
@Injectable()
export class TopUpsService {
  private readonly logger = new Logger('TopUps');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly realtime: RealtimeService,
    private readonly activity: ActivityService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async start(passengerId: string, amountKobo: Kobo): Promise<TopUpDTO> {
    const passenger = await this.prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    const reference = `topup_${randomUUID()}`;
    await this.prisma.topUp.create({
      data: { passengerId, reference, amountKobo, provider: this.provider.name },
    });
    const { checkoutUrl } = await this.provider.createCheckout({
      reference,
      amountKobo,
      email: passenger.email,
      name: passenger.name,
    });
    return { reference, checkoutUrl, status: 'PENDING' };
  }

  async status(passengerId: string, reference: string): Promise<TopUpDTO> {
    const topUp = await this.prisma.topUp.findFirst({ where: { reference, passengerId } });
    if (!topUp) throw notFound('Top-up');
    const status = topUp.status === 'PENDING' ? await this.settle(reference) : topUp.status;
    return { reference, checkoutUrl: '', status };
  }

  async settle(reference: string): Promise<'PENDING' | 'SUCCEEDED' | 'FAILED'> {
    const topUp = await this.prisma.topUp.findUnique({ where: { reference } });
    if (!topUp) return 'FAILED';
    if (topUp.status !== 'PENDING') return topUp.status;

    const result = await this.provider.verify(reference);
    if (result.status === 'PENDING') return 'PENDING';

    if (result.status === 'FAILED') {
      await this.prisma.topUp.updateMany({
        where: { reference, status: 'PENDING' },
        data: { status: 'FAILED', providerTxId: result.providerTxId },
      });
      return 'FAILED';
    }

    if (result.currency !== 'NGN' || result.amountKobo < topUp.amountKobo) {
      this.logger.warn(`Top-up ${reference} amount/currency mismatch: ${result.amountKobo} ${result.currency}`);
      await this.prisma.topUp.updateMany({ where: { reference, status: 'PENDING' }, data: { status: 'FAILED' } });
      return 'FAILED';
    }

    const credited = await this.prisma.$transaction(async (tx) => {
      // Conditional flip makes concurrent settle() calls credit exactly once.
      const claimed = await tx.topUp.updateMany({
        where: { reference, status: 'PENDING' },
        data: { status: 'SUCCEEDED', providerTxId: result.providerTxId },
      });
      if (claimed.count === 0) return false;
      const walletId = await this.ledger.walletAccountId(tx, topUp.passengerId);
      const { transferId } = await this.ledger.post(tx, {
        kind: 'TOPUP',
        reference,
        description: `Wallet top-up`,
        entries: [
          { accountId: SYSTEM_ACCOUNTS.GATEWAY_CLEARING, amountKobo: -topUp.amountKobo },
          { accountId: walletId, amountKobo: topUp.amountKobo },
        ],
      });
      await tx.topUp.update({ where: { reference }, data: { transferId } });
      return true;
    });

    if (credited) {
      const balanceKobo = await this.ledger.balance(topUp.passengerId);
      this.realtime.toPassenger(topUp.passengerId, 'wallet:updated', { balanceKobo });
      const p = await this.prisma.passenger.findUnique({ where: { id: topUp.passengerId }, select: { name: true } });
      this.activity.record('TOPUP', `${shortName(p?.name ?? 'Rider')} topped up ${formatNaira(topUp.amountKobo)}`);
    }
    return 'SUCCEEDED';
  }

  /** Promotional credit (welcome bonus, demo riders). Idempotent per reference. */
  async grantPromo(passengerId: string, amountKobo: Kobo, reference: string, description: string) {
    await this.prisma.$transaction(async (tx) => {
      const walletId = await this.ledger.walletAccountId(tx, passengerId);
      await this.ledger.post(tx, {
        kind: 'PROMO',
        reference,
        description,
        entries: [
          { accountId: SYSTEM_ACCOUNTS.PROMO_EXPENSE, amountKobo: -amountKobo },
          { accountId: walletId, amountKobo },
        ],
      });
    });
  }
}
