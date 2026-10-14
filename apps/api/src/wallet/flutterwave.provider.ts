import { Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { KOBO_PER_NAIRA } from '@ridesrus/core';
import { CheckoutRequest, PaymentProvider, VerifiedPayment } from './payment-provider';

const FLW_API = 'https://api.flutterwave.com/v3';

/**
 * Flutterwave Standard (hosted checkout).
 *  - createCheckout → POST /v3/payments, returns the hosted payment link
 *  - verify         → GET /v3/transactions/verify_by_reference?tx_ref=…
 *  - webhooks       → authenticated by the `verif-hash` header, then re-verified via the API
 */
export class FlutterwaveProvider implements PaymentProvider {
  readonly name = 'flutterwave';
  private readonly logger = new Logger('Flutterwave');

  constructor(
    private readonly secretKey: string,
    private readonly webhookHash: string,
    private readonly redirectUrl: string,
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${FLW_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) this.logger.warn(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
    return body;
  }

  async createCheckout(req: CheckoutRequest) {
    const body = await this.call<{ status: string; message?: string; data?: { link: string } }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: req.reference,
        amount: req.amountKobo / KOBO_PER_NAIRA,
        currency: 'NGN',
        redirect_url: this.redirectUrl,
        customer: { email: req.email, name: req.name },
        customizations: { title: 'RidesRus wallet top-up' },
      }),
    });
    if (body.status !== 'success' || !body.data?.link) {
      throw new Error(`Flutterwave checkout failed: ${body.message ?? 'unknown error'}`);
    }
    return { checkoutUrl: body.data.link };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const body = await this.call<{
      status: string;
      data?: { id: number; status: string; amount: number; currency: string; tx_ref: string };
    }>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
    const tx = body.data;
    if (!tx || tx.tx_ref !== reference) return { status: 'PENDING' };
    if (tx.status === 'successful') {
      return {
        status: 'SUCCEEDED',
        amountKobo: Math.round(tx.amount * KOBO_PER_NAIRA),
        currency: tx.currency,
        providerTxId: String(tx.id),
      };
    }
    if (tx.status === 'failed' || tx.status === 'cancelled') return { status: 'FAILED', providerTxId: String(tx.id) };
    return { status: 'PENDING' };
  }

  referenceFromWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): string | null {
    const given = headers['verif-hash'];
    if (typeof given !== 'string') return null;
    const a = Buffer.from(given);
    const b = Buffer.from(this.webhookHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const ref = (body as { data?: { tx_ref?: unknown } })?.data?.tx_ref;
    return typeof ref === 'string' ? ref : null;
  }
}
