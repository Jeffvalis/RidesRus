import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, TopUpDTO, WalletDTO, WalletEntryDTO, formatAgo, formatNaira, naira } from '@ridesrus/core';
import { api } from '../../src/lib/api';
import { useLive } from '../../src/state/live';
import { Banner, Button, Card, Row } from '../../src/components/ui';
import { colors, fonts, radius, type } from '../../src/theme';

const AMOUNTS = [naira(1_000), naira(2_000), naira(5_000)];
const POLL_MS = 2_000;
const POLL_LIMIT_MS = 5 * 60_000;

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const payments = useLive((s) => s.config?.payments);
  const [wallet, setWallet] = useState<WalletDTO | null>(null);
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const w = await api.get<WalletDTO>('/wallet');
    setWallet(w);
    useLive.getState().setBalance(w.balanceKobo);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );
  useEffect(() => () => {
    if (poll.current) clearInterval(poll.current);
  }, []);

  const watch = (reference: string) => {
    const started = Date.now();
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const res = await api.get<TopUpDTO>(`/wallet/topups/${reference}`);
        if (res.status === 'PENDING' && Date.now() - started < POLL_LIMIT_MS) return;
        clearInterval(poll.current!);
        setPending(null);
        if (res.status === 'SUCCEEDED') setNotice({ tone: 'success', text: 'Top-up received. Your wallet has been credited.' });
        else if (res.status === 'FAILED') setNotice({ tone: 'error', text: 'The payment was declined. Nothing was charged.' });
        else setNotice({ tone: 'info', text: "We haven't heard back from the payment provider yet. It'll show here once it clears." });
        await load();
      } catch {
        // keep polling through blips
      }
    }, POLL_MS);
  };

  const topUp = async () => {
    setNotice(null);
    try {
      const res = await api.post<TopUpDTO>('/wallet/topups', { amountKobo: amount });
      setPending(res.reference);
      watch(res.reference);
      if (Platform.OS === 'web') window.open(res.checkoutUrl, '_blank', 'noopener');
      else await WebBrowser.openBrowserAsync(res.checkoutUrl);
    } catch (err) {
      setPending(null);
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not start the top-up.' });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load().catch(() => undefined); setRefreshing(false); }} />}
    >
      <Text style={type.title}>Wallet</Text>

      <View style={styles.balanceCard}>
        <Text style={[type.label, { color: '#B8B4AA' }]}>Balance</Text>
        <Text style={styles.balance}>{wallet ? formatNaira(wallet.balanceKobo) : '…'}</Text>
        <Text style={[type.small, { color: '#B8B4AA' }]}>
          {wallet && wallet.balanceKobo > 0 ? `About ${Math.floor(wallet.balanceKobo / naira(500))} rides on route 42A` : 'Top up to start riding'}
        </Text>
      </View>

      <Text style={[type.heading, { marginTop: 8 }]}>Top up</Text>
      <Row gap={10}>
        {AMOUNTS.map((a) => (
          <Pressable
            key={a}
            onPress={() => setAmount(a)}
            style={[styles.amount, amount === a && styles.amountActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: amount === a }}
          >
            <Text style={[styles.amountText, amount === a && { color: colors.yellowInk }]}>{formatNaira(a)}</Text>
          </Pressable>
        ))}
      </Row>
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
      {pending ? (
        <Banner icon="time">Waiting for payment confirmation… finish checkout in the page that opened.</Banner>
      ) : (
        <Button label={`Add ${formatNaira(amount)}`} icon="add-circle" onPress={topUp} />
      )}
      <Text style={[type.small, { textAlign: 'center' }]}>
        {payments === 'flutterwave' ? 'Secured by Flutterwave · card, transfer or USSD' : 'Sandbox payments: no real money moves'}
      </Text>

      <Text style={[type.heading, { marginTop: 16 }]}>Activity</Text>
      <Card style={{ paddingVertical: 4 }}>
        {wallet?.entries.length ? (
          wallet.entries.map((e, i) => <Entry key={e.id} entry={e} last={i === wallet.entries.length - 1} />)
        ) : (
          <Text style={[type.body, { paddingVertical: 16, textAlign: 'center' }]}>No transactions yet.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Entry({ entry, last }: { entry: WalletEntryDTO; last: boolean }) {
  const credit = entry.amountKobo > 0;
  const icon = entry.kind === 'FARE' ? 'bus' : entry.kind === 'REFUND' ? 'return-down-back' : entry.kind === 'PROMO' ? 'gift' : 'arrow-down';
  const muted = entry.status !== 'SUCCEEDED';
  return (
    <Row style={[styles.entry, !last && { borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted }]}>
      <View style={[styles.entryIcon, { backgroundColor: credit ? colors.lime : colors.surfaceMuted }]}>
        <Ionicons name={icon} size={18} color={credit ? colors.limeInk : colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.entryTitle, muted && { color: colors.inkMuted }]}>{entry.description}</Text>
        <Text style={type.small}>{formatAgo(entry.createdAt)}</Text>
      </View>
      <Text style={[styles.entryAmount, { color: muted ? colors.inkMuted : credit ? colors.green : colors.ink }]}>
        {credit ? '+' : ''}
        {formatNaira(entry.amountKobo)}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  balanceCard: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: 24, gap: 4 },
  balance: { fontFamily: fonts.heavy, fontSize: 44, letterSpacing: -1.5, color: '#fff', fontVariant: ['tabular-nums'] },
  amount: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  amountActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  amountText: { fontFamily: fonts.heavy, fontSize: 16, color: colors.ink },
  entry: { paddingVertical: 12 },
  entryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  entryAmount: { fontFamily: fonts.heavy, fontSize: 15, fontVariant: ['tabular-nums'] },
});
