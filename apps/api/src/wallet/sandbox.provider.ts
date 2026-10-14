import { Kobo } from '@ridesrus/core';
import { CheckoutRequest, PaymentProvider, VerifiedPayment } from './payment-provider';

/**
 * Stand-in gateway for local development and the public demo. Checkout opens a
 * page served by this API (see SandboxCheckoutController) with Pay / Decline
 * buttons, so the passenger flow is identical to the real one: open checkout →
 * come back → wallet credited after server-side verification.
 */
export class SandboxProvider implements PaymentProvider {
  readonly name = 'sandbox';
  private readonly outcomes = new Map<string, { status: 'SUCCEEDED' | 'FAILED'; amountKobo: Kobo }>();
  private readonly amounts = new Map<string, Kobo>();

  constructor(private readonly publicApiUrl: string) {}

  async createCheckout(req: CheckoutRequest) {
    this.amounts.set(req.reference, req.amountKobo);
    return { checkoutUrl: `${this.publicApiUrl}/payments/sandbox/${encodeURIComponent(req.reference)}` };
  }

  /** Called by the sandbox checkout page. */
  complete(reference: string, success: boolean): boolean {
    const amountKobo = this.amounts.get(reference);
    if (amountKobo === undefined) return false;
    this.outcomes.set(reference, { status: success ? 'SUCCEEDED' : 'FAILED', amountKobo });
    return true;
  }

  amountFor(reference: string): Kobo | undefined {
    return this.amounts.get(reference);
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const outcome = this.outcomes.get(reference);
    if (!outcome) return { status: 'PENDING' };
    if (outcome.status === 'FAILED') return { status: 'FAILED', providerTxId: `sbx_${reference}` };
    return { status: 'SUCCEEDED', amountKobo: outcome.amountKobo, currency: 'NGN', providerTxId: `sbx_${reference}` };
  }

  referenceFromWebhook(): string | null {
    return null; // the sandbox settles via the checkout page, never via webhooks
  }
}
