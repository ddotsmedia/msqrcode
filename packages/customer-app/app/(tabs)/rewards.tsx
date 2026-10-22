import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson } from '../../src/api';
import { clearCardToken, getCardToken, setCardToken } from '../../src/storage';
import { registerForPush } from '../../src/push';
import { SkeletonCard } from '../../src/skeleton';
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
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
    >
      <Text style={styles.hero}>Rewards</Text>
      {card.isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
      {card.isError && <Text style={styles.lead}>We could not find this card. Check the code and try again.</Text>}
      {d && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{d.name || 'Your card'}</Text>
            <Text style={styles.big}>{d.stamps} / {d.target}</Text>
            <Text style={styles.cardSub}>{d.stamps >= d.target ? `Ready: ${d.reward_name}` : `${d.target - d.stamps} more for ${d.reward_name}`}</Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (d.stamps / d.target) * 100)}%` as any }]} />
            </View>
            <View style={styles.dots}>
              {Array.from({ length: d.target }).map((_, i) => (
                <View key={i} style={[styles.dot, i < d.stamps && styles.dotOn]} />
              ))}
            </View>
            {d.double_now && <Text style={styles.badge}>Double stamps today</Text>}
            {d.birthday_week && <Text style={styles.badge}>Birthday week: a treat is waiting</Text>}
          </View>

          <Pressable style={styles.scanBtn} onPress={() => router.push('/scan')}>
            <Text style={styles.scanText}>Scan counter code to add a stamp</Text>
          </Pressable>
          <Pressable style={styles.scanBtn} onPress={() => router.push('/gift')}>
            <Text style={styles.scanText}>Gift cards</Text>
          </Pressable>

          {!d.has_birthday && <BirthdayForm token={token} onSaved={() => qc.invalidateQueries({ queryKey: ['card', token] })} />}

          {!!d.referral_code && (
            <View style={styles.box}>
              <Text style={styles.label}>Your referral code</Text>
              <Text style={styles.code}>{d.referral_code}</Text>
              <Text style={styles.lead}>Friends who join with this code give you a bonus stamp.</Text>
            </View>
          )}

          <Text style={styles.label}>History</Text>
          {d.history.length === 0 && <Text style={styles.lead}>No activity yet.</Text>}
          {d.history.map((h, i) => (
            <View key={i} style={styles.hist}>
              <Text style={styles.histText}>{h.type.replace(/_/g, ' ')}</Text>
              <Text style={styles.histDelta}>{h.delta > 0 ? `+${h.delta}` : h.delta}</Text>
              <Text style={styles.histDate}>{new Date(h.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </>
      )}

      <Pressable onPress={unlink} style={styles.linkOut}><Text style={styles.linkOutText}>Use a different card</Text></Pressable>
      <Pressable onPress={remove} style={styles.linkOut}><Text style={styles.danger}>Delete my card</Text></Pressable>
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hero}>Rewards</Text>
      <Text style={styles.lead}>Collect a stamp with every drink. Join in seconds.</Text>
      <View style={styles.tabs}>
        <Pressable onPress={() => setMode('join')} style={[styles.tab, mode === 'join' && styles.tabOn]}><Text style={[styles.tabText, mode === 'join' && styles.tabTextOn]}>Join</Text></Pressable>
        <Pressable onPress={() => setMode('link')} style={[styles.tab, mode === 'link' && styles.tabOn]}><Text style={[styles.tabText, mode === 'link' && styles.tabTextOn]}>I have a card</Text></Pressable>
      </View>
      {mode === 'join' ? (
        <>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={C.muted} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <TextInput style={styles.input} placeholder="Birthday (optional) YYYY-MM-DD" placeholderTextColor={C.muted} value={birthday} onChangeText={setBirthday} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={join}><Text style={styles.buttonText}>{busy ? 'Joining…' : 'Join rewards'}</Text></Pressable>
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Card code" placeholderTextColor={C.muted} autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.button} onPress={link}><Text style={styles.buttonText}>Link my card</Text></Pressable>
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
    <View style={styles.box}>
      <Text style={styles.label}>Add your birthday for a treat</Text>
      <Text style={styles.lead}>You can add it once.</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} value={value} onChangeText={setValue} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={save}><Text style={styles.buttonText}>Save birthday</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 40, paddingBottom: 40 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 10 },
  lead: { fontSize: 14, color: C.muted, marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: C.navy2, borderRadius: 22, padding: 20 },
  cardLabel: { color: C.gold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  big: { color: C.white, fontSize: 34, fontWeight: '600', marginTop: 4 },
  cardSub: { color: '#b3c2dc', marginTop: 2 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#4f6e9f' },
  dotOn: { backgroundColor: C.caramel, borderColor: C.caramel },
  progressBg: { height: 8, backgroundColor: '#1e3a5f', borderRadius: 4, marginTop: 14, marginBottom: 10, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: C.caramel, borderRadius: 4 },
  badge: { color: C.gold, marginTop: 10, fontWeight: '600' },
  scanBtn: { backgroundColor: C.white, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: C.line },
  scanText: { color: C.navy2, fontWeight: '600' },
  box: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: C.line },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  code: { fontSize: 22, fontWeight: '700', color: C.navy, letterSpacing: 2 },
  hist: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.line, gap: 10 },
  histText: { flex: 1, color: C.navy, textTransform: 'capitalize' },
  histDelta: { color: C.green, fontWeight: '600' },
  histDate: { color: C.muted, fontSize: 12 },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginBottom: 10 },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center' },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c', marginBottom: 8 },
  tabs: { flexDirection: 'row', backgroundColor: '#eef2f8', borderRadius: 14, padding: 4, marginBottom: 14 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.white },
  tabText: { color: '#4f6e9f', fontWeight: '600' },
  tabTextOn: { color: C.navy },
  linkOut: { marginTop: 18, alignItems: 'center' },
  linkOutText: { color: C.brown, fontWeight: '600' },
  danger: { color: '#b91c1c', fontWeight: '600' },
});
