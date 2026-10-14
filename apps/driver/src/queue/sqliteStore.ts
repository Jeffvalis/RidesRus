import * as SQLite from 'expo-sqlite';
import type { DriverAction } from '@ridesrus/core';
import type { ActionStore } from './store';

/**
 * Tablet storage: SQLite survives app kills, reboots and battery pulls, which
 * matters on a bus — an acknowledged hail or a "stop reached" tap must never
 * vanish because the tablet lost power in a dead zone on the Lekki-Epe Expressway.
 */
export async function createSqliteStore(): Promise<ActionStore> {
  const db = await SQLite.openDatabaseAsync('driver-queue.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS actions (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL
    );
  `);
  return {
    async push(action) {
      await db.runAsync('INSERT OR IGNORE INTO actions (key, body) VALUES (?, ?)', action.idempotencyKey, JSON.stringify(action));
    },
    async peek(limit) {
      const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM actions ORDER BY seq ASC LIMIT ?', limit);
      return rows.map((r) => JSON.parse(r.body) as DriverAction);
    },
    async remove(keys) {
      if (keys.length === 0) return;
      await db.runAsync(`DELETE FROM actions WHERE key IN (${keys.map(() => '?').join(',')})`, ...keys);
    },
    async clear() {
      await db.runAsync('DELETE FROM actions');
    },
    async count() {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM actions');
      return row?.n ?? 0;
    },
  };
}
