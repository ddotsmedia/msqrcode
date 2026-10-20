import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { getGroups, groupCall, saveGroup, type SavedGroup } from '../../src/groups';
import { C } from '../../src/theme';

export default function GroupStart() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const pickup = (branches.data ?? []).filter((b) => b.pickup_enabled !== false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<SavedGroup[]>([]);

  useEffect(() => {
    if (!branchId && pickup.length) setBranchId(pickup[0].id);
  }, [pickup, branchId]);
  useEffect(() => {
    getGroups().then(setRecent);
  }, []);

  const start = async () => {
    setError('');
    if (!branchId) return setError('Choose a branch');
    setBusy(true);
    try {
      const r = await groupCall('', 'POST', { branch_id: branchId, host_name: name.trim(), host_phone: phone.trim() });
      await saveGroup({ code: r.code, memberKey: r.member_key, hostKey: r.host_key, name: name.trim() });
      router.replace(`/group/${r.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the group order');
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c) router.replace(`/group/${c}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
      <Text style={styles.hero}>Group order</Text>
      <Text style={styles.lead}>Everyone adds their own drinks, then one person sends the order to the branch.</Text>

      <Text style={styles.label}>Start a group</Text>
      <View style={styles.chips}>
        {pickup.map((b) => (
          <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[styles.chip, branchId === b.id && styles.chipOn]}>
            <Text style={[styles.chipText, branchId === b.id && styles.chipTextOn]}>{b.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={C.muted} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Your mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={start}>
        <Text style={styles.buttonText}>{busy ? 'Starting…' : 'Start group order'}</Text>
      </Pressable>

      <Text style={styles.label}>Join with a code</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Group code" placeholderTextColor={C.muted} autoCapitalize="characters" value={code} onChangeText={setCode} />
        <Pressable style={styles.smallBtn} onPress={join}><Text style={styles.buttonText}>Join</Text></Pressable>
      </View>

      {recent.length > 0 && (
        <>
          <Text style={styles.label}>Your groups</Text>
          {recent.map((g) => (
            <Pressable key={g.code} style={styles.recent} onPress={() => router.push(`/group/${g.code}`)}>
              <Text style={styles.recentText}>{g.code}</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 10 },
  hero: { fontSize: 26, fontWeight: '600', color: C.navy },
  lead: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 6, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  smallBtn: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, marginTop: 8 },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 10 },
  recent: { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  recentText: { color: C.navy, fontWeight: '600', letterSpacing: 1 },
});
