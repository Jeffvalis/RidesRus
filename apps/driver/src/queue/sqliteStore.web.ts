import type { DriverAction } from '@ridesrus/core';
import type { ActionStore } from './store';

const KEY = 'ridesrus.driver.queue.v3';

/** Browser demo: localStorage stands in for SQLite with the same FIFO semantics. */
export async function createSqliteStore(): Promise<ActionStore> {
  const read = (): DriverAction[] => {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as DriverAction[];
    } catch {
      return [];
    }
  };
  const write = (xs: DriverAction[]) => {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(xs));
    } catch {
      // storage blocked; queue lives for this page only
    }
  };
  let memory = read();
  return {
    async push(action) {
      if (!memory.some((a) => a.idempotencyKey === action.idempotencyKey)) memory.push(action);
      write(memory);
    },
    async peek(limit) {
      return memory.slice(0, limit);
    },
    async remove(keys) {
      const drop = new Set(keys);
      memory = memory.filter((a) => !drop.has(a.idempotencyKey));
      write(memory);
    },
    async clear() {
      memory = [];
      write(memory);
    },
    async count() {
      return memory.length;
    },
  };
}
