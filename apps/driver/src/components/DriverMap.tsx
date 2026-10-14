import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { brand } from '@ridesrus/core';
import type { DriverMapProps } from './DriverMap.types';

/** Native console map; follows the bus. */
export default function DriverMap({ route, bus, pickupStopIds, dropoffStopIds, night }: DriverMapProps) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (bus) ref.current?.animateCamera({ center: { latitude: bus.lat, longitude: bus.lng }, zoom: 16 }, { duration: 900 });
  }, [bus?.lat, bus?.lng]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      userInterfaceStyle={night ? 'dark' : 'light'}
      initialRegion={{ latitude: 6.44, longitude: 3.49, latitudeDelta: 0.03, longitudeDelta: 0.04 }}
      toolbarEnabled={false}
    >
      {route && (
        <Polyline coordinates={route.path.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={night ? brand.yellow : brand.olive} strokeWidth={6} />
      )}
      {route?.stops.map((s) => {
        const pick = pickupStopIds.includes(s.id);
        const drop = dropoffStopIds.includes(s.id);
        return (
          <Marker key={s.id} coordinate={{ latitude: s.lat, longitude: s.lng }} title={s.name} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.stop, pick && styles.pick, drop && styles.drop]} />
          </Marker>
        );
      })}
      {bus && (
        <Marker coordinate={{ latitude: bus.lat, longitude: bus.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={bus.heading}>
          <View style={styles.bus}>
            <View style={styles.arrow} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  stop: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 3, borderColor: brand.olive },
  pick: { width: 22, height: 22, borderRadius: 11, backgroundColor: brand.yellow, borderColor: brand.ink },
  drop: { width: 22, height: 22, borderRadius: 11, backgroundColor: brand.blue, borderColor: '#fff' },
  bus: { width: 46, height: 46, borderRadius: 23, backgroundColor: brand.yellow, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: brand.ink },
});
