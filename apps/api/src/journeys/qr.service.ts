import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DriverQrDTO, ErrorCodes, QR_WINDOW_MS } from '@ridesrus/core';
import { AppError } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config';
import { NetworkService } from '../fleet/network.service';

const MANUAL_CODE = /^(RR-\d{3})\s*[:·\- ]\s*(\d{3})\s?(\d{3})$/i;

/**
 * Rotating boarding codes.
 *
 * The driver tablet shows `rr1.<busId>.<window>.<sig>` as a QR, where
 * window = ⌊now/30s⌋ and sig = HMAC-SHA256(QR_SECRET, busId.window). Underneath
 * it shows a 6-digit code derived from the same HMAC, for riders whose camera
 * won't scan ("RR-102 · 482 913"). Neither carries a fare or user data — the
 * server prices the trip from the bus's route. A screenshot stops working within
 * a minute, and a forged code fails the HMAC.
 */
@Injectable()
export class QrService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly network: NetworkService,
  ) {}

  private mac(busId: string, window: number): Buffer {
    return createHmac('sha256', this.config.QR_SECRET).update(`${busId}.${window}`).digest();
  }

  private sign(busId: string, window: number): string {
    return this.mac(busId, window).toString('base64url').slice(0, 27);
  }

  /** 6 digits via HOTP-style dynamic truncation of the same MAC. */
  private shortCode(busId: string, window: number): string {
    const mac = this.mac(busId, window);
    const offset = mac[mac.length - 1] & 0x0f;
    const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(n).padStart(6, '0');
  }

  issue(busId: string, now = Date.now()): DriverQrDTO {
    const window = Math.floor(now / QR_WINDOW_MS);
    return {
      token: `rr1.${busId}.${window}.${this.sign(busId, window)}`,
      shortCode: this.shortCode(busId, window),
      busCode: this.network.bus(busId).code,
      expiresAt: (window + 1) * QR_WINDOW_MS,
      windowMs: QR_WINDOW_MS,
    };
  }

  /** Returns the bus id the code belongs to. Accepts the current and previous window for clock skew. */
  verify(token: string, now = Date.now()): string {
    const manual = MANUAL_CODE.exec(token.trim());
    if (manual) return this.verifyManual(manual[1].toUpperCase(), manual[2] + manual[3], now);

    const parts = token.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'rr1') throw this.invalid();
    const [, busId, windowStr, sig] = parts;
    const window = Number(windowStr);
    if (!Number.isSafeInteger(window)) throw this.invalid();

    if (!safeEqual(this.sign(busId, window), sig)) throw this.invalid();

    const current = Math.floor(now / QR_WINDOW_MS);
    if (window > current + 1 || window < current - 1) {
      throw new AppError(ErrorCodes.QR_EXPIRED, 'That code has expired. Scan the code on the bus screen again.', HttpStatus.GONE);
    }
    return busId;
  }

  private verifyManual(busCode: string, code: string, now: number): string {
    const bus = this.network.allBuses().find((b) => b.code === busCode);
    if (!bus) throw this.invalid();
    const current = Math.floor(now / QR_WINDOW_MS);
    for (const window of [current, current - 1]) {
      if (safeEqual(this.shortCode(bus.id, window), code)) return bus.id;
    }
    throw new AppError(ErrorCodes.QR_EXPIRED, 'That code is wrong or has changed. Check the bus screen and try again.', HttpStatus.GONE);
  }

  private invalid() {
    return new AppError(ErrorCodes.QR_INVALID, "That isn't a RidesRus boarding code.");
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
