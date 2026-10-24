import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson } from '../../src/api';
import { clearCardToken, getCardToken, setCardToken } from '../../src/storage';
import { registerForPush } from '../../src/push';
import { SkeletonCard } from '../../src/skeleton';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

export type CardData = {
  name: string;
  stamps: number;
  target: number;
  reward_name: string;
  referral_code: string;
  has_birthday: boolean;
  birthday_week: boolean;
  double_now: boolean;
  history: { type: string; delta: number; created_at: string }[];
};

const post = async (path: string, body: object) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
};

// Animated stamp dot — supports a "burst" pop when a new stamp arrives
function StampDot({ filled, index, burst }: { filled: boolean; index: number; burst?: boolean }) {
  const scale = useRef(new Animated.Value(filled ? 1 : 0.8)).current;
  const glow = useRef(new Animated.Value(1)).current;

  // Mount/fill spring
  useEffect(() => {
    Animated.spring(scale, {
      toValue: filled ? 1 : 0.8,
      delay: index * 30,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [filled, index, scale]);

  // Burst pop: overshoot then settle when this dot is newly stamped
  useEffect(() => {
    if (!burst) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.6, useNativeDriver: true, friction: 4, tension: 200 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }),
    ]).start();
    Animated.sequence([
      Animated.timing(glow, { toValue: 2, duration: 180, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);

  return (
    <Animated.View style={[
      s.dot,
      filled && s.dotOn,
      { transform: [{ scale }], opacity: glow.interpolate({ inputRange: [1, 2], outputRange: [1, 1] }) },
    ]} />
  );
}

export default function RewardsScreen() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getCardToken().then((t) => {
        setToken(t);
        setReady(true);
      });
    }, []),
  );

  const card = useQuery({
    queryKey: ['card', token],
    enabled: !!token,
    queryFn: () => getJson<CardData>(`/loyalty/card/${token}`),
  });

  if (!ready) return null;
  if (!token) return <JoinCard onJoined={(t) => setToken(t)} />;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await card.refetch();
    setRefreshing(false);
  };

  const unlink = async () => {
    await clearCardToken();
    qc.removeQueries({ queryKey: ['card'] });
    setToken(null);
  };

  const remove = () =>
    Alert.alert('Delete rewards card?', 'Your stamps and history are removed. This cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await post(`/loyalty/card/${token}/delete`, {});
          if (r.ok !== true) return Alert.alert('Could not delete', r.message || 'Please try again.');
          await unlink();
        },
      },
    ]);

  const d = card.data;
  const progress = d ? Math.min(1, d.stamps / d.target) : 0;
  const isReady = d ? d.stamps >= d.target : false;

  // Track previous stamp count to detect newly-filled dot
  const prevStampsRef = useRef<number | null>(null);
  const [burstIndex, setBurstIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!d) return;
    const prev = prevStampsRef.current;
    if (prev !== null && d.stamps > prev) {
      // The dot that just filled is at index (new stamps - 1)
      setBurstIndex(d.stamps - 1);
      const t = setTimeout(() => setBurstIndex(null), 800);
      return () => clearTimeout(t);
    }
    prevStampsRef.current = d.stamps;
  }, [d?.stamps, d]);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
    >
      <Text style={s.hero}>Rewards</Text>

      {card.isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
      {card.isError && (
        <View style={s.errorCard}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorText}>We could not find this card. Check the code and try again.</Text>
        </View>
      )}

      {d && (
        <>
          {/* Main loyalty card */}
          <View style={s.card}>
            {/* Banners */}
            {d.double_now && (
              <View style={s.bannerRow}>
                <Text style={s.bannerText}>⚡ Double stamps today</Text>
              </View>
            )}
            {d.birthday_week && (
              <View style={[s.bannerRow, s.bannerBirthday]}>
                <Text style={s.bannerText}>🎂 Birthday week — a treat is waiting!</Text>
              </View>
            )}

            <Text style={s.cardLabel}>{d.name || 'Your card'}</Text>

            {/* Stamp counter */}
            <View style={s.stampRow}>
              <Text style={s.stampBig}>{d.stamps}</Text>
              <Text style={s.stampOf}>/ {d.target}</Text>
            </View>
            <Text style={s.cardSub}>
              {isReady
                ? `🎉 Ready to redeem: ${d.reward_name}`
                : `${d.target - d.stamps} more stamp${d.target - d.stamps !== 1 ? 's' : ''} for ${d.reward_name}`}
            </Text>

            {/* Progress bar */}
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
            </View>

            {/* Animated dots grid */}
            <View style={s.dotsGrid}>
              {Array.from({ length: d.target }).map((_, i) => (
                <StampDot key={i} filled={i < d.stamps} index={i} burst={burstIndex === i} />
              ))}
            </View>
          </View>

          {/* Action buttons */}
          <Pressable style={s.primaryBtn} onPress={() => router.push('/scan')}>
            <Text style={s.primaryBtnIcon}>📷</Text>
            <Text style={s.primaryBtnText}>Scan counter code to add a stamp</Text>
          </Pressable>
          <Pressable style={s.ghostBtn} onPress={() => router.push('/gift')}>
            <Text style={s.ghostBtnIcon}>🎁</Text>
            <Text style={s.ghostBtnText}>Gift cards</Text>
          </Pressable>

          {/* Birthday form */}
          {!d.has_birthday && (
            <BirthdayForm token={token} onSaved={() => qc.invalidateQueries({ queryKey: ['card', token] })} />
          )}

          {/* Referral card */}
          {!!d.referral_code && (
            <View style={s.referralCard}>
              <View style={s.referralTop}>
                <Text style={s.referralLabel}>Your referral code</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Share.share({ message: `Use my referral code ${d.referral_code} to join Milestones Rewards!` })
                  }>
                  <Text style={s.shareLink}>Share ↗</Text>
                </Pressable>
              </View>
              <Text style={s.referralCode}>{d.referral_code}</Text>
              <Text style={s.referralSub}>Friends who join with this code give you a bonus stamp.</Text>
            </View>
          )}

          {/* History */}
          <Text style={s.sectionLabel}>Stamp history</Text>
          {d.history.length === 0 && (
            <View style={s.emptyHistory}>
              <Text style={s.emptyHistIcon}>📋</Text>
              <Text style={s.emptyHistText}>No activity yet — start collecting!</Text>
            </View>
          )}
          {d.history.map((h, i) => {
            const isPositive = h.delta > 0;
            return (
              <View key={i} style={s.histRow}>
                <View style={[s.histIcon, isPositive ? s.histIconPos : s.histIconNeg]}>
                  <Text style={s.histIconText}>{isPositive ? '☕' : '🎁'}</Text>
                </View>
                <View style={s.histBody}>
                  <Text style={s.histType}>{h.type.replace(/_/g, ' ')}</Text>
                  <Text style={s.histDate}>{new Date(h.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[s.histDelta, isPositive ? s.histDeltaPos : s.histDeltaNeg]}>
                  {isPositive ? `+${h.delta}` : String(h.delta)}
                </Text>
              </View>
            );
          })}
        </>
      )}

      <View style={s.footer}>
        <Pressable onPress={unlink} style={s.footerLink}>
          <Text style={s.footerLinkText}>Use a different card</Text>
        </Pressable>
        <Text style={s.footerDivider}>·</Text>
        <Pressable onPress={remove} style={s.footerLink}>
          <Text style={s.danger}>Delete my card</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function JoinCard({ onJoined }: { onJoined: (token: string) => void }) {
  const [mode, setMode] = useState<'join' | 'link'>('join');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setError('');
    setBusy(true);
    const r = await post('/loyalty/enroll', { name: name.trim(), phone: phone.trim(), birthday: birthday.trim() || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.message || 'Could not create your card');
    await setCardToken(r.token);
    registerForPush();
    onJoined(r.token);
  };

  const link = async () => {
    setError('');
    const t = code.trim();
    if (!t) return;
    try {
      await getJson(`/loyalty/card/${t}`);
    } catch {
      return setError('We could not find a card with that code.');
    }
    await setCardToken(t);
    registerForPush();
    onJoined(t);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* Hero */}
      <View style={s.joinHero}>
        <Text style={s.joinEmoji}>☕</Text>
        <Text style={s.hero}>Rewards</Text>
        <Text style={s.joinSub}>Collect a stamp with every drink. 10 stamps = a free drink.</Text>
      </View>

      {/* Perks row */}
      <View style={s.perksRow}>
        {[['🎂', 'Birthday treat'], ['⚡', 'Double stamp days'], ['🎁', 'Gift cards']].map(([icon, label]) => (
          <View key={label} style={s.perk}>
            <Text style={s.perkIcon}>{icon}</Text>
            <Text style={s.perkLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Mode tabs */}
      <View style={s.tabs}>
        <Pressable onPress={() => setMode('join')} style={[s.tab, mode === 'join' && s.tabOn]}>
          <Text style={[s.tabText, mode === 'join' && s.tabTextOn]}>New card</Text>
        </Pressable>
        <Pressable onPress={() => setMode('link')} style={[s.tab, mode === 'link' && s.tabOn]}>
          <Text style={[s.tabText, mode === 'link' && s.tabTextOn]}>I have a card</Text>
        </Pressable>
      </View>

      {mode === 'join' ? (
        <>
          <TextInput style={ui.input} placeholder="Your name" placeholderTextColor={C.muted} value={name} onChangeText={setName} />
          <TextInput style={ui.input} placeholder="Mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <TextInput style={ui.input} placeholder="Birthday (optional) YYYY-MM-DD" placeholderTextColor={C.muted} value={birthday} onChangeText={setBirthday} />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={[ui.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={join}>
            <Text style={ui.btnText}>{busy ? 'Joining…' : 'Join rewards'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={ui.input}
            placeholder="Card code"
            placeholderTextColor={C.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={ui.button} onPress={link}>
            <Text style={ui.btnText}>Link my card</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function BirthdayForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    const r = await fetch(`${API}/loyalty/card/${token}/birthday`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ birthday: value.trim() }),
    }).then((x) => x.json().catch(() => ({})));
    if (r.ok !== true) return setError(r.message || 'Enter a valid birthday');
    onSaved();
  };
  return (
    <View style={s.birthdayBox}>
      <View style={s.birthdayHead}>
        <Text style={s.birthdayIcon}>🎂</Text>
        <View>
          <Text style={s.birthdayTitle}>Add your birthday</Text>
          <Text style={s.birthdaySub}>Get a free treat during your birthday week.</Text>
        </View>
      </View>
      <TextInput
        style={ui.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.muted}
        value={value}
        onChangeText={setValue}
      />
      {!!error && <Text style={ui.error}>{error}</Text>}
      <Pressable style={ui.button} onPress={save}>
        <Text style={ui.btnText}>Save birthday</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 40, paddingBottom: 40 },
  hero: { fontSize: 28, fontWeight: '700', color: C.navy, marginBottom: 8 },

  // Loyalty card
  card: {
    backgroundColor: C.navy,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  bannerRow: {
    backgroundColor: C.navy2,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  bannerBirthday: { backgroundColor: '#7c3aed' },
  bannerText: { color: C.gold, fontSize: 12, fontWeight: '700' },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  stampRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 4 },
  stampBig: { color: C.white, fontSize: 42, fontWeight: '700', lineHeight: 48 },
  stampOf: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: '500', paddingBottom: 6 },
  cardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: C.caramel, borderRadius: 999 },
  dotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
  },
  dotOn: { backgroundColor: C.caramel, borderColor: C.caramel },

  // Buttons
  primaryBtn: {
    backgroundColor: C.navy2,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  primaryBtnIcon: { fontSize: 18 },
  primaryBtnText: { color: C.white, fontWeight: '600', fontSize: 15, flex: 1 },
  ghostBtn: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  ghostBtnIcon: { fontSize: 18 },
  ghostBtnText: { color: C.navy2, fontWeight: '600', fontSize: 15, flex: 1 },

  // Referral
  referralCard: {
    backgroundColor: C.navy2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  referralTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  referralLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  shareLink: { color: C.gold, fontSize: 13, fontWeight: '600' },
  referralCode: { color: C.white, fontSize: 26, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
  referralSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },

  // History
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.brown,
    marginBottom: 10,
    marginTop: 4,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  histIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histIconPos: { backgroundColor: '#dcfce7' },
  histIconNeg: { backgroundColor: '#fef3c7' },
  histIconText: { fontSize: 18 },
  histBody: { flex: 1 },
  histType: { fontSize: 14, fontWeight: '600', color: C.navy, textTransform: 'capitalize', marginBottom: 2 },
  histDate: { fontSize: 12, color: C.muted },
  histDelta: { fontSize: 16, fontWeight: '700' },
  histDeltaPos: { color: C.green },
  histDeltaNeg: { color: C.brown },
  emptyHistory: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 8,
  },
  emptyHistIcon: { fontSize: 28, marginBottom: 8 },
  emptyHistText: { fontSize: 14, color: C.muted },

  // Birthday box
  birthdayBox: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  birthdayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  birthdayIcon: { fontSize: 28 },
  birthdayTitle: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 2 },
  birthdaySub: { fontSize: 13, color: C.muted },

  // Error card
  errorCard: { backgroundColor: C.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  errorIcon: { fontSize: 24, marginBottom: 8 },
  errorText: { fontSize: 14, color: C.muted, textAlign: 'center' },

  // Join screen hero
  joinHero: { alignItems: 'center', paddingVertical: 20 },
  joinEmoji: { fontSize: 48, marginBottom: 8 },
  joinSub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  // Perks row
  perksRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  perk: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  perkIcon: { fontSize: 22, marginBottom: 4 },
  perkLabel: { fontSize: 11, fontWeight: '600', color: C.navy, textAlign: 'center' },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: C.line, borderRadius: 14, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.white },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  tabTextOn: { color: C.navy },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 },
  footerLink: { paddingVertical: 4 },
  footerLinkText: { color: C.brown, fontWeight: '600', fontSize: 14 },
  footerDivider: { color: C.muted },
  danger: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
});
