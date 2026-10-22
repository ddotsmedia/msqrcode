import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { money } from '../src/api';
import { useCart } from '../src/cart';
import { clearSavedOrders, getSavedOrders, trackOrder, type SavedOrder } from '../src/orders';
import { planReorder } from '../src/reorder';
import { Page, ui } from '../src/ui';
import { C } from '../src/theme';

const LABEL: Record<string, string> = { placed: 'Received', preparing: 'Being made', ready: 'Ready for pickup', completed: 'Collected', cancelled: 'Cancelled' };

export default function OrdersScreen() {
  const qc = useQueryClient();
  const { add } = useCart();
  const [busy, setBusy] = useState<string | null>(null);
  const { data: saved = [], isLoading } = useQuery({ queryKey: ['saved-orders'], queryFn: getSavedOrders });

  const results = useQueries({
    queries: saved.map((o: SavedOrder) => ({
      queryKey: ['order', o.id, o.access_token],
      queryFn: () => trackOrder(o.id, o.access_token),
      staleTime: 30_000,
    })),
  });

  async function reorder(o: SavedOrder) {
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
    <Page kicker="Account" title="Order history">
      {isLoading ? <Text style={ui.lead}>Loading…</Text> : null}
      {!isLoading && !saved.length ? <Text style={ui.lead}>No orders yet. Orders you place from this phone appear here.</Text> : null}
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
