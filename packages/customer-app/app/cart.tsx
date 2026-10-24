import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getJson, money, type Branch } from '../src/api';
import { useCart } from '../src/cart';
import { getCardToken } from '../src/storage';
import { getSavedOrders, pickupSlots, placeOrder, requestService, type SavedOrder } from '../src/orders';
import { clearTable, getTable, type TableSession } from '../src/table';
import { getBusinessToken } from '../src/business';
import { LAST_BRANCH } from '../src/favs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnimatedEmptyState } from '../src/ui';
import { C } from '../src/theme';

const DELETE_THRESHOLD = 80;

type CartLineProps = {
  l: ReturnType<typeof useCart>['lines'][number];
  onSetQty: (key: string, qty: number) => void;
  onDelete: (key: string) => void;
};

function SwipeableCartLine({ l, onSetQty, onDelete }: CartLineProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 && Math.abs(gs.dy) < 12,
      onPanResponderMove: (_, gs) => {
        const x = Math.min(0, gs.dx); // only swipe left
        translateX.setValue(x);
        const pct = Math.min(1, Math.abs(x) / DELETE_THRESHOLD);
        deleteOpacity.setValue(pct);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -DELETE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }).start(() => {
            onDelete(l.key);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          Animated.timing(deleteOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={s.swipeWrap}>
      {/* Delete background */}
      <Animated.View style={[s.deleteBg, { opacity: deleteOpacity }]}>
        <Text style={s.deleteIcon}>🗑️</Text>
        <Text style={s.deleteLabel}>Remove</Text>
      </Animated.View>
      {/* Foreground card */}
      <Animated.View style={[s.line, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={{ flex: 1 }}>
          <Text style={s.lineName}>{l.name}</Text>
          {!!l.choiceLabels.length && <Text style={s.lineSub}>{l.choiceLabels.join(' · ')}</Text>}
          {!!l.note && <Text style={s.lineNote}>"{l.note}"</Text>}
          <Text style={s.linePrice}>{money((l.base_price + l.adjustment) * l.qty)}</Text>
        </View>
        <View style={s.qty}>
          <Pressable style={s.qtyBtnWrap} onPress={() => onSetQty(l.key, l.qty - 1)}>
            <Text style={s.qtyBtn}>−</Text>
          </Pressable>
          <Text style={s.qtyNum}>{l.qty}</Text>
          <Pressable style={s.qtyBtnWrap} onPress={() => onSetQty(l.key, l.qty + 1)}>
            <Text style={s.qtyBtn}>+</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export default function CartScreen() {
  const { lines, setQty, remove, clear, subtotal } = useCart();
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
  const [account, setAccount] = useState<string | null>(null);
  const [onAccount, setOnAccount] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const slots = pickupSlots();

  // Animated subtotal
  const subtotalScale = useRef(new Animated.Value(1)).current;
  const prevSubtotal = useRef(subtotal);
  useEffect(() => {
    if (prevSubtotal.current !== subtotal) {
      prevSubtotal.current = subtotal;
      Animated.sequence([
        Animated.spring(subtotalScale, { toValue: 1.12, useNativeDriver: true, friction: 6 }),
        Animated.spring(subtotalScale, { toValue: 1, useNativeDriver: true, friction: 8 }),
      ]).start();
    }
  }, [subtotal, subtotalScale]);

  useFocusEffect(
    useCallback(() => {
      getTable().then(setTableState);
      getSavedOrders().then(setRecent);
      getBusinessToken().then(setAccount);
    }, []),
  );
  useEffect(() => {
    if (!branchId && pickup.length) setBranchId(pickup[0].id);
  }, [pickup, branchId]);

  const activeBranch = table ? table.branchId : branchId;
  useEffect(() => {
    if (activeBranch) AsyncStorage.setItem(LAST_BRANCH, activeBranch).catch(() => undefined);
  }, [activeBranch]);

  const submit = async () => {
    setError('');
    if (!activeBranch) return setError('Choose a branch');
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const loyaltyToken = await getCardToken();
      const o = await placeOrder({
        branchId: activeBranch,
        pickupAt: table ? null : slot,
        name: name.trim(),
        phone: phone.trim(),
        lines,
        loyaltyToken,
        table: table?.table ?? null,
        accountToken: !table && onAccount ? account : null,
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
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Pressable onPress={() => router.back()} style={s.backRow}>
          <Text style={s.back}>← Back to menu</Text>
        </Pressable>
        <View style={s.titleRow}>
          <Text style={s.title}>Your order</Text>
          {lines.length > 0 && (
            <Animated.View style={[s.totalBadge, { transform: [{ scale: subtotalScale }] }]}>
              <Text style={s.totalBadgeText}>{money(subtotal)}</Text>
            </Animated.View>
          )}
        </View>

        {/* Table mode banner */}
        {table && (
          <View style={s.tableCard}>
            <View style={s.tableHead}>
              <Text style={s.tableIcon}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.tableTitle}>Table {table.table}</Text>
                <Text style={s.tableSub}>Staff will bring your order to you</Text>
              </View>
            </View>
            <View style={s.serviceRow}>
              <Pressable style={s.serviceBtn} onPress={() => service('staff')}>
                <Text style={s.serviceBtnIcon}>🔔</Text>
                <Text style={s.serviceBtnText}>Call staff</Text>
              </Pressable>
              <Pressable style={[s.serviceBtn, s.serviceBtnAlt]} onPress={() => service('bill')}>
                <Text style={s.serviceBtnIcon}>🧾</Text>
                <Text style={[s.serviceBtnText, { color: C.navy2 }]}>Request bill</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => clearTable().then(() => setTableState(null))}>
              <Text style={s.leaveTable}>Leave table</Text>
            </Pressable>
          </View>
        )}

        {!!notice && (
          <View style={s.noticeCard}>
            <Text style={s.noticeText}>✓ {notice}</Text>
          </View>
        )}

        {!table && (
          <View style={s.quickLinks}>
            <Pressable style={s.quickLink} onPress={() => router.push('/group')}>
              <Text style={s.quickLinkText}>👥 Group order</Text>
            </Pressable>
            <Pressable style={s.quickLink} onPress={() => router.push('/business')}>
              <Text style={s.quickLinkText}>🏢 Business account</Text>
            </Pressable>
          </View>
        )}

        {/* Cart lines */}
        {lines.length === 0 ? (
          <AnimatedEmptyState
            icon="🛒"
            title="Your cart is empty"
            body="Add something from the menu to get started."
            action="Browse the menu"
            onAction={() => router.replace('/(tabs)')}
            style={s.emptyCard}
          />
        ) : (
          <>
            {lines.map((l) => (
              <SwipeableCartLine key={l.key} l={l} onSetQty={setQty} onDelete={remove} />
            ))}

            {/* Subtotal bar */}
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>Subtotal</Text>
              <Animated.Text style={[s.subtotalValue, { transform: [{ scale: subtotalScale }] }]}>
                {money(subtotal)}
              </Animated.Text>
            </View>
          </>
        )}

        {/* Order options */}
        {lines.length > 0 && (
          <>
            {!table && (
              <>
                <Text style={s.label}>Pick up at</Text>
                <View style={s.chips}>
                  {pickup.map((b) => (
                    <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[s.chip, branchId === b.id && s.chipOn]}>
                      <Text style={[s.chipText, branchId === b.id && s.chipTextOn]}>{b.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {branches.isError && <Text style={s.error}>Could not load branches. Check your connection.</Text>}
                <Text style={s.label}>Pickup time</Text>
                <View style={s.chips}>
                  <Pressable onPress={() => setSlot(null)} style={[s.chip, slot === null && s.chipOn]}>
                    <Text style={[s.chipText, slot === null && s.chipTextOn]}>As soon as possible</Text>
                  </Pressable>
                  {slots.slice(1, 16).map((sl) => (
                    <Pressable key={sl.iso} onPress={() => setSlot(sl.iso)} style={[s.chip, slot === sl.iso && s.chipOn]}>
                      <Text style={[s.chipText, slot === sl.iso && s.chipTextOn]}>{sl.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={s.label}>Your name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={C.muted}
            />

            {!table && (
              <>
                <Text style={s.label}>Mobile number</Text>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="05x xxx xxxx"
                  placeholderTextColor={C.muted}
                />
                <Text style={s.hint}>
                  {slot
                    ? `Ready for pickup at ${slots.find((x) => x.iso === slot)?.label ?? 'your chosen time'}.`
                    : 'Ready in about 15 minutes. You will get a live status on this screen.'}
                </Text>
              </>
            )}

            {!table && account && (
              <Pressable style={[s.toggle, onAccount && s.toggleOn]} onPress={() => setOnAccount((v) => !v)}>
                <Text style={[s.toggleText, onAccount && s.toggleTextOn]}>
                  {onAccount ? '✓ ' : ''}Charge to my company account
                </Text>
              </Pressable>
            )}

            {!!error && <Text style={s.error}>{error}</Text>}

            <Pressable
              style={[s.placeBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={submit}>
              <Text style={s.placeText}>
                {busy ? 'Placing order…' : `${table ? 'Send to kitchen' : 'Place order'} · ${money(subtotal)}`}
              </Text>
            </Pressable>

            <Pressable onPress={() => Alert.alert('Clear cart?', '', [{ text: 'Cancel' }, { text: 'Clear', style: 'destructive', onPress: clear }])}>
              <Text style={s.clearBtn}>Clear cart</Text>
            </Pressable>
          </>
        )}

        {!!error && lines.length === 0 && <Text style={s.error}>{error}</Text>}

        {/* Recent orders */}
        {recent.length > 0 && (
          <>
            <Text style={s.label}>Recent orders</Text>
            {recent.slice(0, 5).map((o) => (
              <Pressable key={o.id} style={s.recentCard} onPress={() => router.push(`/order/${o.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentNo}>Order #{o.order_no}</Text>
                  <Text style={s.recentSub}>{new Date(o.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Text style={s.recentTotal}>{money(o.total)}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 50 },

  backRow: { marginBottom: 16 },
  back: { color: C.brown, fontWeight: '600', fontSize: 15 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: C.navy },
  totalBadge: { backgroundColor: C.navy2, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 },
  totalBadgeText: { color: C.white, fontWeight: '700', fontSize: 16 },

  // Table mode card
  tableCard: {
    backgroundColor: C.navy,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tableIcon: { fontSize: 26 },
  tableTitle: { color: C.white, fontWeight: '700', fontSize: 17 },
  tableSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  serviceRow: { flexDirection: 'row', gap: 10 },
  serviceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
  },
  serviceBtnAlt: { backgroundColor: C.cream },
  serviceBtnIcon: { fontSize: 16 },
  serviceBtnText: { color: C.navy, fontWeight: '600', fontSize: 14 },
  leaveTable: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 13 },

  noticeCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  noticeText: { color: '#15803d', fontWeight: '600', fontSize: 14 },

  quickLinks: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickLink: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: C.white,
  },
  quickLinkText: { color: C.navy2, fontWeight: '600', fontSize: 13 },

  // Empty state
  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 28,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: C.white, fontWeight: '600', fontSize: 15 },

  // Swipeable cart lines
  swipeWrap: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: '#ef4444',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteIcon: { fontSize: 20 },
  deleteLabel: { color: C.white, fontWeight: '700', fontSize: 12 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  lineName: { fontSize: 16, fontWeight: '600', color: C.navy },
  lineSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  lineNote: { fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 2 },
  linePrice: { fontSize: 14, fontWeight: '700', color: C.navy2, marginTop: 5 },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qtyBtnWrap: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.cream },
  qtyBtn: { fontSize: 20, color: C.navy2, fontWeight: '600', lineHeight: 24 },
  qtyNum: { fontSize: 15, fontWeight: '700', minWidth: 22, textAlign: 'center', color: C.navy },

  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 4,
  },
  subtotalLabel: { fontSize: 15, fontWeight: '600', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  subtotalValue: { fontSize: 20, fontWeight: '700', color: C.navy2 },

  // Form
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.navy2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600', fontSize: 14 },
  chipTextOn: { color: C.white },
  input: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    fontSize: 16,
    color: C.navy,
  },
  hint: { fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 18 },
  error: { color: '#b91c1c', marginTop: 10, fontWeight: '500' },
  toggle: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: C.white,
  },
  toggleOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  toggleText: { color: C.navy2, fontWeight: '600' },
  toggleTextOn: { color: C.white },
  placeBtn: {
    backgroundColor: C.navy2,
    borderRadius: 16,
    padding: 17,
    alignItems: 'center',
    marginTop: 20,
  },
  placeText: { color: C.white, fontWeight: '700', fontSize: 16 },
  clearBtn: { color: C.muted, textAlign: 'center', marginTop: 14, fontSize: 14 },

  // Recent
  recentCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentNo: { fontSize: 14, fontWeight: '600', color: C.navy },
  recentSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  recentTotal: { fontSize: 15, fontWeight: '700', color: C.navy2 },
});
