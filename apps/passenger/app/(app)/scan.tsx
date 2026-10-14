import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ApiError, BoardingResultDTO, DriverQrDTO, formatNaira, newIdempotencyKey } from '@ridesrus/core';
import { api } from '../../src/lib/api';
import { useLive } from '../../src/state/live';
import { Banner, Button, Card, IconBadge, Row } from '../../src/components/ui';
import { colors, fonts, radius, type } from '../../src/theme';

/**
 * Boarding. Scanning the rotating code on the bus screen proves the rider is
 * at that bus right now; the server then takes a seat and charges the fare in
 * one transaction. Each code gets its own idempotency key, so a flaky network
 * retry can never charge twice.
 */
export default function Scan() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const balance = useLive((s) => s.balanceKobo);
  const route = useLive((s) => s.route);
  const trip = useLive((s) => s.trip);
  const hail = useLive((s) => s.hail);
  const demo = useLive((s) => s.config?.demoMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState({ bus: '', code: '' });
  const keys = useRef(new Map<string, string>());
  const lastScan = useRef(0);

  const board = async (qrToken: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const key = keys.current.get(qrToken) ?? newIdempotencyKey();
    keys.current.set(qrToken, key);
    try {
      const res = await api.post<BoardingResultDTO>('/boardings', { qrToken, idempotencyKey: key });
      useLive.getState().setTrip(res.trip);
      useLive.getState().setHail(null);
      useLive.getState().setBalance(res.balanceKobo);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not board. Please try again.');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    if (now - lastScan.current < 2500 || !data.startsWith('rr1.')) return;
    lastScan.current = now;
    void board(data);
  };

  const simulate = async () => {
    setError(null);
    try {
      const qr = await api.post<DriverQrDTO>('/demo/scan');
      await board(qr.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not simulate the scan.');
    }
  };

  if (trip?.status === 'BOARDED') {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24 }]}>
        <Card tone="lime" style={{ gap: 8 }}>
          <Text style={type.title}>You're on {trip.busCode}</Text>
          <Text style={type.body}>Your fare is paid. Track the ride and pick your stop on the Ride tab.</Text>
          <Button label="Go to my ride" variant="dark" onPress={() => router.navigate('/')} />
        </Card>
      </View>
    );
  }

  const canUseCamera = Platform.OS !== 'web';
  const manualCode = `${manual.bus.trim().toUpperCase()}:${manual.code.replace(/\D/g, '')}`;

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <Text style={[type.title, { textAlign: 'center' }]}>Boarding bus</Text>
      <Text style={[type.body, { textAlign: 'center', marginTop: 6 }]}>Scan the code on the screen by the bus door.</Text>

      <View style={styles.viewfinder}>
        {canUseCamera && permission?.granted && focused ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : onScanned} />
        ) : (
          <View style={styles.placeholder}>
            <IconBadge name="qr-code" size={64} bg="rgba(255,255,255,0.12)" fg="#fff" />
            {canUseCamera ? (
              <Button label="Allow camera" variant="primary" size="md" onPress={requestPermission} style={{ marginTop: 16 }} />
            ) : (
              <Text style={[type.small, { color: '#ddd', marginTop: 12, textAlign: 'center' }]}>Camera scanning runs in the mobile app.{'\n'}Use the bus code below.</Text>
            )}
          </View>
        )}
        <View style={styles.frame} pointerEvents="none" />
      </View>

      {error && <Banner tone="error" icon="alert-circle">{error}</Banner>}

      {demo && (
        <Button
          label={hail ? `Simulate scanning ${hail.busCode}` : 'Hail a bus first to simulate a scan'}
          icon="flash"
          variant="dark"
          disabled={!hail}
          loading={busy}
          onPress={simulate}
          style={{ marginTop: 12 }}
          accessibilityHint="Demo only: uses the code your hailed bus is showing right now"
        />
      )}

      <Text style={[type.label, { marginTop: 24, color: colors.olive }]}>Can't scan? Type the code under the QR</Text>
      <Row gap={10} style={{ marginTop: 8 }}>
        <TextInput
          value={manual.bus}
          onChangeText={(bus) => setManual((m) => ({ ...m, bus }))}
          placeholder="RR-102"
          autoCapitalize="characters"
          style={[styles.input, { flex: 1 }]}
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Bus code"
        />
        <TextInput
          value={manual.code}
          onChangeText={(code) => setManual((m) => ({ ...m, code }))}
          placeholder="482 913"
          keyboardType="number-pad"
          maxLength={7}
          style={[styles.input, { flex: 1.2, letterSpacing: 2 }]}
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Six digit code"
        />
      </Row>
      <Button
        label="Board with code"
        variant="soft"
        style={{ marginTop: 10 }}
        disabled={!/^RR-\d{3}:\d{6}$/.test(manualCode)}
        loading={busy}
        onPress={() => board(manualCode)}
      />

      <Card tone="muted" style={{ marginTop: 20 }}>
        <Row>
          <IconBadge name="wallet" />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Paying with</Text>
            <Text style={type.heading}>Wallet</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={type.label}>Balance</Text>
            <Text style={[type.heading, { color: colors.blue }]}>{balance === null ? '…' : formatNaira(balance)}</Text>
          </View>
        </Row>
      </Card>
      <Banner>
        {route ? `${formatNaira(route.fareKobo)} flat fare is charged when your scan is accepted. ` : ''}If the bus is full you won't be charged.
      </Banner>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  viewfinder: { height: 300, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#1F2023', marginTop: 12 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  frame: { position: 'absolute', top: 50, bottom: 50, left: 60, right: 60, borderWidth: 3, borderColor: colors.yellow, borderRadius: 24, opacity: 0.9 },
  input: {
    minWidth: 0,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.ink,
  },
});
