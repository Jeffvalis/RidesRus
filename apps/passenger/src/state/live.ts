import { create } from 'zustand';
import type { BusLiveDTO, HailDTO, Kobo, LatLng, RouteDTO, TripDTO } from '@ridesrus/core';

export type ClientConfig = { demoMode: boolean; payments: 'sandbox' | 'flutterwave' };

/** Where the rider is standing. In the demo (or far from Lagos) it's a chosen stop. */
export type RiderPosition = { point: LatLng; stopId: string; source: 'gps' | 'default' | 'chosen' };

type LiveState = {
  connected: boolean;
  config: ClientConfig | null;
  route: RouteDTO | null;
  buses: Record<string, BusLiveDTO>;
  hail: HailDTO | null;
  trip: TripDTO | null;
  balanceKobo: Kobo | null;
  selectedBusId: string | null;
  rider: RiderPosition | null;

  setConnected: (v: boolean) => void;
  setConfig: (c: ClientConfig) => void;
  setRoute: (r: RouteDTO) => void;
  setBuses: (b: BusLiveDTO[]) => void;
  setHail: (h: HailDTO | null) => void;
  setTrip: (t: TripDTO | null) => void;
  setBalance: (k: Kobo) => void;
  selectBus: (id: string | null) => void;
  setRider: (r: RiderPosition) => void;
  reset: () => void;
};

const initial = {
  connected: false,
  hail: null,
  trip: null,
  balanceKobo: null,
  selectedBusId: null,
};

export const useLive = create<LiveState>((set) => ({
  ...initial,
  config: null,
  route: null,
  buses: {},
  rider: null,

  setConnected: (connected) => set({ connected }),
  setConfig: (config) => set({ config }),
  setRoute: (route) => set({ route }),
  setBuses: (list) => set({ buses: Object.fromEntries(list.map((b) => [b.id, b])) }),
  // Only active hails matter to the UI; resolved ones fall away.
  setHail: (hail) => set({ hail: hail && (hail.status === 'PENDING' || hail.status === 'ACKNOWLEDGED') ? hail : null }),
  setTrip: (trip) => set({ trip }),
  setBalance: (balanceKobo) => set({ balanceKobo }),
  selectBus: (selectedBusId) => set({ selectedBusId }),
  setRider: (rider) => set({ rider }),
  reset: () => set(initial),
}));

export const stopName = (route: RouteDTO | null, stopId: string | null | undefined) =>
  route?.stops.find((s) => s.id === stopId)?.name ?? '';
