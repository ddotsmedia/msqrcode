import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { API, getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const ROLES = [
  { id: 'barista', title: 'Barista', text: 'Make great coffee and look after our guests. Full training given, no experience needed.' },
  { id: 'shift_lead', title: 'Shift lead', text: 'Run the floor, guide the team and keep service smooth. Café experience preferred.' },
  { id: 'kitchen', title: 'Kitchen & bakery', text: 'Prepare our pastries, sandwiches and desserts fresh every day.' },
  { id: 'cashier', title: 'Cashier & host', text: 'Welcome guests, take orders and handle payments with a smile.' },
];
const PERKS = ['Full barista training', 'Free coffee on shift', 'Growth to shift lead and manager', 'Branches across Abu Dhabi'];

export default function CareersScreen() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const [f, setF] = useState({ role: 'barista', name: '', phone: '', email: '', experience_years: '0', branch_id: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

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
      <Text style={ui.lead}>{PERKS.join(' · ')}</Text>
      <Text style={ui.label}>Open roles</Text>
      {ROLES.map((r) => (
        <Pressable key={r.id} style={[ui.card, f.role === r.id && { borderColor: C.navy2, borderWidth: 2 }]} onPress={() => set('role')(r.id)}>
          <Text style={ui.name}>{r.title}</Text>
          <Text style={ui.sub}>{r.text}</Text>
        </Pressable>
      ))}
      {sent ? (
        <Text style={ui.ok}>Thank you. We have received your application and will be in touch.</Text>
      ) : (
        <>
          <Text style={ui.label}>Apply</Text>
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
