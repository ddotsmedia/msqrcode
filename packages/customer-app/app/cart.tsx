import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, money, type Branch } from '../src/api';
import { useCart } from '../src/cart';
import { getCardToken } from '../src/storage';
import { getSavedOrders, placeOrder, type SavedOrder } from '../src/orders';
import { C } from '../src/theme';

export default function CartScreen() {
  const { lines, setQty, clear, subtotal } = useCart();
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const pickup = (branches.data ?? []).filter((b) => b.pickup_enabled !== false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<SavedOrder[]>([]);

  useEffect(() => {
    if (!branchId && pickup.length) setBranchId(pickup[0].id);
  }, [pickup, branchId]);
  useEffect(() => {
    getSavedOrders().then(setRecent);
  }, []);

  const submit = async () => {
    setError('');
    if (!branchId) return setError('Choose a branch');
    setBusy(true);
    try {
      const loyaltyToken = await getCardToken();
      const o = await placeOrder({ branchId, name: name.trim(), phone: phone.trim(), lines, loyaltyToken });
      clear();
      router.replace(`/order/${o.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.close}>Back to menu</Text></Pressable>
        <Text style={styles.title}>Your order</Text>

        {lines.length === 0 ? (
          <Text style={styles.muted}>Your cart is empty.</Text>
        ) : (
          lines.map((l) => (
            <View key={l.key} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{l.name}</Text>
                {!!l.choiceLabels.length && <Text style={styles.lineSub}>{l.choiceLabels.join(' · ')}</Text>}
                {!!l.note && <Text style={styles.lineSub}>“{l.note}”</Text>}
                <Text style={styles.linePrice}>{money((l.base_price + l.adjustment) * l.qty)}</Text>
              </View>
              <View style={styles.qty}>
                <Pressable onPress={() => setQty(l.key, l.qty - 1)}><Text style={styles.qtyBtn}>−</Text></Pressable>
                <Text style={styles.qtyNum}>{l.qty}</Text>
                <Pressable onPress={() => setQty(l.key, l.qty + 1)}><Text style={styles.qtyBtn}>+</Text></Pressable>
              </View>
            </View>
          ))
        )}

        {lines.length > 0 && (
          <>
            <Text style={styles.label}>Pick up at</Text>
            <View style={styles.chips}>
              {pickup.map((b) => (
                <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[styles.chip, branchId === b.id && styles.chipOn]}>
                  <Text style={[styles.chipText, branchId === b.id && styles.chipTextOn]}>{b.name}</Text>
                </Pressable>
              ))}
            </View>
            {branches.isError && <Text style={styles.error}>Could not load branches. Check your connection.</Text>}
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={C.muted} />
            <Text style={styles.label}>Mobile number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05x xxx xxxx" placeholderTextColor={C.muted} />
            <Text style={styles.note}>Ready in about 15 minutes. You will get a live status on this screen.</Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.placeBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              <Text style={styles.placeText}>{busy ? 'Placing order…' : `Place order · ${money(subtotal)}`}</Text>
            </Pressable>
            <Pressable onPress={() => Alert.alert('Clear cart?', '', [{ text: 'Cancel' }, { text: 'Clear', style: 'destructive', onPress: clear }])}>
              <Text style={styles.clear}>Clear cart</Text>
            </Pressable>
          </>
        )}

        {recent.length > 0 && (
          <>
            <Text style={styles.label}>Recent orders</Text>
            {recent.slice(0, 5).map((o) => (
              <Pressable key={o.id} style={styles.recent} onPress={() => router.push(`/order/${o.id}`)}>
                <Text style={styles.lineName}>Order #{o.order_no}</Text>
                <Text style={styles.lineSub}>{money(o.total)} · {new Date(o.created_at).toLocaleString()}</Text>
              </Pressable>
            ))}
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
  title: { fontSize: 26, fontWeight: '600', color: C.navy, marginBottom: 12 },
  muted: { color: C.muted, marginTop: 10 },
  line: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  lineName: { fontSize: 16, fontWeight: '600', color: C.navy },
  lineSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  linePrice: { fontSize: 14, fontWeight: '600', color: C.navy2, marginTop: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 10 },
  qtyBtn: { fontSize: 20, color: C.navy2, fontWeight: '600' },
  qtyNum: { fontSize: 15, fontWeight: '600', minWidth: 18, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  input: { backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, fontSize: 16, color: C.navy },
  note: { fontSize: 13, color: C.muted, marginTop: 12 },
  error: { color: '#b91c1c', marginTop: 10 },
  placeBtn: { backgroundColor: C.navy2, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  placeText: { color: C.white, fontWeight: '600', fontSize: 16 },
  clear: { color: C.muted, textAlign: 'center', marginTop: 14 },
  recent: { backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
});
