import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BusLiveDTO, bandColors, brand } from '@ridesrus/core';
import type { BusMapProps } from './BusMap.types';

const BUS_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.5-6H6V6h12v5z"/></svg>';

/** OpenStreetMap's public tiles suit a pilot/demo; point EXPO_PUBLIC_MAP_TILES_URL at a paid provider for production load. */
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const CSS = `
[data-rr-map] .leaflet-tile-pane { filter: saturate(0.55) sepia(0.12) brightness(1.03); }
.rr-bus-icon { transition: transform 1s linear; }
.leaflet-zoom-anim .rr-bus-icon { transition: none; }
.rr-bus { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; }
.rr-bus-body { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; border: 2.5px solid; box-shadow: 0 6px 16px rgba(0,0,0,.18); transition: transform .15s ease; }
.rr-bus:hover .rr-bus-body { transform: scale(1.06); }
.rr-bus.selected .rr-bus-body { transform: scale(1.18); box-shadow: 0 0 0 5px rgba(250,204,21,.55), 0 8px 18px rgba(0,0,0,.25); }
.rr-bus.focus .rr-bus-body { box-shadow: 0 0 0 5px rgba(47,79,201,.45), 0 8px 18px rgba(0,0,0,.25); }
.rr-bus.dim { opacity: .45; }
.rr-bus-label { font: 800 11px/1 'PlusJakartaSans_800ExtraBold', system-ui, sans-serif; padding: 4px 7px; border-radius: 99px; background: #fff; color: ${brand.ink}; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
.rr-rider { width: 18px; height: 18px; border-radius: 50%; background: ${brand.blue}; border: 3px solid #fff; box-shadow: 0 0 0 0 rgba(47,79,201,.5); animation: rr-pulse 2s infinite; }
@keyframes rr-pulse { 0% { box-shadow: 0 0 0 0 rgba(47,79,201,.45); } 70% { box-shadow: 0 0 0 14px rgba(47,79,201,0); } 100% { box-shadow: 0 0 0 0 rgba(47,79,201,0); } }
.rr-stop { width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 3px solid ${brand.olive}; }
.rr-stop.mine { width: 16px; height: 16px; border-color: ${brand.blue}; }
.rr-stop.drop { width: 18px; height: 18px; background: ${brand.yellow}; border-color: ${brand.ink}; }
.leaflet-container { background: ${brand.cream}; font-family: system-ui, sans-serif; }
.leaflet-tooltip.rr-stop-tip { background: #fff; border: 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.12); font: 700 11px system-ui, sans-serif; color: ${brand.ink}; padding: 4px 8px; }
`;

function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('rr-map-css')) return;
  const el = document.createElement('style');
  el.id = 'rr-map-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

function busHtml(bus: BusLiveDTO, state: { selected: boolean; focus: boolean; dim: boolean }) {
  const c = bandColors[bus.band];
  const free = bus.capacity - bus.occupied;
  const cls = ['rr-bus', state.selected && 'selected', state.focus && 'focus', state.dim && 'dim'].filter(Boolean).join(' ');
  const label = bus.band === 'FULL' ? `${bus.code} · Full` : `${bus.code} · ${free}`;
  return `<div class="${cls}" role="button" aria-label="${bus.code}, ${c.label.toLowerCase()}, ${free} seats free">
    <div class="rr-bus-body" style="background:${c.fill};color:${c.ink};border-color:${bus.band === 'EMPTY' ? brand.ink : '#fff'}">${BUS_SVG}</div>
    <div class="rr-bus-label">${label}</div></div>`;
}

export default function BusMap(props: BusMapProps) {
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ route?: L.Polyline; stops: Map<string, L.Marker>; buses: Map<string, L.Marker>; rider?: L.Marker }>({
    stops: new Map(),
    buses: new Map(),
  });
  const userMoved = useRef(false);
  const onSelect = useRef(props.onSelectBus);
  onSelect.current = props.onSelectBus;

  // Create the map once.
  useEffect(() => {
    injectCss();
    const el = host.current as unknown as HTMLElement;
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([6.445, 3.49], 13);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    m.on('dragstart zoomstart', (e: L.LeafletEvent) => {
      if ((e as L.LeafletEvent & { originalEvent?: Event }).originalEvent) userMoved.current = true;
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layers.current = { stops: new Map(), buses: new Map() };
    };
  }, []);

  // Route line and stops.
  useEffect(() => {
    const m = map.current;
    if (!m || !props.route) return;
    const l = layers.current;
    if (!l.route) {
      l.route = L.polyline(props.route.path.map((p) => [p.lat, p.lng] as L.LatLngTuple), {
        color: brand.olive,
        weight: 5,
        opacity: 0.75,
        lineCap: 'round',
      }).addTo(m);
    }
    if (!userMoved.current && !props.focusBusId && !props.selectedBusId) {
      m.fitBounds(l.route.getBounds(), { paddingTopLeft: [24, 90], paddingBottomRight: [24, props.bottomInset + 24] });
    }
    for (const stop of props.route.stops) {
      const cls = stop.id === props.dropoffStopId ? 'rr-stop drop' : stop.id === props.riderStopId ? 'rr-stop mine' : 'rr-stop';
      const icon = L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
      const existing = l.stops.get(stop.id);
      if (existing) existing.setIcon(icon);
      else {
        const marker = L.marker([stop.lat, stop.lng], { icon, keyboard: false, zIndexOffset: -100 })
          .bindTooltip(stop.name, { direction: 'top', offset: [0, -8], className: 'rr-stop-tip' })
          .addTo(m);
        l.stops.set(stop.id, marker);
      }
    }
  }, [props.route, props.riderStopId, props.dropoffStopId, props.bottomInset, props.focusBusId, props.selectedBusId]);

  // Buses.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const l = layers.current;
    const seen = new Set<string>();
    for (const bus of props.buses) {
      seen.add(bus.id);
      const html = busHtml(bus, {
        selected: bus.id === props.selectedBusId,
        focus: bus.id === props.focusBusId,
        dim: !!props.focusBusId && bus.id !== props.focusBusId,
      });
      const icon = L.divIcon({ className: 'rr-bus-icon', html, iconSize: [80, 64], iconAnchor: [40, 20] });
      const existing = l.buses.get(bus.id);
      if (existing) {
        existing.setLatLng([bus.lat, bus.lng]);
        if ((existing.options.icon as L.DivIcon).options.html !== html) existing.setIcon(icon);
        existing.setZIndexOffset(bus.id === props.selectedBusId || bus.id === props.focusBusId ? 1000 : 0);
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon, title: bus.code }).addTo(m);
        marker.on('click', () => onSelect.current(bus.id));
        l.buses.set(bus.id, marker);
      }
    }
    for (const [id, marker] of l.buses) {
      if (!seen.has(id)) {
        marker.remove();
        l.buses.delete(id);
      }
    }
  }, [props.buses, props.selectedBusId, props.focusBusId]);

  // Frame the rider and the bus they care about (selected, hailed or riding).
  const frameBusId = props.focusBusId ?? props.selectedBusId;
  const framedFor = useRef<string | null>(null);
  useEffect(() => {
    const m = map.current;
    const bus = props.buses.find((b) => b.id === frameBusId);
    if (!m || !bus || !props.rider) return;
    const newFocus = framedFor.current !== frameBusId;
    if (newFocus) userMoved.current = false; // new focus → reframe once
    framedFor.current = frameBusId;
    if (userMoved.current) return;
    // Otherwise only reframe when the bus drifts out of view, so the map isn't constantly moving.
    if (!newFocus && m.getBounds().pad(-0.1).contains([bus.lat, bus.lng])) return;
    m.fitBounds(L.latLngBounds([props.rider.lat, props.rider.lng], [bus.lat, bus.lng]), {
      paddingTopLeft: [48, 110],
      paddingBottomRight: [48, props.bottomInset + 48],
      maxZoom: 15,
      animate: true,
    });
  }, [frameBusId, props.buses, props.rider, props.bottomInset]);

  // Rider.
  useEffect(() => {
    const m = map.current;
    if (!m || !props.rider) return;
    const l = layers.current;
    const ll: L.LatLngTuple = [props.rider.lat, props.rider.lng];
    if (l.rider) l.rider.setLatLng(ll);
    else {
      l.rider = L.marker(ll, {
        icon: L.divIcon({ className: '', html: '<div class="rr-rider" aria-label="You are here"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 500,
        keyboard: false,
      }).addTo(m);
    }
  }, [props.rider]);

  return <View ref={host} style={{ flex: 1 }} {...({ dataSet: { rrMap: '1' } } as object)} />;
}
