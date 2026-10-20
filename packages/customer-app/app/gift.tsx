import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson, money } from '../src/api';
import { C } from '../src/theme';

const AMOUNTS = [50, 100, 200, 500];
const DESIGNS = [['classic', 'Classic'], ['birthday', 'Birthday'], ['eid', 'Eid'], ['thanks', 'Thank you']] as const;

type GiftCard = { code: string; amount: number; balance: number; status: string; design: string; from: string; to: string | null; message: string | null; expires_on: string | null };

export default function GiftScreen() {
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [design, setDesign] = useState<(typeof DESIGNS)[number][0]>('classic');
  const [buyer, setBuyer] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<GiftCard | null>(null);
  const [lookup, setLookup] = useState('');
  const [found, setFound] = useState<GiftCard | null>(null);
  const [lookupError, setLookupError] = useState('');

  const chosen = custom.trim() ? Number(custom) : amount;

  const buy = async () => {
    setError('');
    setBusy(true);
    const res = await fetch(`${API}/gift-cards/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ amount: chosen, design, buyer_name: buyer.trim(), buyer_phone: buyerPhone.trim(), recipient_name: to.trim() || undefined, message: message.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(Array.isArray(json.message) ? json.message[0] : json.message || 'Could not create the gift card');
    setCreated(json);
  };

  const check = async () => {
    setLookupError('');
    setFound(null);
    try {
      setFound(await getJson<GiftCard>(`/gift-cards/${lookup.trim().toUpperCase()}`));
    } catch {
      setLookupError('We could not find a gift card with that code.');
    }
  };

  if (created) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
        <Text style={styles.hero}>Gift card ready</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Code</Text>
          <Text style={styles.code}>{created.code}</Text>
          <Text style={styles.cardSub}>Value {money(created.amount)}</Text>
        </View>
        <Text style={styles.lead}>Pay at any Milestones branch and our staff will activate the card. Share the code with the recipient.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
      <Text style={styles.hero}>Gift cards</Text>

      <Text style={styles.label}>Amount</Text>
      <View style={styles.chips}>
        {AMOUNTS.map((a) => (
          <Pressable key={a} onPress={() => { setAmount(a); setCustom(''); }} style={[styles.chip, !custom && amount === a && styles.chipOn]}>
            <Text style={[styles.chipText, !custom && amount === a && styles.chipTextOn]}>{money(a)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="Other amount (AED 25 to 2000)" placeholderTextColor={C.muted} keyboardType="number-pad" value={custom} onChangeText={setCustom} />

      <Text style={styles.label}>Design</Text>
      <View style={styles.chips}>
        {DESIGNS.map(([id, name]) => (
          <Pressable key={id} onPress={() => setDesign(id)} style={[styles.chip, design === id && styles.chipOn]}>
            <Text style={[styles.chipText, design === id && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>From</Text>
      <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={C.muted} value={buyer} onChangeText={setBuyer} />
      <TextInput style={styles.input} placeholder="Your mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={buyerPhone} onChangeText={setBuyerPhone} />
      <Text style={styles.label}>To (optional)</Text>
      <TextInput style={styles.input} placeholder="Recipient name" placeholderTextColor={C.muted} value={to} onChangeText={setTo} />
      <TextInput style={styles.input} placeholder="Message (optional)" placeholderTextColor={C.muted} value={message} onChangeText={setMessage} multiline />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={buy}>
        <Text style={styles.buttonText}>{busy ? 'Creating…' : `Create gift card · ${money(chosen || 0)}`}</Text>
      </Pressable>

      <Text style={styles.label}>Check a balance</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Gift card code" placeholderTextColor={C.muted} autoCapitalize="characters" value={lookup} onChangeText={setLookup} />
        <Pressable style={styles.smallBtn} onPress={check}><Text style={styles.buttonText}>Check</Text></Pressable>
      </View>
      {!!lookupError && <Text style={styles.error}>{lookupError}</Text>}
      {found && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Balance</Text>
          <Text style={styles.big}>{money(found.balance)}</Text>
          <Text style={styles.cardSub}>Status: {found.status}{found.expires_on ? ` · valid until ${found.expires_on}` : ''}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 10 },
  hero: { fontSize: 26, fontWeight: '600', color: C.navy, marginBottom: 6 },
  lead: { fontSize: 14, color: C.muted, marginTop: 12, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 14 },
  smallBtn: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, marginTop: 8 },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 10 },
  card: { backgroundColor: C.navy2, borderRadius: 22, padding: 20, marginTop: 14 },
  cardLabel: { color: C.gold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  code: { color: C.white, fontSize: 26, fontWeight: '700', letterSpacing: 2, marginTop: 4 },
  big: { color: C.white, fontSize: 30, fontWeight: '600', marginTop: 4 },
  cardSub: { color: '#b3c2dc', marginTop: 4 },
});
