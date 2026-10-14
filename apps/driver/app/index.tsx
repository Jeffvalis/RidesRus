import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { ApiError, DriverStopGroup, formatAgo, formatDistance, formatEta, formatNaira, newIdempotencyKey } from '@ridesrus/core';
import DriverMap from '../src/components/DriverMap';
import { api } from '../src/lib/api';
import { enqueue } from '../src/queue/outbox';
import { useConsole, useEffectiveState } from '../src/state/console';
import { useConsoleConnection } from '../src/state/useConsoleConnection';
import { useShift } from '../src/state/shift';
import { Palette, fonts, usePalette } from '../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function Console() {
  useConsoleConnection();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const state = useEffectiveState();
  const route = useConsole((s) => s.route);
  const night = useConsole((s) => s.night);
  const [qrOpen, setQrOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  if (!state) {
    return (
      <View style={[styles.center, { backgroundColor: p.bg }]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: p.inkMuted }}>Loading shift…</Text>
      </View>
    );
  }

  const target = state.currentStop ?? state.nextStop;
  const arrive = (stop: DriverStopGroup) => {
    useConsole.getState().markArrived(stop.stopId);
    void enqueue({ type: 'ARRIVE_STOP', idempotencyKey: newIdempotencyKey(), at: Date.now(), stopId: stop.stopId });
    useConsole.getState().flash(stop.count ? `${stop.count} rider${stop.count > 1 ? 's' : ''} dropped at ${stop.stopName}` : `Arrived at ${stop.stopName}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg, paddingTop: insets.top }]}>
      <Header p={p} />

      <View style={[styles.main, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={[styles.mapCol, wide ? { flex: 0.42 } : { height: 320 }]}>
          <View style={[styles.mapBox, { borderColor: p.line }]}>
            <DriverMap
              route={route}
              bus={state.position}
              pickupStopIds={state.pickups.map((g) => g.stopId)}
              dropoffStopIds={state.dropoffs.map((g) => g.stopId)}
              night={night}
            />
            {state.nextStop && <NextStopCard p={p} stop={state.nextStop} />}
          </View>
        </View>

        <ScrollView style={{ flex: wide ? 0.58 : 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 12 }}>
          <View style={styles.row}>
            <Metric p={p} label="On board" value={`${state.occupied}`} suffix={`/ ${state.bus.capacity}`} progress={state.occupied / state.bus.capacity} />
            <Metric
              p={p}
              label="Seats free"
              value={`${state.bus.capacity - state.occupied}`}
              tone={state.occupied >= state.bus.capacity ? 'red' : 'lime'}
              caption={state.occupied >= state.bus.capacity ? 'Full: hails paused' : state.undecided ? `${state.undecided} yet to pick a stop` : 'All stops chosen'}
            />
            <QrCard p={p} onOpen={() => setQrOpen(true)} />
          </View>

          <Section p={p} title="Hail requests" badge={state.pickups.filter((g) => !g.acknowledged).length ? `${state.pickups.filter((g) => !g.acknowledged).length} NEW` : undefined}>
            {state.pickups.length === 0 ? (
              <Empty p={p} icon="hand-left-outline" text="No one is waiting for this bus right now." />
            ) : (
              state.pickups.map((g) => (
                <StopRow
                  key={g.stopId}
                  p={p}
                  icon="person"
                  title={g.stopName}
                  detail={`${g.count} waiting · ${formatDistance(g.metres)} ahead`}
                  eta={formatEta(g.etaSec)}
                  action={
                    g.acknowledged
                      ? { label: 'SEEN', done: true }
                      : {
                          label: 'ACKNOWLEDGE',
                          onPress: () => {
                            useConsole.getState().markAcked(g.hailIds);
                            void enqueue({ type: 'ACK_HAIL', idempotencyKey: newIdempotencyKey(), at: Date.now(), hailIds: g.hailIds });
                          },
                        }
                  }
                />
              ))
            )}
          </Section>

          <Section p={p} title="Drop-offs ahead">
            {state.dropoffs.length === 0 ? (
              <Empty p={p} icon="flag-outline" text="No drop-offs booked yet." />
            ) : (
              state.dropoffs.map((g) => (
                <StopRow
                  key={g.stopId}
                  p={p}
                  icon="flag"
                  tone="blue"
                  title={g.stopName}
                  detail={`${g.count} getting off · ${formatDistance(g.metres)}`}
                  eta={formatEta(g.etaSec)}
                />
              ))
            )}
          </Section>

          <Section p={p} title="Recent boardings" trailing={`${formatNaira(state.todayFareKobo)} this shift`}>
            {state.recentBoardings.length === 0 ? (
              <Empty p={p} icon="qr-code-outline" text="Boardings appear here as riders scan the code." />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {state.recentBoardings.map((b) => (
                  <View key={b.tripId} style={[styles.boarding, { backgroundColor: p.surface, borderColor: p.line }]}>
                    <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: p.ink }}>{b.passengerName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Ionicons name="checkmark-circle" size={14} color={p.green} />
                      <Text style={{ fontFamily: fonts.heavy, fontSize: 11, color: p.green, letterSpacing: 0.8 }}>PAID & SEATED</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: p.inkMuted, marginTop: 2 }}>{formatAgo(b.at)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Section>
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => target && arrive(target)}
          disabled={!target}
          accessibilityRole="button"
          accessibilityLabel={target ? `Stop reached: ${target.stopName}` : 'Stop reached'}
          style={({ pressed }) => [styles.footerMain, { backgroundColor: p.blue, opacity: !target ? 0.5 : pressed ? 0.88 : 1 }]}
        >
          <Ionicons name="location" size={28} color="#fff" />
          <View>
            <Text style={styles.footerMainText}>STOP REACHED</Text>
            <Text style={styles.footerSub}>
              {target ? `${target.stopName}${target.count ? ` · ${target.count} getting off` : ''}` : 'Waiting for position…'}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setEndOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.footerEnd, { backgroundColor: p.surfaceMuted, opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name="log-out-outline" size={24} color={p.ink} />
          <Text style={[styles.footerEndText, { color: p.ink }]}>END SHIFT</Text>
        </Pressable>
        <Pressable onPress={() => setSosOpen(true)} accessibilityRole="button" accessibilityLabel="SOS emergency" style={({ pressed }) => [styles.sos, { opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name="medical" size={30} color="#fff" />
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
      </View>

      <Toast p={p} />
      <QrModal p={p} open={qrOpen} onClose={() => setQrOpen(false)} />
      <SosModal p={p} open={sosOpen} onClose={() => setSosOpen(false)} />
      <EndShiftModal p={p} open={endOpen} onClose={() => setEndOpen(false)} />
    </View>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function Header({ p }: { p: Palette }) {
  const state = useEffectiveState()!;
  const socketConnected = useConsole((s) => s.socketConnected);
  const queued = useConsole((s) => s.queued);
  const syncError = useConsole((s) => s.syncError);
  const night = useConsole((s) => s.night);
  const gps = useConsole((s) => s.gps);
  const demo = useConsole((s) => s.demoMode);

  const online = socketConnected && syncError !== 'offline';
  const status = !online ? (queued ? `Offline · ${queued} queued` : 'Offline') : queued ? `Syncing ${queued}…` : 'Online · synced';

  return (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Text style={[styles.logo, { color: p.ink }]}>RidesRus</Text>
        <View style={[styles.pill, { backgroundColor: online ? (queued ? p.yellowSoft : p.accentBg) : p.redSoft }]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? (queued ? p.yellowInk : p.accentInk) : p.red }} />
          <Text style={[styles.pillText, { color: online ? (queued ? p.yellowInk : p.accentInk) : p.red }]}>{status}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {Platform.OS !== 'web' && (
          <HeaderButton
            p={p}
            icon={gps === 'on' ? 'navigate' : 'navigate-outline'}
            label={gps === 'on' ? 'GPS on' : gps === 'denied' ? 'GPS blocked' : demo ? 'Autopilot' : 'GPS off'}
            onPress={() => useConsole.getState().setGps(gps === 'on' ? 'off' : 'on')}
          />
        )}
        <HeaderButton p={p} icon={night ? 'sunny' : 'moon'} label={night ? 'Day' : 'Night'} onPress={() => useConsole.getState().setNight(!night)} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: p.ink }}>
            Route {state.route.code} · {state.route.name}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: p.inkMuted }}>
            {state.bus.code} · {state.bus.plate} · {state.driver.name.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HeaderButton({ p, icon, label, onPress }: { p: Palette; icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.headerBtn, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Ionicons name={icon} size={18} color={p.ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: p.ink }}>{label}</Text>
    </Pressable>
  );
}

function NextStopCard({ p, stop }: { p: Palette; stop: DriverStopGroup }) {
  return (
    <View style={[styles.nextStop, { backgroundColor: p.surface }]}>
      <View style={[styles.nextStopIcon, { backgroundColor: p.olive }]}>
        <Ionicons name="bus" size={26} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: p.inkMuted }]}>NEXT STOP</Text>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 24, color: p.ink, letterSpacing: -0.5 }} numberOfLines={1}>
          {stop.stopName}
        </Text>
        {stop.count > 0 && <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: p.blue }}>{stop.count} getting off</Text>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 30, color: p.blue, letterSpacing: -1 }}>{formatEta(stop.etaSec)}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: p.inkMuted }}>{formatDistance(stop.metres)}</Text>
      </View>
    </View>
  );
}

function Metric({ p, label, value, suffix, progress, tone, caption }: { p: Palette; label: string; value: string; suffix?: string; progress?: number; tone?: 'lime' | 'red'; caption?: string }) {
  const bg = tone === 'lime' ? p.accentBg : tone === 'red' ? p.redSoft : p.surface;
  const ink = tone === 'lime' ? p.accentInk : tone === 'red' ? p.red : p.ink;
  return (
    <View style={[styles.metric, { backgroundColor: bg, borderColor: p.line }]}>
      <Text style={[styles.label, { color: tone ? ink : p.inkMuted }]}>{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={[styles.metricValue, { color: ink }]}>{value}</Text>
        {suffix && <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: p.inkMuted }}>{suffix}</Text>}
      </View>
      {progress !== undefined && (
        <View style={[styles.bar, { backgroundColor: p.surfaceMuted }]}>
          <View style={{ width: `${Math.min(100, progress * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: progress >= 1 ? p.red : p.olive }} />
        </View>
      )}
      {caption && <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: ink, marginTop: 8 }}>{caption}</Text>}
    </View>
  );
}

function useQrCountdown() {
  const qr = useConsole((s) => s.qr);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return { qr, left: qr ? Math.max(0, Math.ceil((qr.expiresAt - now) / 1000)) : 0 };
}

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

function QrCard({ p, onOpen }: { p: Palette; onOpen: () => void }) {
  const { qr, left } = useQrCountdown();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Show boarding code full screen" style={[styles.metric, styles.qrCard, { backgroundColor: p.surface, borderColor: p.line }]}>
      <View style={{ backgroundColor: '#fff', padding: 6, borderRadius: 10 }}>
        {qr ? <QRCode value={qr.token} size={92} /> : <View style={{ width: 92, height: 92 }} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, { color: p.inkMuted }]}>BOARDING CODE</Text>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 22, color: p.ink, letterSpacing: 2 }}>{qr ? spaced(qr.shortCode) : '··· ···'}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: p.inkMuted }}>Changes in {left}s · tap to enlarge</Text>
      </View>
    </Pressable>
  );
}

function QrModal({ p, open, onClose }: { p: Palette; open: boolean; onClose: () => void }) {
  const { qr, left } = useQrCountdown();
  const route = useEffectiveState()?.route;
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 60_000); // drift back to the console
    return () => clearTimeout(t);
  }, [open, onClose]);
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <Pressable onPress={onClose} style={[styles.center, { backgroundColor: '#fff', gap: 20 }]} accessibilityLabel="Close boarding code">
        <Text style={{ fontFamily: fonts.heavy, fontSize: 30, color: p.ink }}>Scan to board {qr?.busCode}</Text>
        {qr && <QRCode value={qr.token} size={360} />}
        <Text style={{ fontFamily: fonts.heavy, fontSize: 44, letterSpacing: 6, color: p.ink }}>{qr ? `${qr.busCode} · ${spaced(qr.shortCode)}` : ''}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: p.inkMuted }}>
          {route ? `${formatNaira(route.fareKobo)} from your RidesRus wallet · ` : ''}code changes in {left}s
        </Text>
      </Pressable>
    </Modal>
  );
}

function Section({ p, title, badge, trailing, children }: { p: Palette; title: string; badge?: string; trailing?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 22, color: p.ink, letterSpacing: -0.4 }}>{title}</Text>
        {badge && (
          <View style={{ backgroundColor: p.red, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 12, color: '#fff', letterSpacing: 1 }}>{badge}</Text>
          </View>
        )}
        {trailing && <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: p.inkMuted }}>{trailing}</Text>}
      </View>
      {children}
    </View>
  );
}

function StopRow({
  p,
  icon,
  title,
  detail,
  eta,
  tone,
  action,
}: {
  p: Palette;
  icon: IconName;
  title: string;
  detail: string;
  eta: string;
  tone?: 'blue';
  action?: { label: string; onPress?: () => void; done?: boolean };
}) {
  return (
    <View style={[styles.stopRow, { backgroundColor: p.surface, borderColor: p.line }]}>
      <View style={[styles.stopIcon, { backgroundColor: tone === 'blue' ? p.blueSoft : p.yellowSoft }]}>
        <Ionicons name={icon} size={20} color={tone === 'blue' ? p.blue : p.yellowInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 19, color: p.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: p.inkSoft }}>{detail}</Text>
      </View>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 20, color: p.blue, marginRight: action ? 12 : 0 }}>{eta}</Text>
      {action &&
        (action.done ? (
          <View style={[styles.ack, { backgroundColor: p.accentBg }]}>
            <Ionicons name="checkmark" size={18} color={p.accentInk} />
            <Text style={[styles.ackText, { color: p.accentInk }]}>{action.label}</Text>
          </View>
        ) : (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => [styles.ack, { backgroundColor: p.olive, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[styles.ackText, { color: '#fff' }]}>{action.label}</Text>
          </Pressable>
        ))}
    </View>
  );
}

function Empty({ p, icon, text }: { p: Palette; icon: IconName; text: string }) {
  return (
    <View style={[styles.empty, { borderColor: p.line }]}>
      <Ionicons name={icon} size={22} color={p.inkMuted} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: p.inkMuted }}>{text}</Text>
    </View>
  );
}

function Toast({ p }: { p: Palette }) {
  const message = useConsole((s) => s.message);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3_500);
    return () => clearTimeout(t);
  }, [message]);
  if (!visible || !message) return null;
  return (
    <View style={[styles.toast, { backgroundColor: p.ink }]} accessibilityLiveRegion="polite">
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: p.bg }}>{message.text}</Text>
    </View>
  );
}

function SosModal({ p, open, onClose }: { p: Palette; open: boolean; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  useEffect(() => {
    if (open) setState('idle');
  }, [open]);
  const send = async () => {
    setState('sending');
    try {
      await api.post('/driver/sos');
      setState('sent');
    } catch {
      setState('failed');
    }
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <View style={[styles.center, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.dialog, { backgroundColor: p.surface }]}>
          <Ionicons name="warning" size={44} color={p.red} />
          <Text style={[styles.dialogTitle, { color: p.ink }]}>
            {state === 'sent' ? 'Fleet HQ has been alerted' : state === 'failed' ? 'Could not reach Fleet HQ' : 'Send an emergency alert?'}
          </Text>
          <Text style={[styles.dialogBody, { color: p.inkSoft }]}>
            {state === 'sent'
              ? 'Dispatch can see your bus and location. Stay safe; they will call you.'
              : state === 'failed'
                ? 'No connection. Call dispatch directly, or 112 for emergency services.'
                : 'Dispatch will see your bus, location and phone number immediately.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {state === 'idle' || state === 'sending' ? (
              <>
                <DialogButton p={p} label="Cancel" onPress={onClose} />
                <DialogButton p={p} label={state === 'sending' ? 'Sending…' : 'SEND SOS'} danger onPress={send} />
              </>
            ) : (
              <DialogButton p={p} label="Close" onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EndShiftModal({ p, open, onClose }: { p: Palette; open: boolean; onClose: () => void }) {
  const state = useEffectiveState();
  const queued = useConsole((s) => s.queued);
  const [error, setError] = useState<string | null>(null);
  const end = async () => {
    setError(null);
    try {
      await api.post('/driver/shift/end');
      await useShift.getState().end();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await useShift.getState().end();
      else setError("Can't reach the server. Your shift will stay open until you're back online.");
    }
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'portrait']}>
      <View style={[styles.center, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.dialog, { backgroundColor: p.surface }]}>
          <Text style={[styles.dialogTitle, { color: p.ink }]}>End your shift?</Text>
          <Text style={[styles.dialogBody, { color: p.inkSoft }]}>
            {state?.occupied ? `${state.occupied} rider${state.occupied > 1 ? 's are' : ' is'} still on board. ` : ''}
            {queued ? `${queued} action${queued > 1 ? 's' : ''} still waiting to sync. ` : ''}
            This tablet will sign out and the bus stops taking hails.
          </Text>
          {error && <Text style={{ color: p.red, fontFamily: fonts.semibold }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <DialogButton p={p} label="Keep driving" onPress={onClose} />
            <DialogButton p={p} label="End shift" danger onPress={end} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({ p, label, onPress, danger }: { p: Palette; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.dialogBtn, { backgroundColor: danger ? p.red : p.surfaceMuted, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: danger ? '#fff' : p.ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, gap: 16, flexWrap: 'wrap' },
  logo: { fontFamily: fonts.heavy, fontSize: 26, letterSpacing: -1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  pillText: { fontFamily: fonts.heavy, fontSize: 13 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1 },
  main: { flex: 1, paddingHorizontal: 28, gap: 28 },
  mapCol: {},
  mapBox: { flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  nextStop: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 1000 },
  nextStopIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 180, borderRadius: 20, padding: 20, borderWidth: 1 },
  metricValue: { fontFamily: fonts.heavy, fontSize: 48, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  label: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 1.4 },
  bar: { height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  qrCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 280, flex: 1.4 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  stopIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ack: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: 20, borderRadius: 14, justifyContent: 'center' },
  ackText: { fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.8 },
  boarding: { width: 170, padding: 14, borderRadius: 16, borderWidth: 1 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed' },
  footer: { flexDirection: 'row', gap: 16, paddingHorizontal: 28, paddingTop: 16 },
  footerMain: { flex: 1, height: 84, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  footerMainText: { fontFamily: fonts.heavy, fontSize: 24, color: '#fff', letterSpacing: 0.5 },
  footerSub: { fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  footerEnd: { width: 200, height: 84, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footerEndText: { fontFamily: fonts.heavy, fontSize: 18 },
  sos: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(220,38,38,0.35)' },
  sosText: { fontFamily: fonts.heavy, fontSize: 12, color: '#fff', marginTop: -2 },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 130, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16 },
  dialog: { width: 520, maxWidth: '90%', borderRadius: 28, padding: 32, gap: 12, alignItems: 'flex-start' },
  dialogTitle: { fontFamily: fonts.heavy, fontSize: 26, letterSpacing: -0.5 },
  dialogBody: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25 },
  dialogBtn: { height: 60, paddingHorizontal: 28, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
