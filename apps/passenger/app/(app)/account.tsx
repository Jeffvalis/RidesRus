import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TripDTO, formatAgo, formatNaira } from '@ridesrus/core';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/state/session';
import { Banner, Button, Card, Chip, Row } from '../../src/components/ui';
import { colors, fonts, radius, type } from '../../src/theme';

export default function Account() {
  const insets = useSafeAreaInsets();
  const passenger = useSession((s) => s.session?.passenger);
  const signOut = useSession((s) => s.signOut);
  const [trips, setTrips] = useState<TripDTO[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.get<TripDTO[]>('/me/trips').then(setTrips).catch(() => undefined);
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Row>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{passenger?.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{passenger?.name}</Text>
          <Text style={type.small}>{passenger?.email}</Text>
        </View>
      </Row>
      {passenger?.isGuest && <Banner>You're using a demo guest account. It's fine to experiment: nothing here is real money.</Banner>}

      <Text style={[type.heading, { marginTop: 12 }]}>Your trips</Text>
      {trips === null ? null : trips.length === 0 ? (
        <Card tone="muted">
          <Text style={type.body}>No trips yet. Hail a bus from the Ride tab.</Text>
        </Card>
      ) : (
        trips.map((t) => (
          <Card key={t.id} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.tripTitle}>{t.busCode}</Text>
              <Chip
                label={t.status === 'BOARDED' ? 'On board' : t.status === 'VOIDED' ? 'Refunded' : 'Completed'}
                tone={t.status === 'BOARDED' ? 'blue' : t.status === 'VOIDED' ? 'red' : 'lime'}
              />
            </Row>
            <Row gap={8}>
              <Ionicons name="ellipse-outline" size={12} color={colors.olive} />
              <Text style={type.body}>{t.boardStopName ?? 'Between stops'}</Text>
            </Row>
            <Row gap={8}>
              <Ionicons name="flag" size={12} color={colors.olive} />
              <Text style={type.body}>{t.dropoffStopName ?? 'No stop chosen'}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={type.small}>{formatAgo(t.boardedAt)}</Text>
              <Text style={styles.fare}>
                {formatNaira(t.fareKobo)}
                {t.rating ? `  ·  ${'★'.repeat(t.rating)}` : ''}
              </Text>
            </Row>
          </Card>
        ))
      )}

      <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.heavy, fontSize: 24, color: colors.yellowInk },
  tripTitle: { fontFamily: fonts.heavy, fontSize: 17, color: colors.ink },
  fare: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
