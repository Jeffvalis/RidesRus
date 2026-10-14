import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, DriverQrDTO, DriverStateDTO, LocationPing, RouteDTO, ServerToClientEvents } from '@ridesrus/core';
import { API_URL, api } from '../lib/api';
import { flush, startOutbox } from '../queue/outbox';
import { useConsole } from './console';
import { useShift } from './shift';

type DriverSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Wires the console to the server:
 *  - socket for pushed screen state (hails, boardings, drop-offs)
 *  - rotating boarding QR, refreshed at each window boundary
 *  - GPS from the tablet (native), sent over the socket with an HTTP fallback
 *  - the offline outbox
 */
export function useConsoleConnection() {
  const token = useShift((s) => s.shift?.token);
  const gps = useConsole((s) => s.gps);

  useEffect(() => {
    if (!token) return;
    const c = useConsole.getState();
    let disposed = false;
    let qrTimer: ReturnType<typeof setTimeout> | null = null;

    startOutbox();

    const loadState = () =>
      api.get<DriverStateDTO | null>('/driver/state').then((s) => s && !disposed && c.setServer(s)).catch(() => undefined);

    const loadQr = async () => {
      try {
        const qr = await api.get<DriverQrDTO>('/driver/qr');
        if (disposed) return;
        c.setQr(qr);
        qrTimer = setTimeout(loadQr, Math.max(1_000, qr.expiresAt - Date.now() + 250));
      } catch {
        qrTimer = setTimeout(loadQr, 5_000);
      }
    };

    api.get<{ demoMode: boolean }>('/config').then((cfg) => c.setDemoMode(cfg.demoMode)).catch(() => undefined);
    api.get<RouteDTO[]>('/routes').then((r) => r[0] && c.setRoute(r[0])).catch(() => undefined);
    void loadState();
    void loadQr();

    const socket: DriverSocket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 5_000 });
    socket.on('connect', () => {
      c.setSocketConnected(true);
      void loadState();
      void flush();
    });
    socket.on('disconnect', () => c.setSocketConnected(false));
    socket.on('driver:state', (s) => c.setServer(s));
    socketRef.current = socket;

    return () => {
      disposed = true;
      if (qrTimer) clearTimeout(qrTimer);
      socket.disconnect();
      socketRef.current = null;
      c.reset();
    };
  }, [token]);

  // GPS: only on a real device, only when switched on.
  useEffect(() => {
    if (!token || gps !== 'on' || Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | null = null;
    let latest: LocationPing | null = null;
    let cancelled = false;

    const send = (ping: LocationPing) => {
      const socket = socketRef.current;
      if (socket?.connected) socket.emit('driver:location', ping, () => undefined);
      else api.post('/driver/location', ping).catch(() => undefined); // only the latest fix matters
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return useConsole.getState().setGps('denied');
      if (cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3_000, distanceInterval: 5 },
        (pos) => {
          latest = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
            speedMps: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : null,
            accuracyM: pos.coords.accuracy ?? null,
            at: pos.timestamp,
          };
          send(latest);
        },
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [token, gps]);
}

const socketRef: { current: DriverSocket | null } = { current: null };
