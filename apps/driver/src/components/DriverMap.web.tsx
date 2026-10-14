import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { brand } from '@ridesrus/core';
import type { DriverMapProps } from './DriverMap.types';

const CSS = `
.leaflet-container img.leaflet-tile { mix-blend-mode: normal !important; } /* plus-lighter + filter draws seams */
.rr-drv-bus { width: 46px; height: 46px; border-radius: 50%; background: ${brand.yellow}; border: 4px solid #fff; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
.rr-drv-bus span { display:block; width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent; border-bottom:16px solid ${brand.ink}; }
.rr-drv-icon { transition: transform 1s linear; }
.leaflet-zoom-anim .rr-drv-icon { transition: none; }
.rr-drv-stop { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid ${brand.olive}; }
.rr-drv-stop.pick { width: 22px; height: 22px; background: ${brand.yellow}; border-color: ${brand.ink}; }
.rr-drv-stop.drop { width: 22px; height: 22px; background: ${brand.blue}; border-color: #fff; }
.leaflet-tooltip.rr-drv-tip { background:#fff; border:0; border-radius:8px; font:800 12px system-ui,sans-serif; color:${brand.ink}; box-shadow:0 2px 8px rgba(0,0,0,.2); }
`;

/** OpenStreetMap tiles; night mode is the same tiles inverted, so no second provider is needed. */
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const NIGHT_FILTER = 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.4)';

export default function DriverMap({ route, bus, pickupStopIds, dropoffStopIds, night }: DriverMapProps) {
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const busMarker = useRef<L.Marker | null>(null);
  const stops = useRef(new Map<string, L.Marker>());
  const follow = useRef(true);

  useEffect(() => {
    if (!document.getElementById('rr-drv-css')) {
      const el = document.createElement('style');
      el.id = 'rr-drv-css';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    const el = host.current as unknown as HTMLElement;
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([6.44, 3.49], 15);
    m.on('dragstart', () => (follow.current = false));
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      tiles.current = null;
      busMarker.current = null;
      stops.current.clear();
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!tiles.current) tiles.current = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    const pane = m.getPane('tilePane');
    if (pane) pane.style.filter = night ? NIGHT_FILTER : 'none';
  }, [night]);

  useEffect(() => {
    const m = map.current;
    if (!m || !route) return;
    if (stops.current.size === 0) {
      L.polyline(route.path.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color: night ? brand.yellow : brand.olive, weight: 6, opacity: 0.8 }).addTo(m);
    }
    const pick = new Set(pickupStopIds);
    const drop = new Set(dropoffStopIds);
    for (const s of route.stops) {
      const cls = pick.has(s.id) ? 'rr-drv-stop pick' : drop.has(s.id) ? 'rr-drv-stop drop' : 'rr-drv-stop';
      const icon = L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      const existing = stops.current.get(s.id);
      if (existing) existing.setIcon(icon);
      else
        stops.current.set(
          s.id,
          L.marker([s.lat, s.lng], { icon, keyboard: false }).bindTooltip(s.name, { permanent: false, direction: 'top', className: 'rr-drv-tip' }).addTo(m),
        );
    }
  }, [route, pickupStopIds, dropoffStopIds, night]);

  useEffect(() => {
    const m = map.current;
    if (!m || !bus) return;
    const icon = L.divIcon({
      className: 'rr-drv-icon',
      html: `<div class="rr-drv-bus" style="transform:rotate(${bus.heading}deg)"><span></span></div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });
    if (busMarker.current) {
      busMarker.current.setLatLng([bus.lat, bus.lng]);
      busMarker.current.setIcon(icon);
    } else busMarker.current = L.marker([bus.lat, bus.lng], { icon, zIndexOffset: 1000, keyboard: false }).addTo(m);
    if (follow.current) m.panTo([bus.lat, bus.lng], { animate: true, duration: 1 });
  }, [bus?.lat, bus?.lng, bus?.heading]);

  return (
    <View style={{ flex: 1 }}>
      <View ref={host} style={{ flex: 1 }} />
      {/* "Recenter" restores follow mode after the driver pans away. */}
      <Pressable
        onPress={() => {
          follow.current = true;
          if (bus) map.current?.panTo([bus.lat, bus.lng]);
        }}
        accessibilityRole="button"
        accessibilityLabel="Recenter on bus"
        style={{ position: 'absolute', right: 16, top: 16, width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      >
        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: brand.ink }} />
      </Pressable>
    </View>
  );
}
