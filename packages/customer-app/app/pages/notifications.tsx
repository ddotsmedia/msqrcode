import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const KEY = 'msq_notif_prefs';

type PrefKey = 'orderUpdates' | 'promotions' | 'loyaltyNews';
type Prefs = Record<PrefKey, boolean>;
const DEFAULT: Prefs = { orderUpdates: true, promotions: true, loyaltyNews: true };

async function loadPrefs(): Promise<Prefs> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}
async function savePrefs(p: Prefs) {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

const ROWS: { key: PrefKey; icon: string; title: string; sub: string }[] = [
  { key: 'orderUpdates', icon: '🛎️', title: 'Order updates', sub: 'When your order is ready for pickup or at your table.' },
  { key: 'promotions',   icon: '🏷️', title: 'Promotions',   sub: 'Special offers, limited drinks, and branch events.' },
  { key: 'loyaltyNews',  icon: '⭐', title: 'Loyalty & rewards', sub: 'Stamp milestones, birthday treats, and double-stamp days.' },
];

// Animated notification row — staggered slide-up
function NotifRow({
  r,
  index,
  isLast,
  value,
  onToggle,
}: {
  r: typeof ROWS[number];
  index: number;
  isLast: boolean;
  value: boolean;
  onToggle: () => void;
}) {
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.row, !isLast && s.rowBorder, { opacity, transform: [{ translateY }] }]}>
      <View style={s.iconBox}>
        <Text style={s.icon}>{r.icon}</Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{r.title}</Text>
        <Text style={s.rowSub}>{r.sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: C.navy2, false: C.line }}
        thumbColor={C.white}
      />
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadPrefs().then((p) => { setPrefs(p); setReady(true); }); }, []);

  // Master row entrance
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const masterY = useRef(new Animated.Value(-16)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.parallel([
      Animated.timing(masterOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(masterY, { toValue: 0, useNativeDriver: true, friction: 7 }),
    ]).start();
  }, [ready, masterOpacity, masterY]);

  // Card entrance (after master)
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    if (!ready) return;
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, delay: 80, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, delay: 80, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [ready, cardOpacity, cardY]);

  const allOn = Object.values(prefs).every(Boolean);
  const allOff = Object.values(prefs).every((v) => !v);

  const toggleAll = async () => {
    const next: Prefs = { orderUpdates: !allOn, promotions: !allOn, loyaltyNews: !allOn };
    setPrefs(next);
    await savePrefs(next);
  };

  const toggle = async (key: PrefKey) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await savePrefs(next);
  };

  if (!ready) return null;

  return (
    <Page kicker="Account" title="Notifications">
      <Text style={ui.lead}>
        Saved on this phone. Your device settings control whether notifications arrive at all.
      </Text>

      {/* Master toggle — springs down from above */}
      <Animated.View style={{ opacity: masterOpacity, transform: [{ translateY: masterY }] }}>
        <Pressable style={s.masterRow} onPress={toggleAll}>
          <View style={s.masterLeft}>
            <Text style={s.masterIcon}>🔔</Text>
            <View>
              <Text style={s.masterTitle}>{allOff ? 'All notifications off' : allOn ? 'All notifications on' : 'Some notifications on'}</Text>
              <Text style={s.masterSub}>Tap to {allOn ? 'turn all off' : 'turn all on'}</Text>
            </View>
          </View>
          <Switch
            value={allOn}
            onValueChange={toggleAll}
            trackColor={{ true: C.navy2, false: C.line }}
            thumbColor={C.white}
          />
        </Pressable>
      </Animated.View>

      <Text style={s.sectionLabel}>Choose what you receive</Text>

      {/* Card fades in, rows stagger inside */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        {ROWS.map((r, i) => (
          <NotifRow
            key={r.key}
            r={r}
            index={i}
            isLast={i === ROWS.length - 1}
            value={prefs[r.key]}
            onToggle={() => toggle(r.key)}
          />
        ))}
      </Animated.View>

      <Pressable style={s.deviceBtn} onPress={() => Linking.openSettings()}>
        <Text style={s.deviceIcon}>⚙️</Text>
        <Text style={s.deviceText}>Open device notification settings</Text>
        <Text style={s.deviceChevron}>›</Text>
      </Pressable>

      <Text style={s.footNote}>
        Even with all toggles on, notifications only appear if you have allowed them in your device settings for this app.
      </Text>
    </Page>
  );
}

const s = StyleSheet.create({
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  masterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  masterIcon: { fontSize: 24 },
  masterTitle: { fontSize: 15, fontWeight: '700', color: C.white, marginBottom: 2 },
  masterSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.brown,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: C.navy, marginBottom: 2 },
  rowSub: { fontSize: 12, color: C.muted, lineHeight: 17 },
  deviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 16,
  },
  deviceIcon: { fontSize: 18 },
  deviceText: { flex: 1, color: C.navy2, fontWeight: '600', fontSize: 14 },
  deviceChevron: { fontSize: 20, color: C.muted },
  footNote: { fontSize: 12, color: C.muted, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
});
