import NetInfo from '@react-native-community/netinfo';
import { ApiError, DriverAction, DriverActionResult } from '@ridesrus/core';
import { api } from '../lib/api';
import { useConsole } from '../state/console';
import { useShift } from '../state/shift';
import type { ActionStore } from './store';
import { createSqliteStore } from './sqliteStore';

const BATCH = 50;
const RETRY_MS = 8_000;

let store: ActionStore | null = null;
let flushing = false;
let started = false;

async function getStore() {
  store ??= await createSqliteStore();
  return store;
}

async function publishCount() {
  useConsole.getState().setQueued(await (await getStore()).count());
}

/**
 * Offline-first outbox. Every driver tap is written to durable storage first
 * and the UI updates optimistically; this loop drains the queue to the API in
 * order whenever there's a connection. The server de-duplicates by
 * idempotency key, so retrying after a lost response is always safe.
 */
export async function enqueue(action: DriverAction) {
  await (await getStore()).push(action);
  await publishCount();
  void flush();
}

export async function flush(): Promise<void> {
  if (flushing || !useShift.getState().shift) return;
  flushing = true;
  try {
    const s = await getStore();
    for (;;) {
      const batch = await s.peek(BATCH);
      if (batch.length === 0) break;
      const results = await api.post<DriverActionResult[]>('/driver/actions', { actions: batch });
      // Every returned action was processed (ok or rejected by a business rule); drop them all.
      await s.remove(results.map((r) => r.idempotencyKey));
      const rejected = results.filter((r) => !r.ok && !r.replayed);
      if (rejected.length) useConsole.getState().flash(`Sync note: ${rejected[0].error}`);
      await publishCount();
    }
    useConsole.getState().clearOptimistic();
    useConsole.getState().setSyncError(null);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await (await getStore()).clear(); // shift is over; these actions can't apply any more
      await publishCount();
    } else {
      useConsole.getState().setSyncError(err instanceof ApiError && err.isNetwork ? 'offline' : 'error');
    }
  } finally {
    flushing = false;
  }
}

/** Starts background syncing: on reconnect and on a timer as a safety net. */
export function startOutbox() {
  if (started) return;
  started = true;
  void publishCount();
  NetInfo.addEventListener((state) => {
    useConsole.getState().setNetwork(!!state.isConnected);
    if (state.isConnected) void flush();
  });
  setInterval(() => void flush(), RETRY_MS);
}
