import { useEffect } from 'react';
import * as Location from 'expo-location';
import { RouteGeometry } from '@ridesrus/core';
import { useLive } from './live';

/** GPS is only useful if you're actually near the corridor; otherwise riders pick a stop. */
const NEAR_ROUTE_M = 2_000;
const DEFAULT_STOP = 'stop_lekki_phase1';

/**
 * Works out where the rider is standing.
 * - Near the route with location permission → live GPS, snapped to the nearest stop.
 * - Anywhere else (including every demo visitor outside Lagos) → Lekki Phase 1 by
 *   default, or whichever stop they pick, so the full flow still works.
 */
export function useRiderLocation() {
  const route = useLive((s) => s.route);

  useEffect(() => {
    if (!route) return;
    const geometry = new RouteGeometry({ stops: route.stops, path: route.path, avgSpeedMps: 1 });
    const chooseDefault = () => {
      if (useLive.getState().rider) return;
      const stop = route.stops.find((s) => s.id === DEFAULT_STOP) ?? route.stops[0];
      useLive.getState().setRider({ point: { lat: stop.lat, lng: stop.lng }, stopId: stop.id, source: 'default' });
    };

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return chooseDefault();
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25 }, (pos) => {
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const nearest = geometry.nearestStop(point);
          const current = useLive.getState().rider;
          if (nearest.metres > NEAR_ROUTE_M) {
            if (!current) chooseDefault();
            return;
          }
          if (current?.source === 'chosen') return; // an explicit choice beats GPS
          useLive.getState().setRider({ point, stopId: nearest.stopId, source: 'gps' });
        });
      } catch {
        chooseDefault();
      }
    })();
    const fallback = setTimeout(chooseDefault, 4_000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      sub?.remove();
    };
  }, [route]);
}

export function chooseStop(stopId: string) {
  const { route, setRider } = useLive.getState();
  const stop = route?.stops.find((s) => s.id === stopId);
  if (stop) setRider({ point: { lat: stop.lat, lng: stop.lng }, stopId, source: 'chosen' });
}
