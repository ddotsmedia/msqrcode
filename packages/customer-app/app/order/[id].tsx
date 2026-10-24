import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { money } from '../../src/api';
import { getSavedOrders, trackOrder } from '../../src/orders';
import { SkeletonCard } from '../../src/skeleton';
import { C } from '../../src/theme';

const STEPS = ['placed', 'preparing', 'ready', 'completed'] as const;
const LABEL: Record<string, string> = {
  placed: 'Order received',
  preparing: 'Being prepared',
  ready: 'Ready for pickup',
  completed: 'Collected',
  cancelled: 'Cancelled',
};
const STEP_ICON: Record<string, string> = {
  placed: '✅',
  preparing: '☕',
  ready: '🛎️',
  completed: '🎉',
};
const STEP_SUB: Record<string, string> = {
  placed: 'We have your order',
  preparing: 'Your drinks are being made',
  ready: 'Come and collect your order',
  completed: 'Thanks for visiting',
};

// Countdown hook: "5m 32s left" etc.
function useCountdownTo(target: string | null | undefined): string | null {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function TrackStep({ step, index, stepIndex, total }: {
  step: typeof STEPS[number];
  index: number;
  stepIndex: number;
  total: number;
}) {
  const done = index <= stepIndex;
  const active = index === stepIndex;

  const scale = useRef(new Animated.Value(done ? 1 : 0.8)).current;
  const opacity = useRef(new Animated.Value(done ? 1 : 0.4)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: done ? 1 : 0.8, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: done ? 1 : 0.4, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [done, scale, opacity]);

  // Pulse the active step
  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulseScale]);

  const lineAnim = useRef(new Animated.Value(done && index < total - 1 ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(lineAnim, {
      toValue: done && index < total - 1 ? 1 : 0,
      duration: 500,
      delay: index * 100,
      useNativeDriver: false,
    }).start();
  }, [done, index, lineAnim, total]);

  return (
    <View style={s.stepRow}>
      <View style={s.stepLeft}>
        <Animated.View style={[
          s.stepDot,
          done && s.stepDotOn,
          active && s.stepDotActive,
          { transform: [{ scale: active ? pulseScale : scale }], opacity },
        ]}>
          <Text style={s.stepIcon}>{done ? STEP_ICON[step] : ''}</Text>
        </Animated.View>
        {index < total - 1 && (
          <View style={s.stepLine}>
            <Animated.View style={[s.stepLineFill, { height: lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        )}
      </View>
      <View style={[s.stepBody, index < total - 1 && { paddingBottom: 24 }]}>
        <Text style={[s.stepLabel, done && s.stepLabelOn, active && s.stepLabelActive]}>{LABEL[step]}</Text>
        {active && <View style={s.activePill}><Text style={s.activePillText}>In progress</Text></View>}
        {done && <Text style={s.stepSub}>{STEP_SUB[step]}</Text>}
      </View>
    </View>
  );
}

// Pulsing live dot shown while order is active
function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);
  return (
    <View style={s.liveDotWrap}>
      <Animated.View style={[s.liveDotRing, { transform: [{ scale }], opacity }]} />
      <View style={s.liveDotCore} />
    </View>
  );
}

const ACTIVE_STATUSES = new Set(['placed', 'preparing']);

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
    // Poll every 15s while active; stop when done/cancelled
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      if (!status || !ACTIVE_STATUSES.has(status)) return false;
      return 15_000;
    },
  });

  const isLive = !!data && ACTIVE_STATUSES.has(data.status);

  const stepIndex = data ? STEPS.indexOf(data.status as (typeof STEPS)[number]) : -1;
  const countdown = useCountdownTo(data?.pickup_at);

  // Celebration burst on completed
  const celebOp = useRef(new Animated.Value(0)).current;
  const celebScale = useRef(new Animated.Value(0.5)).current;
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    if (data?.status === 'ready' && prevStatus.current !== 'ready') {
      Animated.parallel([
        Animated.spring(celebScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(celebOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    // Haptic on every status change
    if (data?.status && data.status !== prevStatus.current) {
      if (data.status === 'ready' || data.status === 'completed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (prevStatus.current !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    }
    prevStatus.current = data?.status ?? null;
  }, [data?.status, celebOp, celebScale]);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable onPress={() => router.replace('/(tabs)')} style={s.backRow}>
          <Text style={s.backText}>← Back to menu</Text>
        </Pressable>

        {(!ready || isLoading) && (
          <View>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}

        {ready && !token && (
          <View style={s.infoCard}>
            <Text style={s.infoIcon}>📱</Text>
            <Text style={s.infoTitle}>Not on this phone</Text>
            <Text style={s.infoBody}>This order was not placed from this device, so live status is not available here.</Text>
          </View>
        )}

        {isError && (
          <View style={s.infoCard}>
            <Text style={s.infoIcon}>⚠️</Text>
            <Text style={s.infoTitle}>Retrying…</Text>
            <Text style={s.infoBody}>We could not load this order right now. It will retry automatically.</Text>
          </View>
        )}

        {data && (
          <>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.orderNo}>Order #{data.order_no}</Text>
              <View style={s.headerRight}>
                {isLive && (
                  <View style={s.liveChip}>
                    <LiveDot />
                    <Text style={s.liveChipText}>Live</Text>
                  </View>
                )}
                <View style={[s.statusBadge, data.status === 'cancelled' && s.statusBadgeCancelled]}>
                  <Text style={[s.statusText, data.status === 'cancelled' && s.statusTextCancelled]}>
                    {LABEL[data.status] ?? data.status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Ready for pickup banner */}
            {data.status === 'ready' && (
              <Animated.View style={[s.readyBanner, { opacity: celebOp, transform: [{ scale: celebScale }] }]}>
                <Text style={s.readyBannerIcon}>🛎️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.readyBannerTitle}>Your order is ready!</Text>
                  <Text style={s.readyBannerSub}>Come and collect at the counter</Text>
                </View>
              </Animated.View>
            )}

            {/* Pickup time card */}
            {data.pickup_at && (
              <View style={s.timeCard}>
                <Text style={s.timeIcon}>🕐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.timeLabel}>Pickup time</Text>
                  <Text style={s.timeValue}>
                    {new Date(data.pickup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {countdown && data.status !== 'completed' && data.status !== 'ready' && (
                  <View style={s.countdownChip}>
                    <Text style={s.countdownText}>{countdown} left</Text>
                  </View>
                )}
              </View>
            )}

            {/* Progress tracker */}
            {data.status !== 'cancelled' && (
              <View style={s.trackCard}>
                <Text style={s.sectionLabel}>Order progress</Text>
                {STEPS.map((step, i) => (
                  <TrackStep key={step} step={step} index={i} stepIndex={stepIndex} total={STEPS.length} />
                ))}
              </View>
            )}

            {/* Items */}
            <View style={s.itemsCard}>
              <Text style={s.sectionLabel}>Items</Text>
              {data.items.map((item, idx) => (
                <View key={idx} style={[s.item, idx < data.items.length - 1 && s.itemBorder]}>
                  <View style={s.itemQtyBox}>
                    <Text style={s.itemQty}>{item.qty}</Text>
                  </View>
                  <View style={s.itemBody}>
                    <Text style={s.itemName}>{item.name}</Text>
                    {!!item.options?.choices?.length && (
                      <Text style={s.itemSub}>{item.options.choices.map((c) => c.choice).join(' · ')}</Text>
                    )}
                    {!!item.options?.note && (
                      <Text style={s.itemNote}>"{item.options.note}"</Text>
                    )}
                  </View>
                </View>
              ))}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>{money(data.total)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  backRow: { marginBottom: 16 },
  backText: { color: C.brown, fontWeight: '600', fontSize: 15 },

  placeholder: { alignItems: 'center', paddingTop: 40 },
  placeholderText: { color: C.muted, fontSize: 15 },

  infoCard: {
    backgroundColor: C.white, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', marginTop: 20,
  },
  infoIcon: { fontSize: 36, marginBottom: 10 },
  infoTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  infoBody: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNo: { fontSize: 26, fontWeight: '700', color: C.navy },

  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#dcfce7', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  liveChipText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a', position: 'absolute' },
  liveDotRing: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a', position: 'absolute' },

  statusBadge: { backgroundColor: '#d1fae5', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  statusBadgeCancelled: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  statusTextCancelled: { color: '#991b1b' },

  readyBanner: {
    backgroundColor: C.gold,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  readyBannerIcon: { fontSize: 30 },
  readyBannerTitle: { fontSize: 17, fontWeight: '700', color: C.navy },
  readyBannerSub: { fontSize: 13, color: C.navy2, marginTop: 2 },

  timeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.navy, borderRadius: 16, padding: 14, marginBottom: 14,
  },
  timeIcon: { fontSize: 22 },
  timeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  timeValue: { fontSize: 20, fontWeight: '700', color: C.white, marginTop: 2 },
  countdownChip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  countdownText: { color: C.white, fontWeight: '600', fontSize: 13 },

  trackCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.brown, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 18 },

  stepRow: { flexDirection: 'row', gap: 14 },
  stepLeft: { alignItems: 'center', width: 36 },
  stepDot: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.line,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.line,
  },
  stepDotOn: { backgroundColor: C.caramel, borderColor: C.caramel },
  stepDotActive: { backgroundColor: C.navy2, borderColor: C.navy2 },
  stepIcon: { fontSize: 16 },
  stepLine: { width: 2, flex: 1, backgroundColor: C.line, overflow: 'hidden', marginTop: 4 },
  stepLineFill: { width: '100%', backgroundColor: C.caramel },
  stepBody: { flex: 1, paddingTop: 6 },
  stepLabel: { fontSize: 15, fontWeight: '600', color: C.muted },
  stepLabelOn: { color: C.navy },
  stepLabelActive: { color: C.navy2 },
  stepSub: { fontSize: 12, color: C.muted, marginTop: 3 },
  activePill: { backgroundColor: '#dbeafe', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start', marginTop: 5 },
  activePillText: { color: '#1d4ed8', fontSize: 11, fontWeight: '700' },

  itemsCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.line },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  itemQtyBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.cream,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemQty: { fontSize: 13, fontWeight: '700', color: C.navy2 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.navy },
  itemSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  itemNote: { fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 2 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: C.line,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 20, fontWeight: '700', color: C.navy2 },
});
