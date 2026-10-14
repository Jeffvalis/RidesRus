import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3005),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: bool,
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  QR_SECRET: z.string().min(32, 'QR_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3005'),
  DEMO_MODE: bool,
  /** Demo buses drive this many times faster than real traffic, so a visitor sees stops every couple of minutes. */
  DEMO_SPEEDUP: z.coerce.number().min(1).max(10).default(3),
  PAYMENTS_PROVIDER: z.enum(['sandbox', 'flutterwave']).default('sandbox'),
  FLW_SECRET_KEY: z.string().optional(),
  FLW_WEBHOOK_HASH: z.string().optional(),
  FLW_REDIRECT_URL: z.string().default('ridesrus://wallet'),
});

export type AppConfig = z.infer<typeof Env> & { corsOrigins: string[] };

/** Parsed once at boot. A misconfigured server refuses to start rather than failing at 8 AM rush hour. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  const env = parsed.data;
  if (env.PAYMENTS_PROVIDER === 'flutterwave' && (!env.FLW_SECRET_KEY || !env.FLW_WEBHOOK_HASH)) {
    throw new Error('PAYMENTS_PROVIDER=flutterwave requires FLW_SECRET_KEY and FLW_WEBHOOK_HASH');
  }
  if (env.NODE_ENV === 'production' && env.PAYMENTS_PROVIDER === 'sandbox' && !env.DEMO_MODE) {
    throw new Error('Sandbox payments are only allowed in production when DEMO_MODE=true');
  }
  return { ...env, corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
