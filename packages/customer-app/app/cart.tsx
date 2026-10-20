import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, money, type Branch } from '../src/api';
import { useCart } from '../src/cart';
import { getCardToken } from '../src/storage';
import { getSavedOrders, placeOrder, requestService, type SavedOrder } from '../src/orders';
import { clearTable, getTable, type TableSession } from '../src/table';
import { C } from '../src/theme';

export default function CartScreen() {
  const { lines, setQty, clear, subtotal } = useCart();
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const pickup = (branches.data ?? []).filter((b) => b.pickup_enabled !== false);
  const [table, setTableState] = useState<TableSession | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recent, setRecent] = useState<SavedOrder[]>([]);

  useFocusEffect(
    useCallback(() => {
      getTable().then(setTableState);
      getSavedOrders().then(setRecent);
    }, []),
  );
  useEffect(() => {
    if (!branchId && pickup.length) setBranchId(pickup[0].id);
  }, [pickup, branchId]);

  const activeBranch = table ? table.branchId : branchId;

  const submit = async () => {
    setError('');
    if (!activeBranch) return setError('Choose a branch');
    setBusy(true);
    try {
      const loyaltyToken = await getCardToken();
      const o = await placeOrder({
        branchId: activeBranch,
        name: name.trim(),
        phone: phone.trim(),
        lines,
        loyaltyToken,
        table: table?.table ?? null,
      });
      clear();
      router.replace(`/order/${o.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the order');
    } finally {
      setBusy(false);
    }
  };

  const service = async (kind: 'staff' | 'bill') => {
    if (!table) return;
    setError('');
    setNotice('');
    try {
      await requestService(table.branchId, table.table, kind);
      setNotice(kind === 'bill' ? 'The bill is on its way to your table.' : 'A member of staff is coming to your table.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.close}>Back to menu</Text></Pressable>
        <Text style={styles.title}>Your order</Text>

        {table && (
          <View style={styles.tableBox}>
            <Text style={styles.lineName}>Ordering from table {table.table}</Text>
            <View style={styles.row}>
              <Pressable style={styles.smallBtn} onPress={() => service('staff')}><Text style={styles.smallBtnText}>Call staff</Text></Pressable>
              <Pressable style={styles.smallBtn} onPress={() => service('bill')}><Text style={styles.smallBtnText}>Request bill</Text></Pressable>
            </View>
            <Pressable onPress={() => clearTable().then(() => setTableState(null))}><Text style={styles.clear}>Leave table</Text></Pressable>
          </View>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}

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
            {!table && (
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
              </>
            )}
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={C.muted} />
            {!table && (
              <>
                <Text style={styles.label}>Mobile number</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05x xxx xxxx" placeholderTextColor={C.muted} />
                <Text style={styles.note}>Ready in about 15 minutes. You will get a live status on this screen.</Text>
              </>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.placeBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              <Text style={styles.placeText}>{busy ? 'Placing order…' : `${table ? 'Send to kitchen' : 'Place order'} · ${money(subtotal)}`}</Text>
            </Pressable>
            <Pressable onPress={() => Alert.alert('Clear cart?', '', [{ text: 'Cancel' }, { text: 'Clear', style: 'destructive', onPress: clear }])}>
              <Text style={styles.clear}>Clear cart</Text>
            </Pressable>
          </>
        )}
        {!!error && lines.length === 0 && <Text style={styles.error}>{error}</Text>}

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
  tableBox: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  smallBtn: { flex: 1, borderWidth: 1, borderColor: C.navy2, borderRadius: 12, padding: 10, alignItems: 'center' },
  smallBtnText: { color: C.navy2, fontWeight: '600' },
  notice: { color: C.green, marginBottom: 10 },
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
