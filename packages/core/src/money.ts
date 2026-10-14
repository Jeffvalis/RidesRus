/**
 * All money in RidesRus is stored and transmitted as integer kobo (₦1 = 100 kobo).
 * Floats never touch a balance: 0.1 + 0.2 bugs in a wallet are real bugs.
 */
export type Kobo = number;

export const KOBO_PER_NAIRA = 100;

export const naira = (amount: number): Kobo => Math.round(amount * KOBO_PER_NAIRA);

export function assertKobo(value: number, label = 'amount'): Kobo {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer number of kobo`);
  return value;
}

/** ₦1,500 or ₦1,500.50 — whole naira drop the decimals. */
export function formatNaira(kobo: Kobo): string {
  const negative = kobo < 0;
  const abs = Math.abs(kobo);
  const whole = Math.floor(abs / KOBO_PER_NAIRA);
  const fraction = abs % KOBO_PER_NAIRA;
  const wholeStr = whole.toLocaleString('en-NG');
  const body = fraction === 0 ? wholeStr : `${wholeStr}.${String(fraction).padStart(2, '0')}`;
  return `${negative ? '-' : ''}₦${body}`;
}

/** Wallet top-up limits (kobo). */
export const TOPUP_MIN: Kobo = naira(500);
export const TOPUP_MAX: Kobo = naira(50_000);
