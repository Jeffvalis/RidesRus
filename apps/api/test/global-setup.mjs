// Integration tests run against a real, throwaway Postgres — the invariants under test live in the database.
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export default async function globalSetup() {
  const port = 5444 + Math.floor(Math.random() * 400);
  const dir = mkdtempSync(join(tmpdir(), 'ridesrus-test-pg-'));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('ridesrus_test');
  const url = `postgresql://test:test@localhost:${port}/ridesrus_test`;
  process.env.DATABASE_URL = url;
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { cwd: apiDir, env, stdio: 'ignore' });
  execSync('npx tsx scripts/seed.ts', { cwd: apiDir, env, stdio: 'ignore' });
  globalThis.__PG__ = pg;
}
