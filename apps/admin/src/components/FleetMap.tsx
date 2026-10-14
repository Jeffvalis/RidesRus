'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BusLiveDTO, RouteDTO, bandColors, brand } from '@ridesrus/core';

/** OpenStreetMap tiles inverted into a dark ops basemap; override with NEXT_PUBLIC_MAP_TILES_URL. */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function busIcon(bus: BusLiveDTO, alert: boolean) {
  const c = bandColors[bus.band];
  const ring = alert ? '#f05252' : bus.band === 'EMPTY' ? '#1a1a1a' : '#0f1012';
  return L.divIcon({
    className: '',
    iconSize: [86, 40],
    iconAnchor: [43, 20],
    html: `<div style="display:flex;align-items:center;gap:6px;padding:5px 9px 5px 5px;border-radius:999px;background:#17191c;border:2px solid ${ring};box-shadow:0 6px 16px rgba(0,0,0,.4);${alert ? 'animation:pulse 1s infinite' : ''}">
      <span style="width:24px;height:24px;border-radius:50%;background:${c.fill};border:2px solid ${bus.band === 'EMPTY' ? '#1a1a1a' : '#fff'};display:block"></span>
      <span style="font:800 12px system-ui,sans-serif;color:#f2f0ea">${bus.code.replace('RR-', '')}<span style="color:#8f8b83;font-weight:700"> ${bus.occupied}/${bus.capacity}</span></span></div>`,
  });
}

function Fit({ route }: { route: RouteDTO }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds(route.path.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [30, 30] });
  }, [map, route]);
  return null;
}

export default function FleetMap({ route, buses, alertBusCodes }: { route: RouteDTO | null; buses: BusLiveDTO[]; alertBusCodes: string[] }) {
  return (
    <MapContainer center={[6.445, 3.49]} zoom={13} className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer url={TILE_URL} attribution="&copy; OpenStreetMap contributors" className="rr-dark-tiles" />
      {route && (
        <>
          <Fit route={route} />
          <Polyline positions={route.path.map((p) => [p.lat, p.lng] as L.LatLngTuple)} pathOptions={{ color: brand.yellow, weight: 4, opacity: 0.6 }} />
          {route.stops.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={L.divIcon({ className: '', iconSize: [12, 12], iconAnchor: [6, 6], html: '<div style="width:12px;height:12px;border-radius:50%;background:#0f1012;border:3px solid #facc15"></div>' })}
            >
              <Tooltip direction="top" className="rr-tip">
                {s.name}
              </Tooltip>
            </Marker>
          ))}
        </>
      )}
      {buses.map((b) => (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={busIcon(b, alertBusCodes.includes(b.code))} zIndexOffset={alertBusCodes.includes(b.code) ? 1000 : 0}>
          <Tooltip direction="top" className="rr-tip">
            {b.code} · {b.plate} · {b.direction === 'EASTBOUND' ? '→ Ajah' : '→ VI'} · {b.source === 'GPS' ? 'live GPS' : 'autopilot'}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
