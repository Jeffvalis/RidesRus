/**
 * Runs a real PostgreSQL server from npm (no Docker, no Homebrew) for local dev.
 *   npm run db:start   → postgres://ridesrus:ridesrus@localhost:5433/ridesrus
 * Data lives in <repo>/.data/pg and survives restarts. Ctrl-C stops it cleanly.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.PG_PORT ?? 5433);
const dataDir = process.env.PG_DATA_DIR ?? join(__dirname, '..', '..', '..', '.data', 'pg');

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'ridesrus',
    password: 'ridesrus',
    port,
    persistent: true,
    onLog: () => undefined,
  });
  const fresh = !existsSync(join(dataDir, 'PG_VERSION'));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase('ridesrus');
  console.log(`Postgres ready on postgres://ridesrus:ridesrus@localhost:${port}/ridesrus (data: ${dataDir})`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
