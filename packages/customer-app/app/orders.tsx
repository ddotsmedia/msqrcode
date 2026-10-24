import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { money } from '../src/api';
import { useCart } from '../src/cart';
import { clearSavedOrders, getSavedOrders, trackOrder, type SavedOrder } from '../src/orders';
import { planReorder } from '../src/reorder';
import { SkeletonCard } from '../src/skeleton';
import { AnimatedEmptyState, ErrorState } from '../src/ui';
import { Page, ui } from '../src/ui';
import { C } from '../src/theme';

const LABEL: Record<string, string> = { placed: 'Received', preparing: 'Being made', ready: 'Ready for pickup', completed: 'Collected', cancelled: 'Cancelled' };

// Last six months of spend, oldest first, from the orders stored on this phone.
function monthlySpend(orders: SavedOrder[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString([], { month: 'short' }), total: 0 };
  });
  for (const o of orders) {
    const d = new Date(o.created_at);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.total += Number(o.total) || 0;
  }
  return months;
}

export default function OrdersScreen() {
  const qc = useQueryClient();
  const { add } = useCart();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: saved = [], isLoading, isError, refetch } = useQuery({ queryKey: ['saved-orders'], queryFn: getSavedOrders });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const results = useQueries({
    queries: saved.map((o: SavedOrder) => ({
      queryKey: ['order', o.id, o.access_token],
      queryFn: () => trackOrder(o.id, o.access_token),
      staleTime: 30_000,
    })),
  });

  async function reorder(o: SavedOrder) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(o.id);
    try {
      const order = await trackOrder(o.id, o.access_token).catch(() => null);
      if (!order) return Alert.alert('Could not reorder', 'We could not load this order. Please try again.');
      const plan = await planReorder(order);
      if (!plan.lines.length) return Alert.alert('Nothing to add', 'None of the items in this order are on the menu any more.');
      for (const l of plan.lines) add(l.product, l.qty, l.choices, l.note);
      const notes: string[] = [];
      if (plan.unavailable.length) notes.push(`No longer on the menu: ${plan.unavailable.join(', ')}.`);
      if (plan.changed.length) notes.push(`Some options changed, so the standard choice was used for: ${plan.changed.join(', ')}.`);
      if (notes.length) Alert.alert('Added to your cart', notes.join('\n\n'), [{ text: 'Open cart', onPress: () => router.push('/cart') }]);
      else router.push('/cart');
    } finally {
      setBusy(null);
    }
  }

  function clearHistory() {
    Alert.alert('Clear order history?', 'This removes the list of orders from this phone. Your orders stay on our system.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearSavedOrders();
          qc.removeQueries({ queryKey: ['order'] });
          qc.invalidateQueries({ queryKey: ['saved-orders'] });
        },
      },
    ]);
  }

  return (
    <Page kicker="Account" title="Order history" onRefresh={onRefresh} refreshing={refreshing}>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : null}
      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : null}
      {!isLoading && !saved.length ? (
        <AnimatedEmptyState
          icon="📋"
          title="No orders yet"
          body="Orders you place from this phone appear here, with live status and one-tap reorder."
          action="Browse the menu"
          onAction={() => router.replace('/(tabs)')}
        />
      ) : null}
      {saved.length > 0 ? (
        <View style={[ui.card, styles.stats]}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{saved.length}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{money(saved.reduce((s2, o) => s2 + (Number(o.total) || 0), 0))}</Text>
              <Text style={styles.statLabel}>Total spent</Text>
            </View>
          </View>
          <Text style={styles.chartTitle}>Last 6 months</Text>
          <View style={styles.chart}>
            {(() => {
              const months = monthlySpend(saved);
              const max = Math.max(1, ...months.map((m) => m.total));
              return months.map((m) => (
                <View key={m.key} style={styles.barCol}>
                  <Text style={styles.barValue}>{m.total ? Math.round(m.total) : ''}</Text>
                  <View style={[styles.bar, { height: Math.max(4, (m.total / max) * 90) }]} />
                  <Text style={styles.barLabel}>{m.label}</Text>
                </View>
              ));
            })()}
          </View>
        </View>
      ) : null}
      {saved.map((o, i) => {
        const r = results[i];
        const order = r?.data;
        return (
          <View key={o.id} style={ui.card}>
            <View style={styles.row}>
              <Text style={ui.name}>Order #{o.order_no}</Text>
              <Text style={styles.money}>{money(o.total)}</Text>
            </View>
            <Text style={ui.sub}>
              {new Date(o.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {r?.isError ? 'Status unavailable' : order ? LABEL[order.status] ?? order.status : 'Checking…'}
            </Text>
            {order?.items?.length ? (
              <Text style={styles.items} numberOfLines={2}>
                {order.items.map((it) => `${it.qty} × ${it.name}`).join(', ')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.btnGhost} onPress={() => router.push(`/order/${o.id}` as never)}>
                <Text style={styles.btnGhostText}>View</Text>
              </Pressable>
              <Pressable style={[styles.btn, busy !== null && styles.btnDisabled]} disabled={busy !== null} onPress={() => reorder(o)}>
                <Text style={styles.btnText}>{busy === o.id ? 'Adding…' : 'Reorder'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {saved.length > 0 ? (
        <Pressable onPress={clearHistory} style={styles.clear}>
          <Text style={styles.danger}>Clear order history on this phone</Text>
        </Pressable>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  stats: { marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: C.cream, borderRadius: 14, padding: 12 },
  statValue: { fontSize: 20, fontWeight: '700', color: C.navy },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: C.navy2, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130, marginTop: 10 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '60%', borderRadius: 6, backgroundColor: C.caramel },
  barValue: { fontSize: 10, color: C.muted, marginBottom: 4 },
  barLabel: { fontSize: 11, color: C.muted, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  money: { fontSize: 15, fontWeight: '600', color: C.navy },
  items: { fontSize: 13, color: C.muted, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: C.white, fontWeight: '600' },
  btnGhost: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingVertical: 11, alignItems: 'center' },
  btnGhostText: { color: C.navy, fontWeight: '600' },
  clear: { marginTop: 16, alignItems: 'center', padding: 10 },
  danger: { color: '#b3261e', fontWeight: '600' },
});
