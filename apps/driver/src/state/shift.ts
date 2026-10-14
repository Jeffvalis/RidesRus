import { create } from 'zustand';
import { storage } from '../lib/storage';

const KEY = 'ridesrus.driver.shift.v3';

export type ShiftSession = {
  token: string;
  expiresAt: number;
  driver: { id: string; code: string; name: string };
  bus: { id: string; code: string; plate: string };
};

type ShiftState = {
  status: 'loading' | 'off' | 'on';
  shift: ShiftSession | null;
  hydrate: () => Promise<void>;
  start: (s: ShiftSession) => Promise<void>;
  end: () => Promise<void>;
};

/** The tablet's signed-in shift. Survives app restarts until the 12-hour shift expires. */
export const useShift = create<ShiftState>((set) => ({
  status: 'loading',
  shift: null,
  async hydrate() {
    const raw = await storage.get(KEY);
    const saved = raw ? (JSON.parse(raw) as ShiftSession) : null;
    set(saved && saved.expiresAt > Date.now() ? { status: 'on', shift: saved } : { status: 'off', shift: null });
  },
  async start(shift) {
    await storage.set(KEY, JSON.stringify(shift));
    set({ status: 'on', shift });
  },
  async end() {
    await storage.remove(KEY);
    set({ status: 'off', shift: null });
  },
}));
