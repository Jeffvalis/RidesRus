'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ApiClient } from '@ridesrus/core';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005').replace(/\/$/, '');
const KEY = 'ridesrus.admin.session.v3';

type Admin = { id: string; name: string; email: string };
type Session = { token: string; expiresAt: number; admin: Admin };

type Ctx = {
  session: Session | null;
  api: ApiClient;
  signIn: (s: Session) => void;
  signOut: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setSession(null);
    router.replace('/login');
  }, [router]);

  const signIn = useCallback(
    (s: Session) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {}
      setSession(s);
      router.replace('/');
    },
    [router],
  );

  const api = useMemo(
    () => new ApiClient({ baseUrl: API_URL, getToken: () => session?.token, onUnauthorized: signOut }),
    [session, signOut],
  );

  useEffect(() => {
    if (!ready) return;
    if (!session && pathname !== '/login') router.replace('/login');
  }, [ready, session, pathname, router]);

  if (!ready) return null;
  if (!session && pathname !== '/login') return null;
  return <SessionContext.Provider value={{ session, api, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
