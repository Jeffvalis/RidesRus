import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNaira } from '@ridesrus/core';
import BusMap from '../../src/components/BusMap';
import { BandDot, Row } from '../../src/components/ui';
import { JourneySheet } from '../../src/features/JourneySheet';
import { useLive } from '../../src/state/live';
import { colors, fonts, radius, shadow } from '../../src/theme';

/** Ride: live map on top, the journey sheet below. */
export default function Ride() {
  const insets = useSafeAreaInsets();
  const route = useLive((s) => s.route);
  const busMap = useLive((s) => s.buses);
  const rider = useLive((s) => s.rider);
  const hail = useLive((s) => s.hail);
  const trip = useLive((s) => s.trip);
  const selectedBusId = useLive((s) => s.selectedBusId);
  const selectBus = useLive((s) => s.selectBus);
  const connected = useLive((s) => s.connected);
  const balance = useLive((s) => s.balanceKobo);
  const config = useLive((s) => s.config);
  const [sheetHeight, setSheetHeight] = useState(320);

  const buses = useMemo(() => Object.values(busMap), [busMap]);
  const focusBusId = trip?.status === 'BOARDED' ? trip.busId : (hail?.busId ?? null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={StyleSheet.absoluteFill}>
        <BusMap
          route={route}
          buses={buses}
          rider={rider?.point ?? null}
          riderStopId={rider?.stopId ?? null}
          focusBusId={focusBusId}
          selectedBusId={selectedBusId}
          dropoffStopId={trip?.dropoffStopId ?? null}
          onSelectBus={(id) => {
            if (!hail && !trip) selectBus(id);
          }}
          bottomInset={sheetHeight}
        />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={[styles.pill, shadow]}>
          <Text style={styles.logo}>RidesRus</Text>
          <View style={[styles.dot, { backgroundColor: connected ? colors.green : colors.red }]} />
          <Text style={styles.pillText}>{connected ? 'Live' : 'Reconnecting'}</Text>
        </View>
        {balance !== null && (
          <View style={[styles.pill, shadow]}>
            <Text style={styles.pillText}>{formatNaira(balance)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.legend, { bottom: sheetHeight + 12 }]} pointerEvents="none">
        {(['EMPTY', 'AVAILABLE', 'FULL'] as const).map((band) => (
          <Row key={band} gap={6} style={styles.legendItem}>
            <BandDot band={band} />
            <Text style={styles.legendText}>{band === 'AVAILABLE' ? 'Seats' : band === 'EMPTY' ? 'Empty' : 'Full'}</Text>
          </Row>
        ))}
        {config?.demoMode && (
          <View style={[styles.legendItem, { backgroundColor: colors.ink }]}>
            <Text style={[styles.legendText, { color: '#fff' }]}>DEMO · 3× speed</Text>
          </View>
        )}
      </View>

      <View style={styles.sheetWrap} onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}>
        <JourneySheet />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, height: 40 },
  logo: { fontFamily: fonts.heavy, fontSize: 17, letterSpacing: -0.6, color: colors.ink, marginRight: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  legend: { position: 'absolute', left: 16, gap: 6 },
  legendItem: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  legendText: { fontFamily: fonts.heavy, fontSize: 10, letterSpacing: 0.8, color: colors.inkSoft, textTransform: 'uppercase' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
