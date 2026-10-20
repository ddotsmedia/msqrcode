import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson, money } from '../src/api';
import { clearBusinessToken, getBusinessToken, setBusinessToken } from '../src/business';
import { C } from '../src/theme';

type Portal = {
  company: string;
  contact_name: string;
  status: string;
  credit_limit: number;
  unbilled: number;
  invoices: { id: string; number: string; month: string; order_count: number; total: number; status: string }[];
};

export default function BusinessScreen() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useFocusEffect(useCallback(() => {
    getBusinessToken().then((t) => {
      setToken(t);
      setReady(true);
    });
  }, []));

  const portal = useQuery({ queryKey: ['portal', token], enabled: !!token, queryFn: () => getJson<Portal>(`/corporate/portal/${token}`) });

  if (!ready) return null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
      <Text style={styles.hero}>Business accounts</Text>
      {token && portal.data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{portal.data.company}</Text>
            <Text style={styles.big}>{money(portal.data.unbilled)} <Text style={styles.small}>of {money(portal.data.credit_limit)} used</Text></Text>
            <Text style={styles.cardSub}>Status: {portal.data.status}</Text>
          </View>
          <Text style={styles.lead}>Pickup orders go on this account and are invoiced monthly with UAE VAT.</Text>
          <Text style={styles.label}>Invoices</Text>
          {portal.data.invoices.length === 0 && <Text style={styles.lead}>No invoices yet.</Text>}
          {portal.data.invoices.map((i) => (
            <View key={i.id} style={styles.row}>
              <Text style={styles.name}>{i.number} · {i.month}</Text>
              <Text style={styles.sub}>{i.order_count} orders · {money(i.total)} · {i.status}</Text>
            </View>
          ))}
          <Pressable onPress={() => clearBusinessToken().then(() => { setToken(null); qc.removeQueries({ queryKey: ['portal'] }); })}>
            <Text style={styles.link}>Use a different account</Text>
          </Pressable>
        </>
      ) : token ? (
        <Text style={styles.lead}>Loading your account…</Text>
      ) : (
        <>
          <LinkAccount onLinked={setToken} />
          <ApplyForm />
        </>
      )}
    </ScrollView>
  );
}

function LinkAccount({ onLinked }: { onLinked: (t: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const link = async () => {
    const t = value.trim();
    if (!t) return;
    try {
      await getJson(`/corporate/portal/${t}`);
      await setBusinessToken(t);
      onLinked(t);
    } catch {
      setError('We could not find an account with that code.');
    }
  };
  return (
    <>
      <Text style={styles.label}>I have an account</Text>
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Account code" placeholderTextColor={C.muted} autoCapitalize="none" value={value} onChangeText={setValue} />
        <Pressable style={styles.smallBtn} onPress={link}><Text style={styles.btnText}>Link</Text></Pressable>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </>
  );
}

function ApplyForm() {
  const [f, setF] = useState({ company: '', contact_name: '', email: '', phone: '', trn: '', team_size: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const send = async () => {
    setError('');
    const res = await fetch(`${API}/corporate/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...f, team_size: f.team_size ? Number(f.team_size) : undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(Array.isArray(json.message) ? json.message[0] : json.message || 'Could not send the application');
    setMsg('Thank you. We will contact you to confirm your account.');
  };
  if (msg) return <Text style={styles.lead}>{msg}</Text>;
  return (
    <>
      <Text style={styles.label}>Apply for a business account</Text>
      {(['company', 'contact_name', 'email', 'phone', 'trn', 'team_size'] as const).map((k) => (
        <TextInput
          key={k}
          style={styles.input}
          placeholder={{ company: 'Company name', contact_name: 'Contact name', email: 'Email', phone: 'Mobile number', trn: 'UAE TRN (15 digits, optional)', team_size: 'Team size (optional)' }[k]}
          placeholderTextColor={C.muted}
          keyboardType={k === 'phone' || k === 'trn' || k === 'team_size' ? 'number-pad' : k === 'email' ? 'email-address' : 'default'}
          autoCapitalize={k === 'email' ? 'none' : 'sentences'}
          value={f[k]}
          onChangeText={set(k)}
        />
      ))}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={send}><Text style={styles.btnText}>Send application</Text></Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 10 },
  hero: { fontSize: 26, fontWeight: '600', color: C.navy, marginBottom: 6 },
  lead: { fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: C.navy2, borderRadius: 22, padding: 20, marginTop: 8 },
  cardLabel: { color: C.gold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  big: { color: C.white, fontSize: 26, fontWeight: '600', marginTop: 4 },
  small: { fontSize: 14, color: '#b3c2dc' },
  cardSub: { color: '#b3c2dc', marginTop: 4 },
  row: { backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.line },
  name: { color: C.navy, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center' },
  smallBtn: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, marginBottom: 10 },
  btnText: { color: C.white, fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c', marginBottom: 8 },
  link: { color: C.brown, fontWeight: '600', textAlign: 'center', marginTop: 18 },
});
