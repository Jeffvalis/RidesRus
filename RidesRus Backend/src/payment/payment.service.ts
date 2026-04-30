import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

// Flutterwave SDK
const Flutterwave = require('flutterwave-node-v3');

@Injectable()
export class PaymentService {
  private flw: any;

  constructor(private prisma: PrismaService) {
    this.flw = new Flutterwave(
      process.env.FLW_PUBLIC_KEY || '',
      process.env.FLW_SECRET_KEY || '',
    );
  }

  /**
   * Initialize a payment for wallet funding.
   * Creates a Flutterwave payment link the passenger opens in-app.
   */
  async initializeWalletFunding(userId: string, amount: number, email: string) {
    const reference = `wallet_${uuidv4()}`;

    // Record pending transaction in our DB first
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'WALLET_FUND',
        amount,
        status: 'PENDING',
        reference,
      },
    });

    // Create Flutterwave Standard payment link
    const payload = {
      tx_ref: reference,
      amount,
      currency: 'NGN',
      redirect_url: process.env.FLW_REDIRECT_URL || 'http://localhost:3000/payment/callback',
      customer: { email },
      customizations: {
        title: 'RidesRus Wallet',
        description: 'Fund your RidesRus wallet',
      },
    };

    // The Flutterwave Node SDK doesn't have a direct "hosted link" method,
    // so we construct the payment link via their standard API
    const response = await this.flw.Charge.card(payload).catch(() => null);

    return {
      transactionId: transaction.id,
      reference,
      // In production, you'd return the Flutterwave hosted payment link
      message: 'Payment initialized. Redirect user to Flutterwave checkout.',
      flutterwaveResponse: response,
    };
  }

  /**
   * Verify a Flutterwave transaction and credit the user's wallet.
   */
  async verifyAndCreditWallet(reference: string) {
    // Find our local transaction record
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    if (transaction.status === 'SUCCESS') {
      return { message: 'Transaction already verified', transaction };
    }

    // Verify with Flutterwave
    try {
      const response = await this.flw.Transaction.verify({ id: reference });

      if (
        response?.data?.status === 'successful' &&
        response?.data?.amount >= transaction.amount &&
        response?.data?.currency === 'NGN'
      ) {
        // Credit user wallet atomically
        const [updatedTransaction, updatedUser] = await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { reference },
            data: { status: 'SUCCESS' },
          }),
          this.prisma.user.update({
            where: { id: transaction.userId },
            data: { walletBalance: { increment: transaction.amount } },
          }),
        ]);

        return {
          message: 'Wallet funded successfully',
          walletBalance: updatedUser.walletBalance,
          transaction: updatedTransaction,
        };
      } else {
        await this.prisma.transaction.update({
          where: { reference },
          data: { status: 'FAILED' },
        });
        throw new BadRequestException('Payment verification failed');
      }
    } catch (error) {
      throw new BadRequestException('Could not verify payment with Flutterwave');
    }
  }

  /**
   * Deduct fare from user wallet when they board (scan QR).
   * This is an internal wallet deduction, no Flutterwave call needed.
   */
  async deductTripFare(userId: string, fare: number, busId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.walletBalance < fare) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const reference = `trip_${uuidv4()}`;

    const [transaction, updatedUser, trip] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          type: 'TRIP_PAYMENT',
          amount: fare,
          status: 'SUCCESS',
          reference,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: fare } },
      }),
      this.prisma.trip.create({
        data: {
          passengerId: userId,
          busId,
          status: 'ON_BOARD',
          fare,
        },
      }),
    ]);

    return {
      message: 'Fare deducted, you are now boarded!',
      walletBalance: updatedUser.walletBalance,
      tripId: trip.id,
      transaction,
    };
  }

  /**
   * Get user wallet balance.
   */
  async getWalletBalance(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    return { walletBalance: user.walletBalance };
  }
}
