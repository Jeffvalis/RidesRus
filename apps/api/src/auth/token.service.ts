import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../config';
import { Principal } from './principal';

const TTL_SECONDS: Record<Principal['role'], number> = {
  passenger: 30 * 24 * 3600, // phones stay signed in, like every ride app
  driver: 12 * 3600, // one shift; the shift row is also checked on every request
  admin: 12 * 3600,
};

@Injectable()
export class TokenService {
  private readonly jwt: JwtService;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.jwt = new JwtService({ secret: config.JWT_SECRET, signOptions: { issuer: 'ridesrus', algorithm: 'HS256' } });
  }

  issue(principal: Principal, ttlSeconds = TTL_SECONDS[principal.role]): { token: string; expiresAt: number } {
    const token = this.jwt.sign({ ...principal }, { expiresIn: ttlSeconds });
    return { token, expiresAt: Date.now() + ttlSeconds * 1000 };
  }

  /** Returns null for anything malformed, expired or forged. */
  verify(token: string | undefined | null): Principal | null {
    if (!token) return null;
    try {
      const p = this.jwt.verify<Principal & { iat: number; exp: number }>(token, {
        issuer: 'ridesrus',
        algorithms: ['HS256'],
      });
      if (p.role === 'driver') return { role: 'driver', sub: p.sub, shiftId: p.shiftId, busId: p.busId };
      if (p.role === 'passenger' || p.role === 'admin') return { role: p.role, sub: p.sub };
      return null;
    } catch {
      return null;
    }
  }
}
