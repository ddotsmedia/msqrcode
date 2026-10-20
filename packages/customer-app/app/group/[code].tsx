import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { money } from '../../src/api';
import { useCart } from '../../src/cart';
import { findGroup, groupCall, saveGroup, type SavedGroup } from '../../src/groups';
import { C } from '../../src/theme';

type Member = { name: string; mine: boolean; lines: { name: string; qty: number; unit: number; labels: string[]; note: string | null }[]; total: number };
type Group = { code: string; branch: { id: string; name: string }; host: string; status: string; closes_at: string; members: Member[]; total: number };

export default function GroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const qc = useQueryClient();
  const { lines, clear, count } = useCart();
  const [saved, setSaved] = useState<SavedGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [joinName, setJoinName] = useState('');

  useEffect(() => {
    findGroup(String(code)).then((g) => {
      setSaved(g);
      setReady(true);
    });
  }, [code]);

  const q = useQuery({
    queryKey: ['group', code, saved?.memberKey],
    enabled: ready,
    queryFn: () => groupCall(`/${code}${saved?.memberKey ? `?key=${saved.memberKey}` : ''}`, 'GET') as Promise<Group>,
    refetchInterval: 15_000,
  });
  const g = q.data;
  const isHost = !!saved?.hostKey;

  // Adds this phone's cart to the group (replaces what it added before).
  const addMine = async () => {
    setNotice('');
    const name = (saved?.name || joinName).trim();
    if (!name) return setNotice('Please enter your name');
    try {
      const items = lines.map((l) => ({ product_id: l.product_id, qty: l.qty, choices: l.choices, note: l.note || undefined }));
      const r = await groupCall(`/${code}/items`, 'PUT', { member_key: saved?.memberKey || undefined, name, lines: items });
      if (!saved && r.member_key) {
        await saveGroup({ code: String(code), memberKey: r.member_key, name });
        setSaved({ code: String(code), memberKey: r.member_key, name });
      }
      clear();
      setNotice('Your items are in the group.');
      qc.invalidateQueries({ queryKey: ['group', code] });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not add your items');
    }
  };

  const send = () =>
    Alert.alert('Send the group order?', 'The branch receives everyone’s items as one order.', [
      { text: 'Cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            const r = await groupCall(`/${code}/submit`, 'POST', { host_key: saved?.hostKey });
            setNotice('Sent to the branch.');
            if (r.order_id) router.push(`/order/${r.order_id}`);
            qc.invalidateQueries({ queryKey: ['group', code] });
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Could not send the order');
          }
        },
      },
    ]);

  const cancel = () =>
    Alert.alert('Cancel the group order?', 'Nobody will be able to add more items.', [
      { text: 'No' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupCall(`/${code}/cancel`, 'POST', { host_key: saved?.hostKey });
            qc.invalidateQueries({ queryKey: ['group', code] });
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Could not cancel');
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
      <Text style={styles.hero}>Group {code}</Text>
      {q.isLoading && <Text style={styles.muted}>Loading…</Text>}
      {q.isError && <Text style={styles.muted}>This group could not be found.</Text>}
      {g && (
        <>
          <Text style={styles.lead}>{g.branch.name} · {g.status === 'open' ? 'Open for items' : g.status}</Text>
          {g.members.length === 0 && <Text style={styles.muted}>Nobody has added anything yet.</Text>}
          {g.members.map((m, i) => (
            <View key={i} style={[styles.member, m.mine && styles.mineBox]}>
              <Text style={styles.memberName}>{m.name}{m.mine ? ' (you)' : ''} · {money(m.total)}</Text>
              {m.lines.map((l, j) => (
                <Text key={j} style={styles.line}>{l.qty} × {l.name}{l.labels.length ? ` (${l.labels.join(', ')})` : ''}</Text>
              ))}
            </View>
          ))}
          <Text style={styles.total}>Group total {money(g.total)}</Text>

          {g.status === 'open' && (
            <>
              {!saved && <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={C.muted} value={joinName} onChangeText={setJoinName} />}
              <Pressable style={styles.button} onPress={addMine}>
                <Text style={styles.buttonText}>Add my cart ({count} items)</Text>
              </Pressable>
              {!!notice && <Text style={styles.notice}>{notice}</Text>}
              {isHost && (
                <>
                  <Pressable style={styles.button} onPress={send}><Text style={styles.buttonText}>Send to the branch</Text></Pressable>
                  <Pressable onPress={cancel}><Text style={styles.danger}>Cancel group order</Text></Pressable>
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 10 },
  hero: { fontSize: 24, fontWeight: '600', color: C.navy },
  lead: { fontSize: 14, color: C.muted, marginTop: 6 },
  muted: { color: C.muted, marginTop: 16, lineHeight: 20 },
  member: { backgroundColor: C.white, borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.line },
  mineBox: { borderColor: C.caramel },
  memberName: { fontWeight: '600', color: C.navy },
  line: { color: C.muted, marginTop: 3 },
  total: { fontSize: 17, fontWeight: '600', color: C.navy, marginTop: 14 },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 16 },
  danger: { color: '#b91c1c', textAlign: 'center', marginTop: 14, fontWeight: '600' },
  notice: { color: C.green, marginTop: 10 },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginTop: 12 },
});
