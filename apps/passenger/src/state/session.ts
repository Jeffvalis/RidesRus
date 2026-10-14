import { create } from 'zustand';
import type { AuthResponse, PassengerDTO } from '@ridesrus/core';
import { storage } from '../lib/storage';

const KEY = 'ridesrus.session.v3';

type Session = { token: string; expiresAt: number; passenger: PassengerDTO };

type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  hydrate: () => Promise<void>;
  signIn: (res: AuthResponse<{ passenger: PassengerDTO }>) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  session: null,

  async hydrate() {
    const raw = await storage.get(KEY);
    const saved = raw ? (JSON.parse(raw) as Session) : null;
    if (saved && saved.expiresAt > Date.now()) set({ status: 'signedIn', session: saved });
    else set({ status: 'signedOut', session: null });
  },

  async signIn(res) {
    const session = { token: res.token, expiresAt: res.expiresAt, passenger: res.passenger };
    await storage.set(KEY, JSON.stringify(session));
    set({ status: 'signedIn', session });
  },

  async signOut() {
    await storage.remove(KEY);
    set({ status: 'signedOut', session: null });
  },
}));
