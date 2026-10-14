import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ActiveJourneyDTO,
  ClientToServerEvents,
  RouteDTO,
  ServerToClientEvents,
  WalletDTO,
} from '@ridesrus/core';
import { API_URL, api } from '../lib/api';
import { ClientConfig, useLive } from './live';
import { useSession } from './session';

type RiderSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Keeps the live store in sync with the server for the signed-in rider:
 * one socket for fleet positions and personal journey events, plus a REST
 * refresh on every (re)connect so nothing missed while offline is lost.
 */
export function useLiveConnection() {
  const token = useSession((s) => s.session?.token);

  useEffect(() => {
    if (!token) return;
    const live = useLive.getState();
    let disposed = false;

    const refresh = async () => {
      const [config, routes, journey, wallet] = await Promise.all([
        api.get<ClientConfig>('/config'),
        api.get<RouteDTO[]>('/routes'),
        api.get<ActiveJourneyDTO>('/me/journey'),
        api.get<WalletDTO>('/wallet'),
      ]);
      if (disposed) return;
      live.setConfig(config);
      if (routes[0]) live.setRoute(routes[0]);
      live.setHail(journey.hail);
      live.setTrip(journey.trip);
      live.setBalance(wallet.balanceKobo);
    };

    const socket: RiderSocket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 5_000 });
    socket.on('connect', () => {
      live.setConnected(true);
      refresh().catch(() => undefined);
    });
    socket.on('disconnect', () => live.setConnected(false));
    socket.on('fleet:update', ({ buses }) => live.setBuses(buses));
    socket.on('hail:updated', (hail) => live.setHail(hail));
    socket.on('trip:updated', (trip) => {
      const current = useLive.getState().trip;
      // A rated or voided trip leaves the active view.
      if (trip.status === 'VOIDED' || (trip.status === 'COMPLETED' && trip.rating !== null)) {
        if (!current || current.id === trip.id) live.setTrip(null);
      } else live.setTrip(trip);
    });
    socket.on('wallet:updated', ({ balanceKobo }) => live.setBalance(balanceKobo));

    refresh().catch(() => undefined);

    return () => {
      disposed = true;
      socket.disconnect();
      live.reset();
    };
  }, [token]);
}
