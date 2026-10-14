import type { DriverAction } from '@ridesrus/core';

/** Durable FIFO of driver actions waiting to reach the server. */
export interface ActionStore {
  push(action: DriverAction): Promise<void>;
  peek(limit: number): Promise<DriverAction[]>;
  remove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
