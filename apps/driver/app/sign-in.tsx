import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, DriverLoginBody } from '@ridesrus/core';
import { api } from '../src/lib/api';
import { ShiftSession, useShift } from '../src/state/shift';
import { fonts, usePalette } from '../src/theme';

/** "Shift Command Center" — driver ID + the one-time access key Fleet HQ issued for this bus. */
export default function SignIn() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const start = useShift((s) => s.start);
  const [driverCode, setDriverCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    api
      .get<{ demoMode: boolean }>('/config')
      .then((c) => {
        setOnline(true);
        setDemo(c.demoMode);
      })
      .catch(() => setOnline(false));
  }, []);

  const submit = async () => {
    const parsed = DriverLoginBody.safeParse({ driverCode, pin });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError(null);
    try {
      await start(await api.post<ShiftSession>('/auth/driver/login', parsed.data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the shift.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.page, { flexDirection: wide ? 'row' : 'column' }]} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, gap: 20, maxWidth: 520 }}>
          <Text style={[styles.logo, { color: p.ink }]}>RidesRus</Text>
          <View style={[styles.badge, { backgroundColor: online === false ? p.redSoft : p.lime }]}>
            <Text style={[styles.badgeText, { color: online === false ? p.red : p.limeInk }]}>
              {online === null ? 'CONNECTING…' : online ? 'SYSTEM ONLINE' : 'NO CONNECTION'}
            </Text>
          </View>
          <Text style={[styles.hero, { color: p.ink }]}>Shift{'\n'}Command{'\n'}Center.</Text>
          <Info p={p} icon="shield-checkmark" title="One key, one bus, one shift" body="Fleet HQ issues a 6-digit key bound to you and a specific bus. It works once and expires after 15 minutes." />
          <Info p={p} icon="call" title="Locked out?" body="Call your dispatcher. They can issue a fresh key from Fleet HQ in seconds." />
        </View>

        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Text style={[styles.label, { color: p.olive }]}>DRIVER ID</Text>
          <View style={[styles.input, { backgroundColor: p.surfaceMuted }]}>
            <Ionicons name="id-card" size={22} color={p.inkMuted} />
            <TextInput
              value={driverCode}
              onChangeText={(v) => setDriverCode(v.toUpperCase())}
              placeholder="RR-9942"
              placeholderTextColor={p.inkMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.inputText, { color: p.ink }]}
              accessibilityLabel="Driver ID"
            />
          </View>
          <Text style={[styles.label, { color: p.olive, marginTop: 20 }]}>ACCESS KEY</Text>
          <View style={[styles.input, { backgroundColor: p.surfaceMuted }]}>
            <Ionicons name="keypad" size={22} color={p.inkMuted} />
            <TextInput
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={p.inkMuted}
              keyboardType="number-pad"
              secureTextEntry
              style={[styles.inputText, { color: p.ink, letterSpacing: 8 }]}
              onSubmitEditing={submit}
              accessibilityLabel="Six digit access key"
            />
          </View>
          {error && (
            <View style={[styles.error, { backgroundColor: p.redSoft }]} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={p.red} />
              <Text style={{ color: p.red, fontFamily: fonts.semibold, flex: 1 }}>{error}</Text>
            </View>
          )}
          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, { backgroundColor: p.yellow, opacity: pressed || busy ? 0.85 : 1 }]}
          >
            {busy ? <ActivityIndicator color={p.yellowInk} /> : <Text style={[styles.ctaText, { color: p.yellowInk }]}>START SHIFT  →</Text>}
          </Pressable>
          {demo && (
            <Text style={{ color: p.inkMuted, fontFamily: fonts.medium, marginTop: 16, lineHeight: 20 }}>
              Demo: sign in to Fleet HQ, open Drivers and choose "Issue key" for any driver and bus, then enter that driver's ID and the key here.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Info({ p, icon, title, body }: { p: ReturnType<typeof usePalette>; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={p.olive} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: p.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: p.inkSoft, lineHeight: 22, marginTop: 2 }}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 40, gap: 40, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.heavy, fontSize: 28, letterSpacing: -1 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  badgeText: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 1.5 },
  hero: { fontFamily: fonts.heavy, fontSize: 64, lineHeight: 66, letterSpacing: -2.5 },
  card: { width: '100%', maxWidth: 460, borderRadius: 28, padding: 36, borderWidth: 1 },
  label: { fontFamily: fonts.heavy, fontSize: 13, letterSpacing: 1.5, marginBottom: 10 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 68, borderRadius: 16, paddingHorizontal: 20 },
  inputText: { flex: 1, height: '100%', fontFamily: fonts.bold, fontSize: 24 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, marginTop: 20 },
  cta: { height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  ctaText: { fontFamily: fonts.heavy, fontSize: 22, letterSpacing: 0.5 },
});
