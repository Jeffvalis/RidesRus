import { create } from 'zustand';
import type { DriverQrDTO, DriverStateDTO, RouteDTO } from '@ridesrus/core';

type ConsoleState = {
  /** Last screen state pushed by the server. */
  server: DriverStateDTO | null;
  route: RouteDTO | null;
  qr: DriverQrDTO | null;
  demoMode: boolean;
  socketConnected: boolean;
  network: boolean;
  queued: number;
  syncError: 'offline' | 'error' | null;
  /** Optimistic overlays applied until the outbox drains. */
  ackedHailIds: string[];
  arrivedStopIds: string[];
  message: { text: string; at: number } | null;
  night: boolean;
  gps: 'off' | 'on' | 'denied';

  setServer: (s: DriverStateDTO) => void;
  setRoute: (r: RouteDTO) => void;
  setQr: (q: DriverQrDTO) => void;
  setDemoMode: (v: boolean) => void;
  setSocketConnected: (v: boolean) => void;
  setNetwork: (v: boolean) => void;
  setQueued: (n: number) => void;
  setSyncError: (e: ConsoleState['syncError']) => void;
  markAcked: (ids: string[]) => void;
  markArrived: (stopId: string) => void;
  clearOptimistic: () => void;
  flash: (text: string) => void;
  setNight: (v: boolean) => void;
  setGps: (v: ConsoleState['gps']) => void;
  reset: () => void;
};

const isNightHour = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
};

export const useConsole = create<ConsoleState>((set) => ({
  server: null,
  route: null,
  qr: null,
  demoMode: false,
  socketConnected: false,
  network: true,
  queued: 0,
  syncError: null,
  ackedHailIds: [],
  arrivedStopIds: [],
  message: null,
  night: isNightHour(),
  gps: 'off',

  setServer: (server) => set({ server }),
  setRoute: (route) => set({ route }),
  setQr: (qr) => set({ qr }),
  setDemoMode: (demoMode) => set({ demoMode }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),
  setNetwork: (network) => set({ network }),
  setQueued: (queued) => set({ queued }),
  setSyncError: (syncError) => set({ syncError }),
  markAcked: (ids) => set((s) => ({ ackedHailIds: [...s.ackedHailIds, ...ids] })),
  markArrived: (id) => set((s) => ({ arrivedStopIds: [...s.arrivedStopIds, id] })),
  clearOptimistic: () => set({ ackedHailIds: [], arrivedStopIds: [] }),
  flash: (text) => set({ message: { text, at: Date.now() } }),
  setNight: (night) => set({ night }),
  setGps: (gps) => set({ gps }),
  reset: () => set({ server: null, qr: null, ackedHailIds: [], arrivedStopIds: [], queued: 0, syncError: null }),
}));

/** Server state with not-yet-synced driver actions applied, so taps feel instant offline. */
export function useEffectiveState(): DriverStateDTO | null {
  const server = useConsole((s) => s.server);
  const acked = useConsole((s) => s.ackedHailIds);
  const arrived = useConsole((s) => s.arrivedStopIds);
  if (!server) return null;
  if (acked.length === 0 && arrived.length === 0) return server;
  const ack = new Set(acked);
  const gone = new Set(arrived);
  const alighting = server.dropoffs.filter((d) => gone.has(d.stopId)).reduce((n, d) => n + d.count, 0);
  return {
    ...server,
    occupied: Math.max(0, server.occupied - alighting),
    pickups: server.pickups.map((p) => (p.hailIds.every((id) => ack.has(id)) ? { ...p, acknowledged: true } : p)),
    dropoffs: server.dropoffs.filter((d) => !gone.has(d.stopId)),
  };
}
