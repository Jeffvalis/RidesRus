import { Kobo } from '@ridesrus/core';

export type CheckoutRequest = { reference: string; amountKobo: Kobo; email: string; name: string };
export type VerifiedPayment =
  | { status: 'SUCCEEDED'; amountKobo: Kobo; currency: string; providerTxId: string }
  | { status: 'FAILED'; providerTxId?: string }
  | { status: 'PENDING' };

/**
 * Payment gateway boundary. The rest of the system never trusts a client or a
 * webhook body about money: it only acts on `verify()`, which asks the gateway
 * directly.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<{ checkoutUrl: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  /** Authenticate an incoming webhook; returns the payment reference to re-verify, or null. */
  referenceFromWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): string | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
