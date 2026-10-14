import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, AuthResponse, PassengerDTO } from '@ridesrus/core';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/state/session';
import { Banner, Button, Chip, Row } from '../../src/components/ui';
import { colors, fonts, radius, type } from '../../src/theme';

/** Welcome — the "Move with the Pulse" landing from the original designs, plus a one-tap demo. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ demoMode: boolean }>('/config').then((c) => setDemo(c.demoMode)).catch(() => undefined);
  }, []);

  const tryDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(await api.post<AuthResponse<{ passenger: PassengerDTO }>>('/auth/guest'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the demo.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.logo}>RidesRus</Text>
        <Link href="/sign-in" style={styles.headerLink} accessibilityRole="link">
          Sign in
        </Link>
      </Row>

      <View style={styles.hero}>
        <View style={styles.heroRoad} />
        <View style={styles.heroBus}>
          <Ionicons name="bus" size={64} color={colors.yellowInk} />
        </View>
        <View style={styles.heroStat}>
          <Text style={type.label}>Lekki ⇄ VI</Text>
          <Text style={styles.heroStatValue}>Live seats</Text>
          <View style={styles.heroBar}>
            <View style={styles.heroBarFill} />
          </View>
        </View>
      </View>

      <Chip label="Lagos beat" tone="lime" />
      <Text style={[type.display, { marginTop: 12 }]}>
        Move with the <Text style={{ color: colors.olive }}>Pulse.</Text>
      </Text>
      <Text style={[type.body, { marginTop: 12, fontSize: 17, lineHeight: 26 }]}>
        See every bus on the Lekki–Victoria Island corridor and how many seats are free. Hail it from the roadside, scan to board, and pay from your wallet. No cash, no exact change.
      </Text>

      <View style={{ gap: 12, marginTop: 28 }}>
        {error && <Banner tone="error">{error}</Banner>}
        {demo && <Button label="Try the live demo" iconRight="arrow-forward" loading={busy} onPress={tryDemo} accessibilityHint="Creates a guest account with ₦2,000 ride credit" />}
        <Link href="/register" asChild>
          <Button label="Create an account" variant={demo ? 'dark' : 'primary'} />
        </Link>
        <Link href="/sign-in" asChild>
          <Button label="I already have an account" variant="ghost" />
        </Link>
      </View>
      {demo && (
        <Text style={[type.small, { textAlign: 'center', marginTop: 12 }]}>
          Demo mode: buses and other riders are simulated at 3× speed; payments use a sandbox.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logo: { fontFamily: fonts.heavy, fontSize: 26, letterSpacing: -1, color: colors.ink },
  headerLink: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  hero: {
    height: 220,
    borderRadius: radius.xl,
    backgroundColor: '#2F4A4C',
    marginVertical: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroRoad: { position: 'absolute', bottom: 0, left: '46%', width: 6, height: 120, backgroundColor: colors.yellow, opacity: 0.85, borderRadius: 3 },
  heroBus: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    width: 110,
    height: 110,
    borderRadius: 30,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStat: { margin: 18, padding: 14, width: 160, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.92)', gap: 4 },
  heroStatValue: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  heroBar: { height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 4 },
  heroBarFill: { width: '70%', height: 6, borderRadius: 3, backgroundColor: colors.olive },
});
