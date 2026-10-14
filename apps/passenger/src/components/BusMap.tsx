import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { bandColors, brand } from '@ridesrus/core';
import { fonts } from '../theme';
import type { BusMapProps } from './BusMap.types';

/** Native map: Apple Maps on iOS, Google Maps on Android (key in app.config.ts). */
export default function BusMap(props: BusMapProps) {
  const ref = useRef<MapView>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!props.route || fitted.current) return;
    fitted.current = true;
    setTimeout(
      () =>
        ref.current?.fitToCoordinates(
          props.route!.path.map((p) => ({ latitude: p.lat, longitude: p.lng })),
          { edgePadding: { top: 100, left: 30, right: 30, bottom: props.bottomInset + 30 }, animated: false },
        ),
      50,
    );
  }, [props.route, props.bottomInset]);

  // Frame the rider and the bus they care about (selected, hailed or riding).
  const frameBusId = props.focusBusId ?? props.selectedBusId;
  const frameBus = props.buses.find((b) => b.id === frameBusId);
  useEffect(() => {
    if (!frameBus || !props.rider) return;
    ref.current?.fitToCoordinates(
      [
        { latitude: props.rider.lat, longitude: props.rider.lng },
        { latitude: frameBus.lat, longitude: frameBus.lng },
      ],
      { edgePadding: { top: 120, left: 50, right: 50, bottom: props.bottomInset + 50 }, animated: true },
    );
    // Reframe when the focus changes, not on every position tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameBusId, props.bottomInset]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: 6.445, longitude: 3.49, latitudeDelta: 0.08, longitudeDelta: 0.12 }}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
    >
      {props.route && (
        <Polyline
          coordinates={props.route.path.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={brand.olive}
          strokeWidth={5}
        />
      )}
      {props.route?.stops.map((s) => {
        const drop = s.id === props.dropoffStopId;
        const mine = s.id === props.riderStopId;
        return (
          <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} title={s.name} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.stop, mine && styles.stopMine, drop && styles.stopDrop]} />
          </Marker>
        );
      })}
      {props.rider && (
        <Marker coordinate={{ latitude: props.rider.lat, longitude: props.rider.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.rider} accessibilityLabel="You are here" />
        </Marker>
      )}
      {props.buses.map((bus) => {
        const c = bandColors[bus.band];
        const selected = bus.id === props.selectedBusId;
        const focus = bus.id === props.focusBusId;
        const dim = !!props.focusBusId && !focus;
        const free = bus.capacity - bus.occupied;
        return (
          <Marker
            key={bus.id}
            coordinate={{ latitude: bus.lat, longitude: bus.lng }}
            anchor={{ x: 0.5, y: 0.35 }}
            onPress={() => props.onSelectBus(bus.id)}
            zIndex={selected || focus ? 10 : 1}
            accessibilityLabel={`${bus.code}, ${free} seats free`}
          >
            <View style={[styles.bus, { opacity: dim ? 0.45 : 1 }]}>
              <View
                style={[
                  styles.busBody,
                  { backgroundColor: c.fill, borderColor: bus.band === 'EMPTY' ? brand.ink : '#fff' },
                  selected && styles.busSelected,
                  focus && styles.busFocus,
                ]}
              >
                <Ionicons name="bus" size={18} color={c.ink} />
              </View>
              <Text style={styles.busLabel}>{bus.band === 'FULL' ? `${bus.code} · Full` : `${bus.code} · ${free}`}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: brand.olive },
  stopMine: { width: 16, height: 16, borderRadius: 8, borderColor: brand.blue },
  stopDrop: { width: 18, height: 18, borderRadius: 9, backgroundColor: brand.yellow, borderColor: brand.ink },
  rider: { width: 18, height: 18, borderRadius: 9, backgroundColor: brand.blue, borderWidth: 3, borderColor: '#fff' },
  bus: { alignItems: 'center', gap: 4 },
  busBody: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  busSelected: { transform: [{ scale: 1.15 }], borderColor: brand.yellow },
  busFocus: { borderColor: brand.blue },
  busLabel: { fontFamily: fonts.heavy, fontSize: 11, color: brand.ink, backgroundColor: '#fff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
});
