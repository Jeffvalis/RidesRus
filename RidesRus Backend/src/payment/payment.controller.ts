import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /payment/fund-wallet
   * Passenger initiates wallet funding. Returns a Flutterwave payment link.
   */
  @Post('fund-wallet')
  fundWallet(@Body() body: { userId: string; amount: number; email: string }) {
    return this.paymentService.initializeWalletFunding(body.userId, body.amount, body.email);
  }

  /**
   * GET /payment/verify?reference=xxx
   * Called after Flutterwave redirects back. Verifies payment and credits wallet.
   */
  @Get('verify')
  verifyPayment(@Query('reference') reference: string) {
    return this.paymentService.verifyAndCreditWallet(reference);
  }

  /**
   * POST /payment/deduct-fare
   * Called when passenger scans QR code on the bus to board.
   */
  @Post('deduct-fare')
  deductFare(@Body() body: { userId: string; fare: number; busId: string }) {
    return this.paymentService.deductTripFare(body.userId, body.fare, body.busId);
  }

  /**
   * GET /payment/balance?userId=xxx
   * Returns the user's current wallet balance.
   */
  @Get('balance')
  getBalance(@Query('userId') userId: string) {
    return this.paymentService.getWalletBalance(userId);
  }

  /**
   * POST /payment/webhook
   * Flutterwave sends payment status updates here.
   * In production, verify the webhook signature with FLW_WEBHOOK_SECRET.
   */
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Flutterwave sends: { event: 'charge.completed', data: { tx_ref, status, ... } }
    if (body?.event === 'charge.completed' && body?.data?.status === 'successful') {
      const reference = body.data.tx_ref;
      return this.paymentService.verifyAndCreditWallet(reference);
    }
    return { status: 'ignored' };
  }
}
