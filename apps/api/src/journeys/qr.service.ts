import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DriverQrDTO, ErrorCodes, QR_WINDOW_MS } from '@ridesrus/core';
import { AppError } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config';

/**
 * Rotating boarding codes.
 *
 * The driver tablet shows `rr1.<busId>.<window>.<sig>` where window = ⌊now/30s⌋
 * and sig = HMAC-SHA256(QR_SECRET, busId.window). The code carries no fare and
 * no user data: the server decides the fare from the bus's route. A screenshot
 * stops working within a minute, and a forged code fails the HMAC.
 */
@Injectable()
export class QrService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private sign(busId: string, window: number): string {
    return createHmac('sha256', this.config.QR_SECRET).update(`${busId}.${window}`).digest('base64url').slice(0, 27);
  }

  issue(busId: string, now = Date.now()): DriverQrDTO {
    const window = Math.floor(now / QR_WINDOW_MS);
    return {
      token: `rr1.${busId}.${window}.${this.sign(busId, window)}`,
      expiresAt: (window + 1) * QR_WINDOW_MS,
      windowMs: QR_WINDOW_MS,
    };
  }

  /** Returns the bus id the code belongs to. Accepts the current and previous window for clock skew. */
  verify(token: string, now = Date.now()): string {
    const parts = token.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'rr1') throw this.invalid();
    const [, busId, windowStr, sig] = parts;
    const window = Number(windowStr);
    if (!Number.isSafeInteger(window)) throw this.invalid();

    const expected = Buffer.from(this.sign(busId, window));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw this.invalid();

    const current = Math.floor(now / QR_WINDOW_MS);
    if (window > current + 1 || window < current - 1) {
      throw new AppError(ErrorCodes.QR_EXPIRED, 'That code has expired. Scan the code on the bus screen again.', HttpStatus.GONE);
    }
    return busId;
  }

  private invalid() {
    return new AppError(ErrorCodes.QR_INVALID, "That isn't a RidesRus boarding code.");
  }
}
