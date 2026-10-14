'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ActivityDTO, BusLiveDTO, ClientToServerEvents, ServerToClientEvents } from '@ridesrus/core';
import { API_URL, useSession } from './session';

/** Live fleet positions and the operations feed for Fleet HQ. */
export function useLiveOps() {
  const { session, api } = useSession();
  const [buses, setBuses] = useState<BusLiveDTO[]>([]);
  const [activity, setActivity] = useState<ActivityDTO[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.get<ActivityDTO[]>('/admin/activity').then(setActivity).catch(() => undefined);
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      auth: { token: session.token },
      transports: ['websocket'],
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('fleet:update', ({ buses }) => setBuses(buses));
    socket.on('activity', (e) => setActivity((prev) => [e, ...prev].slice(0, 200)));
    return () => {
      socket.disconnect();
    };
  }, [session, api]);

  return { buses, activity, connected };
}

/** Re-fetch on an interval (KPIs, tables). */
export function usePolling<T>(path: string, intervalMs = 10_000) {
  const { api } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .get<T>(path)
        .then((d) => !cancelled && (setData(d), setError(null)))
        .catch((e: Error) => !cancelled && setError(e.message));
    void load();
    const t = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [api, path, intervalMs, tick]);

  return { data, error, reload: () => setTick((n) => n + 1) };
}
