import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiError,
  BusLiveDTO,
  HailDTO,
  TripDTO,
  formatDistance,
  formatEta,
  formatNaira,
} from '@ridesrus/core';
import { api } from '../lib/api';
import { stopName, useLive } from '../state/live';
import { chooseStop } from '../state/useRiderLocation';
import { colors, fonts, radius, shadow, type } from '../theme';
import { Banner, Button, Card, Chip, IconBadge, Row, SeatChip, Stars } from '../components/ui';
import { StopPicker } from '../components/StopPicker';
import { approachOf, stopsAhead, useApproaching, useGeometry } from './eta';

/** Re-render every second so countdowns tick between socket updates. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/**
 * The bottom sheet on the Ride tab. It renders exactly one of:
 *   rate → riding → hailed → bus selected → idle
 * driven entirely by live server state, so reopening the app resumes mid-journey.
 */
export function JourneySheet() {
  const trip = useLive((s) => s.trip);
  const hail = useLive((s) => s.hail);
  const selectedBusId = useLive((s) => s.selectedBusId);

  return (
    <View style={[styles.sheet, shadow]}>
      {trip?.status === 'COMPLETED' ? (
        <RateView trip={trip} />
      ) : trip ? (
        <RidingView trip={trip} />
      ) : hail ? (
        <HailedView hail={hail} />
      ) : selectedBusId ? (
        <BusView busId={selectedBusId} />
      ) : (
        <IdleView />
      )}
    </View>
  );
}

/* ───────────────────────── Idle: buses coming to my stop ───────────────────────── */

function IdleView() {
  const route = useLive((s) => s.route);
  const buses = useLive((s) => s.buses);
  const rider = useLive((s) => s.rider);
  const selectBus = useLive((s) => s.selectBus);
  const [picking, setPicking] = useState(false);
  const approaching = useApproaching(route, buses, rider?.stopId ?? null).slice(0, 3);

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={() => setPicking(true)} style={styles.stopRow} accessibilityRole="button" accessibilityLabel="Change your stop">
        <IconBadge name="location" bg={colors.blueSoft} fg={colors.blue} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={type.label}>{rider?.source === 'gps' ? 'Nearest stop' : 'Your stop'}</Text>
          <Text style={type.heading}>{stopName(route, rider?.stopId) || 'Finding you…'}</Text>
        </View>
        <Text style={styles.link}>Change</Text>
      </Pressable>

      <Text style={type.label}>Arriving at your stop</Text>
      {approaching.length === 0 ? (
        <Card tone="muted">
          <Text style={type.body}>Waiting for buses to come online…</Text>
        </Card>
      ) : (
        approaching.map((a) => (
          <Pressable
            key={a.bus.id}
            onPress={() => selectBus(a.bus.id)}
            style={({ pressed }) => [styles.busRow, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`${a.bus.code} towards ${a.towards}, ${formatEta(a.etaSec)}, ${a.bus.capacity - a.bus.occupied} seats free`}
          >
            <View style={[styles.busIcon, a.bus.band === 'FULL' && { backgroundColor: colors.redSoft }]}>
              <Ionicons name="bus" size={20} color={a.bus.band === 'FULL' ? colors.red : colors.ink} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.busCode}>
                {a.bus.code} <Text style={type.small}>→ {a.towards}</Text>
              </Text>
              <SeatChip band={a.bus.band} free={a.bus.capacity - a.bus.occupied} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.eta}>{formatEta(a.etaSec)}</Text>
              <Text style={type.small}>{formatDistance(a.metres)}</Text>
            </View>
          </Pressable>
        ))
      )}

      <StopPicker
        visible={picking}
        title="Where are you?"
        subtitle="Pick the stop you're waiting at."
        options={route?.stops.map((s) => ({ id: s.id, name: s.name })) ?? []}
        selectedId={rider?.stopId ?? null}
        onSelect={(id) => {
          chooseStop(id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

/* ───────────────────────── A bus is selected ───────────────────────── */

function BusView({ busId }: { busId: string }) {
  const route = useLive((s) => s.route);
  const bus = useLive((s) => s.buses[busId]) as BusLiveDTO | undefined;
  const rider = useLive((s) => s.rider);
  const balance = useLive((s) => s.balanceKobo);
  const selectBus = useLive((s) => s.selectBus);
  const setHail = useLive((s) => s.setHail);
  const geometry = useGeometry(route);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bus || !route || !geometry || !rider) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={type.heading}>This bus has gone out of service.</Text>
        <Button label="Back to buses" variant="soft" onPress={() => selectBus(null)} />
      </View>
    );
  }

  const a = approachOf(geometry, route, bus, rider.stopId);
  const free = bus.capacity - bus.occupied;
  const fare = route.fareKobo;
  const short = balance !== null && balance < fare;

  const hail = async () => {
    setBusy(true);
    setError(null);
    try {
      setHail(await api.post<HailDTO>('/hails', { busId: bus.id, lat: rider.point.lat, lng: rider.point.lng }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Chip label={`Route ${route.code}`} tone="blue" />
          <Text style={type.title}>{bus.code}</Text>
          <Text style={type.body}>Towards {a.towards}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.number, { color: colors.blue }]}>{formatEta(a.etaSec)}</Text>
          <Text style={type.label}>to {stopName(route, rider.stopId)}</Text>
        </View>
        <Pressable onPress={() => selectBus(null)} hitSlop={10} accessibilityLabel="Close" style={{ marginLeft: 12 }}>
          <Ionicons name="close-circle" size={28} color={colors.line} />
        </Pressable>
      </Row>

      <Row gap={10}>
        <Card tone={bus.band === 'FULL' ? 'muted' : 'lime'} style={{ flex: 1 }}>
          <Ionicons name="people" size={20} color={bus.band === 'FULL' ? colors.red : colors.limeInk} />
          <Text style={[styles.metric, { color: bus.band === 'FULL' ? colors.red : colors.limeInk }]}>
            {bus.band === 'FULL' ? 'Full' : `${free} free`}
          </Text>
          <Text style={type.small}>
            {bus.occupied}/{bus.capacity} seats taken
          </Text>
        </Card>
        <Card tone="muted" style={{ flex: 1 }}>
          <Ionicons name="wallet" size={20} color={colors.olive} />
          <Text style={styles.metric}>{formatNaira(fare)}</Text>
          <Text style={type.small}>Flat fare · {balance === null ? '…' : `${formatNaira(balance)} in wallet`}</Text>
        </Card>
      </Row>

      {error && <Banner tone="error" icon="alert-circle">{error}</Banner>}
      {short ? (
        <Button label="Top up to ride" icon="add-circle" variant="dark" onPress={() => router.push('/wallet')} />
      ) : (
        <Button
          label={bus.band === 'FULL' ? 'Bus is full' : `Hail ${bus.code}`}
          iconRight="arrow-forward"
          disabled={bus.band === 'FULL' || !bus.inService}
          loading={busy}
          onPress={hail}
          accessibilityHint="Alerts the driver to stop for you"
        />
      )}
    </View>
  );
}

/* ───────────────────────── Hailed, waiting at the stop ───────────────────────── */

function HailedView({ hail }: { hail: HailDTO }) {
  const route = useLive((s) => s.route);
  const bus = useLive((s) => s.buses[hail.busId]);
  const setHail = useLive((s) => s.setHail);
  const geometry = useGeometry(route);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = bus && geometry && route ? approachOf(geometry, route, bus, hail.stopId) : null;
  const acked = hail.status === 'ACKNOWLEDGED';
  const minsLeft = Math.max(0, Math.ceil((hail.expiresAt - now) / 60_000));

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/hails/${hail.id}/cancel`);
      setHail(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Chip label={acked ? 'Driver has seen you' : 'Hail sent'} tone={acked ? 'lime' : 'yellow'} icon={acked ? 'checkmark-circle' : 'radio'} />
          <Text style={type.title}>{hail.busCode} is coming</Text>
          <Text style={type.body}>Wait at {hail.stopName}. Scan the code on the bus screen as you board.</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.number, { color: colors.blue }]}>{a ? formatEta(a.etaSec) : '—'}</Text>
          <Text style={type.small}>{a ? formatDistance(a.metres) : ''}</Text>
        </View>
      </Row>

      {error && <Banner tone="error" icon="alert-circle">{error}</Banner>}
      <Button label="I'm at the bus — scan to board" icon="qr-code" onPress={() => router.push('/scan')} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={type.small}>Hail expires in {minsLeft} min</Text>
        <Pressable onPress={cancel} disabled={busy} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: colors.red }]}>{busy ? 'Cancelling…' : 'Cancel hail'}</Text>
        </Pressable>
      </Row>
    </View>
  );
}

/* ───────────────────────── On board ───────────────────────── */

function RidingView({ trip }: { trip: TripDTO }) {
  const route = useLive((s) => s.route);
  const bus = useLive((s) => s.buses[trip.busId]);
  const setTrip = useLive((s) => s.setTrip);
  const geometry = useGeometry(route);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ahead = useMemo(() => (geometry && route && bus ? stopsAhead(geometry, route, bus) : []), [geometry, route, bus]);
  const drop = ahead.find((s) => s.stop.id === trip.dropoffStopId);

  const choose = async (stopId: string) => {
    setPicking(false);
    setError(null);
    try {
      setTrip(await api.put<TripDTO>(`/trips/${trip.id}/dropoff`, { stopId }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Chip label={`Paid ${formatNaira(trip.fareKobo)}`} tone="lime" icon="checkmark-circle" />
          <Text style={type.title}>You're on {trip.busCode}</Text>
          <Text style={type.body}>
            {trip.boardStopName ? `Boarded at ${trip.boardStopName}. ` : ''}
            {trip.dropoffStopName ? `The driver knows you're getting off at ${trip.dropoffStopName}.` : 'Where are you getting off?'}
          </Text>
        </View>
        {drop && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.number, { color: colors.blue }]}>{formatEta(drop.etaSec)}</Text>
            <Text style={type.small}>{formatDistance(drop.metres)}</Text>
          </View>
        )}
      </Row>
      {error && <Banner tone="error" icon="alert-circle">{error}</Banner>}
      {trip.dropoffStopId ? (
        <Button label="Change drop-off stop" icon="flag" variant="soft" onPress={() => setPicking(true)} />
      ) : (
        <Button label="Choose your stop" icon="flag" onPress={() => setPicking(true)} />
      )}
      <StopPicker
        visible={picking}
        title="Drop me at…"
        subtitle="Stops ahead, in the order the bus reaches them."
        options={ahead.map((s) => ({ id: s.stop.id, name: s.stop.name, metres: s.metres, etaSec: s.etaSec }))}
        selectedId={trip.dropoffStopId}
        onSelect={choose}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

/* ───────────────────────── Arrived: rate the trip ───────────────────────── */

function RateView({ trip }: { trip: TripDTO }) {
  const setTrip = useLive((s) => s.setTrip);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/trips/${trip.id}/rating`, { rating, comment: comment.trim() || undefined });
      setTrip(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <IconBadge name="flag" bg={colors.lime} fg={colors.limeInk} size={52} />
        <Text style={[type.title, { textAlign: 'center' }]}>You've arrived{trip.dropoffStopName ? ` at ${trip.dropoffStopName}` : ''}</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          {trip.busCode} · {formatNaira(trip.fareKobo)} paid from your wallet. How was the ride?
        </Text>
      </View>
      <Stars value={rating} onChange={setRating} />
      {rating > 0 && (
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={rating >= 4 ? 'Anything that made it great? (optional)' : 'What went wrong? (optional)'}
          placeholderTextColor={colors.inkMuted}
          style={styles.comment}
          maxLength={500}
          multiline
          accessibilityLabel="Comment"
        />
      )}
      {error && <Banner tone="error" icon="alert-circle">{error}</Banner>}
      <Button label="Submit rating" disabled={rating === 0} loading={busy} onPress={submit} />
      <Pressable onPress={() => setTrip(null)} accessibilityRole="button" style={{ alignSelf: 'center' }} hitSlop={8}>
        <Text style={styles.link}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.cream },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.olive },
  busRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  busIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.yellowSoft, alignItems: 'center', justifyContent: 'center' },
  busCode: { fontFamily: fonts.heavy, fontSize: 16, color: colors.ink },
  eta: { fontFamily: fonts.heavy, fontSize: 18, color: colors.blue },
  metric: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink, marginTop: 6, letterSpacing: -0.5 },
  comment: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
