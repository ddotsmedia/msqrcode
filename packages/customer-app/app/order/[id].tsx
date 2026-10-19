import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { money } from '../../src/api';
import { getSavedOrders, trackOrder } from '../../src/orders';
import { C } from '../../src/theme';

const STEPS = ['placed', 'preparing', 'ready', 'completed'] as const;
const LABEL: Record<string, string> = { placed: 'Received', preparing: 'Being made', ready: 'Ready for pickup', completed: 'Collected', cancelled: 'Cancelled' };

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSavedOrders().then((all) => {
      setToken(all.find((o) => o.id === id)?.access_token ?? null);
      setReady(true);
    });
  }, [id]);

  const { data, isError, isLoading } = useQuery({
    queryKey: ['order', id, token],
    enabled: !!token,
    queryFn: () => trackOrder(String(id), token!),
    refetchInterval: 20_000,
  });

  const stepIndex = data ? STEPS.indexOf(data.status as (typeof STEPS)[number]) : -1;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.replace('/(tabs)')}><Text style={styles.close}>Back to menu</Text></Pressable>
        {!ready || isLoading ? <Text style={styles.muted}>Loading your order…</Text> : null}
        {ready && !token && <Text style={styles.muted}>This order was not placed from this phone, so its status is not available here.</Text>}
        {isError && <Text style={styles.muted}>We could not load this order. It will retry automatically.</Text>}
        {data && (
          <>
            <Text style={styles.title}>Order #{data.order_no}</Text>
            <Text style={styles.status}>{LABEL[data.status] ?? data.status}</Text>
            {data.status !== 'cancelled' && (
              <View style={styles.track}>
                {STEPS.map((s, i) => (
                  <View key={s} style={styles.trackRow}>
                    <View style={[styles.dot, i <= stepIndex && styles.dotOn]} />
                    <Text style={[styles.trackText, i <= stepIndex && styles.trackTextOn]}>{LABEL[s]}</Text>
                  </View>
                ))}
              </View>
            )}
            {data.pickup_at && <Text style={styles.note}>Pickup time: {new Date(data.pickup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
            <Text style={styles.label}>Items</Text>
            {data.items.map((i, idx) => (
              <View key={idx} style={styles.item}>
                <Text style={styles.itemName}>{i.qty} × {i.name}</Text>
                {!!i.options?.choices?.length && <Text style={styles.itemSub}>{i.options.choices.map((c) => c.choice).join(' · ')}</Text>}
                {!!i.options?.note && <Text style={styles.itemSub}>“{i.options.note}”</Text>}
              </View>
            ))}
            <Text style={styles.total}>Total {money(data.total)}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '600', color: C.navy },
  status: { fontSize: 16, color: C.navy2, fontWeight: '600', marginTop: 4, marginBottom: 14 },
  track: { gap: 12, marginBottom: 10 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.line },
  dotOn: { backgroundColor: C.caramel },
  trackText: { color: C.muted, fontSize: 15 },
  trackTextOn: { color: C.navy, fontWeight: '600' },
  note: { color: C.muted, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  item: { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  itemName: { fontSize: 15, fontWeight: '600', color: C.navy },
  itemSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  total: { fontSize: 18, fontWeight: '600', color: C.navy, marginTop: 14 },
  muted: { color: C.muted, marginTop: 20, lineHeight: 21 },
});
