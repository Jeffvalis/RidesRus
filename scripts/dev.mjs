#!/usr/bin/env node
/**
 * One command for the whole system:  npm run dev
 *   Postgres (embedded) → migrate + seed → API :3005 → Fleet HQ :3000 → passenger :8081 → driver :8082
 * Ctrl-C stops everything.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';

const children = [];
const colors = { db: 90, api: 33, admin: 36, passenger: 32, driver: 35 };

function run(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '1', ...env }, shell: process.platform === 'win32' });
  const tag = `\x1b[${colors[name]}m${name.padEnd(9)}\x1b[0m│ `;
  const pipe = (stream) => stream.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach((l) => process.stdout.write(tag + l + '\n')));
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => code && process.stdout.write(`${tag}exited with ${code}\n`));
  children.push(child);
  return child;
}

const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.on('connect', () => (s.destroy(), resolve(true)));
    s.on('error', () => resolve(false));
  });

async function waitFor(port, label, timeoutMs = 60_000) {
  const start = Date.now();
  while (!(await portOpen(port))) {
    if (Date.now() - start > timeoutMs) throw new Error(`${label} did not start on :${port}`);
    await sleep(500);
  }
}

const stop = () => {
  children.forEach((c) => c.kill('SIGINT'));
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const once = (name, cmd, args, cwd) =>
  new Promise((resolve, reject) => run(name, cmd, args, cwd).on('exit', (c) => (c ? reject(new Error(`${name} failed`)) : resolve())));

if (!(await portOpen(5433))) run('db', 'npm', ['run', 'db:start'], 'apps/api');
await waitFor(5433, 'Postgres');
await once('db', 'npx', ['prisma', 'migrate', 'deploy'], 'apps/api');
await once('db', 'npx', ['tsx', 'scripts/seed.ts'], 'apps/api');
run('api', 'npm', ['run', 'dev'], 'apps/api');
await waitFor(3005, 'API', 120_000);
run('admin', 'npm', ['run', 'dev'], 'apps/admin');
run('passenger', 'npx', ['expo', 'start', '--web', '--port', '8081'], 'apps/passenger', { BROWSER: 'none' });
run('driver', 'npx', ['expo', 'start', '--web', '--port', '8082'], 'apps/driver', { BROWSER: 'none' });
console.log(`
  RidesRus is starting:
    Passenger app   http://localhost:8081
    Driver console  http://localhost:8082
    Fleet HQ        http://localhost:3000   (admin@ridesrus.app / fleet-hq-demo)
    API             http://localhost:3005/health
`);
