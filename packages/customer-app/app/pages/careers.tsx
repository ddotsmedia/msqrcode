import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const ROLES = [
  { id: 'barista', icon: '☕', title: 'Barista', text: 'Make great coffee and look after our guests. Full training given, no experience needed.' },
  { id: 'shift_lead', icon: '⭐', title: 'Shift lead', text: 'Run the floor, guide the team and keep service smooth. Café experience preferred.' },
  { id: 'kitchen', icon: '🥐', title: 'Kitchen & bakery', text: 'Prepare our pastries, sandwiches and desserts fresh every day.' },
  { id: 'cashier', icon: '😊', title: 'Cashier & host', text: 'Welcome guests, take orders and handle payments with a smile.' },
];

const PERKS = [
  { icon: '🎓', text: 'Full barista training' },
  { icon: '☕', text: 'Free coffee on shift' },
  { icon: '📈', text: 'Growth to shift lead and manager' },
  { icon: '📍', text: 'Branches across Abu Dhabi' },
];

export default function CareersScreen() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const [f, setF] = useState({ role: 'barista', name: '', phone: '', email: '', experience_years: '0', branch_id: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const send = async () => {
    setError('');
    if (!f.name.trim() || !f.phone.trim()) return setError('Please add your name and phone number.');
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(f).forEach(([k, v]) => v && data.append(k, v));
      const res = await fetch(`${API}/careers`, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('send');
      setSent(true);
    } catch {
      setError('Could not send your application. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page kicker="Join us" title="Careers">

      {/* Perks strip */}
      <View style={s.perksRow}>
        {PERKS.map((p) => (
          <View key={p.text} style={s.perk}>
            <Text style={s.perkIcon}>{p.icon}</Text>
            <Text style={s.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>

      {/* Open roles */}
      <Text style={[ui.label, { marginTop: 20 }]}>Open roles</Text>
      {ROLES.map((r) => (
        <Pressable
          key={r.id}
          style={[s.roleCard, f.role === r.id && s.roleCardOn]}
          onPress={() => set('role')(r.id)}
        >
          <View style={[s.roleIconBox, f.role === r.id && s.roleIconBoxOn]}>
            <Text style={s.roleIcon}>{r.icon}</Text>
          </View>
          <View style={s.roleBody}>
            <Text style={[s.roleTitle, f.role === r.id && s.roleTitleOn]}>{r.title}</Text>
            <Text style={s.roleSub}>{r.text}</Text>
          </View>
          {f.role === r.id && <Text style={s.roleCheck}>✓</Text>}
        </Pressable>
      ))}

      {/* Application form or success */}
      {sent ? (
        <View style={s.successCard}>
          <Text style={s.successIcon}>🎉</Text>
          <Text style={s.successTitle}>Application sent!</Text>
          <Text style={s.successSub}>We have received your application and will be in touch.</Text>
        </View>
      ) : (
        <>
          <Text style={[ui.label, { marginTop: 20 }]}>Apply</Text>
          <TextInput style={ui.input} placeholder="Full name" placeholderTextColor={C.muted} value={f.name} onChangeText={set('name')} />
          <TextInput style={ui.input} placeholder="Mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
          <TextInput style={ui.input} placeholder="Email" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
          <TextInput style={ui.input} placeholder="Years of experience" placeholderTextColor={C.muted} keyboardType="number-pad" value={f.experience_years} onChangeText={set('experience_years')} />

          <Text style={ui.label}>Preferred branch</Text>
          <View style={ui.chips}>
            {(branches.data ?? []).map((b) => (
              <Pressable key={b.id} style={[ui.chip, f.branch_id === b.id && ui.chipOn]} onPress={() => set('branch_id')(f.branch_id === b.id ? '' : b.id)}>
                <Text style={[ui.chipText, f.branch_id === b.id && ui.chipTextOn]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput style={[ui.input, ui.area]} placeholder="Tell us about yourself (optional)" placeholderTextColor={C.muted} multiline value={f.message} onChangeText={set('message')} />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
            <Text style={ui.btnText}>{busy ? 'Sending…' : 'Send application'}</Text>
          </Pressable>
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  perkIcon: { fontSize: 14 },
  perkText: { fontSize: 12, fontWeight: '600', color: C.navy },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: C.line,
  },
  roleCardOn: { borderColor: C.navy2, backgroundColor: '#f0f4ff' },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBoxOn: { backgroundColor: C.navy2 },
  roleIcon: { fontSize: 22 },
  roleBody: { flex: 1 },
  roleTitle: { fontSize: 15, fontWeight: '700', color: C.navy },
  roleTitleOn: { color: C.navy2 },
  roleSub: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  roleCheck: { fontSize: 18, color: C.navy2, fontWeight: '700' },

  successCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  successIcon: { fontSize: 44, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: '700', color: C.navy, marginBottom: 6 },
  successSub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21 },
});
