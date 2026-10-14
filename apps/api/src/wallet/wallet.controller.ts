import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TopUpBody, TopUpDTO, WalletDTO, formatNaira } from '@ridesrus/core';
import { CurrentUser, PassengerPrincipal, Roles } from '../auth/principal';
import { notFound } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { LedgerService } from './ledger.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider';
import { SandboxProvider } from './sandbox.provider';
import { TopUpsService } from './topups.service';

@Controller()
export class WalletController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly topUps: TopUpsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Get('wallet')
  @Roles('passenger')
  wallet(@CurrentUser() user: PassengerPrincipal): Promise<WalletDTO> {
    return this.ledger.wallet(user.sub);
  }

  @Post('wallet/topups')
  @Roles('passenger')
  startTopUp(@CurrentUser() user: PassengerPrincipal, @Body(new ZodPipe(TopUpBody)) body: TopUpBody): Promise<TopUpDTO> {
    return this.topUps.start(user.sub, body.amountKobo);
  }

  /** The app polls this after returning from checkout. */
  @Get('wallet/topups/:reference')
  @Roles('passenger')
  topUpStatus(@CurrentUser() user: PassengerPrincipal, @Param('reference') reference: string): Promise<TopUpDTO> {
    return this.topUps.status(user.sub, reference);
  }

  /** Flutterwave → us. Authenticated by verif-hash, then re-verified with the Flutterwave API before crediting. */
  @Post('payments/flutterwave/webhook')
  @HttpCode(200)
  async webhook(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    const reference = this.provider.referenceFromWebhook(headers, body);
    if (!reference) return { received: false };
    await this.topUps.settle(reference);
    return { received: true };
  }

  /* ───────── Sandbox checkout (DEMO / local only — provider is sandbox) ───────── */

  @Get('payments/sandbox/:reference')
  sandboxPage(@Param('reference') reference: string, @Res() res: Response) {
    const amount = this.sandbox().amountFor(reference);
    if (amount === undefined) throw notFound('Checkout');
    res.type('html').send(sandboxHtml(reference, formatNaira(amount)));
  }

  @Post('payments/sandbox/:reference/:outcome')
  async sandboxComplete(@Param('reference') reference: string, @Param('outcome') outcome: string, @Res() res: Response) {
    if (!this.sandbox().complete(reference, outcome === 'pay')) throw notFound('Checkout');
    await this.topUps.settle(reference);
    res.type('html').send(sandboxDoneHtml(outcome === 'pay'));
  }

  private sandbox(): SandboxProvider {
    if (!(this.provider instanceof SandboxProvider)) throw notFound('Checkout');
    return this.provider;
  }
}

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RidesRus sandbox checkout</title><style>
body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f7f6f4;color:#1a1a1a;display:grid;place-items:center;min-height:100vh;padding:16px}
.card{background:#fff;border-radius:24px;padding:32px;max-width:380px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.tag{display:inline-block;background:#d9f99d;color:#3f6212;font-weight:800;font-size:11px;letter-spacing:.12em;padding:6px 12px;border-radius:99px}
h1{font-size:40px;margin:16px 0 4px;letter-spacing:-1px} p{color:#666;line-height:1.5}
button{width:100%;height:56px;border:0;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px}
.pay{background:#facc15;color:#4d400e}.decline{background:#eeeae1;color:#1a1a1a}</style></head><body><div class="card">${body}</div></body></html>`;

const sandboxHtml = (reference: string, amount: string) =>
  page(`<span class="tag">SANDBOX CHECKOUT</span><h1>${amount}</h1><p>RidesRus wallet top-up. No real card is charged — this page stands in for Flutterwave in the demo.</p>
<form method="post" action="${encodeURIComponent(reference)}/pay"><button class="pay">Pay ${amount}</button></form>
<form method="post" action="${encodeURIComponent(reference)}/decline"><button class="decline">Decline</button></form>`);

const sandboxDoneHtml = (ok: boolean) =>
  page(`<span class="tag">${ok ? 'PAYMENT RECEIVED' : 'PAYMENT DECLINED'}</span><h1>${ok ? 'All set' : 'Cancelled'}</h1>
<p>${ok ? 'Your wallet has been credited.' : 'Nothing was charged.'} You can close this tab and return to RidesRus.</p>
<script>setTimeout(()=>window.close(),1500)</script>`);
