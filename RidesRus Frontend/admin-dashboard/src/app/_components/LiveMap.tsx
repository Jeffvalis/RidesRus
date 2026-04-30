'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type BusStat = {
  id: string;
  driverName: string;
  plateNumber: string;
  availableSeats: number;
  capacity: number;
  lat: number;
  lng: number;
};

// Animates markers when coordinates change
function AnimatedMarker({ bus }: { bus: BusStat }) {
  const color = bus.availableSeats === 0 ? '#ef4444'
    : bus.availableSeats / bus.capacity < 0.4 ? '#f59e0b'
    : '#a3e635';

  return (
    <CircleMarker
      center={[bus.lat, bus.lng]}
      radius={14}
      pathOptions={{ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2 }}
    >
      <Popup>
        <div style={{ fontFamily: 'sans-serif', minWidth: 140 }}>
          <strong style={{ fontSize: 13 }}>{bus.plateNumber}</strong><br />
          <span style={{ color: '#555', fontSize: 12 }}>{bus.driverName}</span><br />
          <span style={{ fontSize: 12, fontWeight: 700, color: color }}>
            {bus.availableSeats} / {bus.capacity} seats
          </span>
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function LiveMap({ buses }: { buses: BusStat[] }) {
  return (
    <MapContainer
      center={[6.4550, 3.5820]}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      {/* Lagos Island / Lekki user center dot */}
      <CircleMarker
        center={[6.4550, 3.5820]}
        radius={8}
        pathOptions={{ fillColor: '#3b82f6', fillOpacity: 1, color: '#fff', weight: 3 }}
      />
      {buses.map(bus => (
        <AnimatedMarker key={bus.id} bus={bus} />
      ))}
    </MapContainer>
  );
}
