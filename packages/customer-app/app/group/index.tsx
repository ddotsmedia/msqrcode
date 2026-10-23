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

  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name ?? id;

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
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>← Back</Text>
      </Pressable>

      <Text style={s.hero}>Group order</Text>
      <Text style={s.lead}>
        Everyone adds their own drinks, then one person sends the order to the branch.
      </Text>

      {/* --- Start a group --- */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Start a group</Text>

        <Text style={s.fieldLabel}>Branch</Text>
        <View style={s.chips}>
          {pickup.map((b) => (
            <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[s.chip, branchId === b.id && s.chipOn]}>
              <Text style={[s.chipText, branchId === b.id && s.chipTextOn]}>{b.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.fieldLabel}>Your name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Ahmed"
          placeholderTextColor={C.muted}
          value={name}
          onChangeText={setName}
        />
        <Text style={s.fieldLabel}>Your mobile</Text>
        <TextInput
          style={s.input}
          placeholder="+971 50 …"
          placeholderTextColor={C.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable style={[s.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={start}>
          <Text style={s.btnText}>{busy ? 'Starting…' : '☕  Start group order'}</Text>
        </Pressable>
      </View>

      {/* --- Join with code --- */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Join with a code</Text>
        <View style={s.joinRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Group code"
            placeholderTextColor={C.muted}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
          <Pressable style={s.joinBtn} onPress={join}>
            <Text style={s.btnText}>Join</Text>
          </Pressable>
        </View>
      </View>

      {/* --- Recent groups --- */}
      {recent.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your recent groups</Text>
          {recent.map((g) => (
            <Pressable key={g.code} style={s.recentCard} onPress={() => router.push(`/group/${g.code}`)}>
              <View style={s.recentLeft}>
                <Text style={s.recentCode}>{g.code}</Text>
                {!!g.name && <Text style={s.recentName}>{g.name}</Text>}
              </View>
              <Text style={s.recentArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  back: { color: C.brown, fontWeight: '600', fontSize: 15, marginBottom: 14 },
  hero: { fontSize: 28, fontWeight: '700', color: C.navy },
  lead: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 21 },

  section: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.brown,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.navy, marginBottom: 6, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.cream,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: C.white },

  input: {
    backgroundColor: C.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.navy,
    marginBottom: 2,
  },

  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  joinBtn: {
    backgroundColor: C.navy2,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },

  button: {
    backgroundColor: C.navy2,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  btnText: { color: C.white, fontWeight: '700', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 8, fontSize: 13 },

  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.cream,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  recentLeft: { flex: 1 },
  recentCode: { fontSize: 16, fontWeight: '700', color: C.navy, letterSpacing: 1.5 },
  recentName: { fontSize: 13, color: C.muted, marginTop: 2 },
  recentArrow: { fontSize: 22, color: C.muted, fontWeight: '300' },
});
