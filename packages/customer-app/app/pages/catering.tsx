import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { API, getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const KINDS = [
  { id: 'office', title: 'Office coffee', text: 'Coffee and pastries for meetings, trainings and team mornings, delivered and set up.' },
  { id: 'event', title: 'Events & weddings', text: 'A barista team serving specialty coffee to your guests, from 20 to 2,000 people.' },
  { id: 'cart', title: 'Coffee cart', text: 'Our mobile coffee bar at your venue, launch or exhibition stand, fully branded.' },
];
const STEPS = ['Tell us about your event', 'We call you within one working day with a quote', 'We set up, serve and clear away'];

export default function CateringScreen() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const [f, setF] = useState({ kind: 'office', name: '', phone: '', email: '', company: '', event_date: '', guests: '30', location: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const send = async () => {
    setError('');
    if (!f.name.trim() || !f.phone.trim()) return setError('Please add your name and phone number.');
    setBusy(true);
    try {
      const res = await fetch(`${API}/catering`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...f, guests: Number(f.guests) || undefined }),
      });
      if (!res.ok) throw new Error('send');
      setSent(true);
    } catch {
      setError('Could not send your enquiry. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page kicker="For your event" title="Catering">
      {KINDS.map((k) => (
        <Pressable key={k.id} style={[ui.card, f.kind === k.id && { borderColor: C.navy2, borderWidth: 2 }]} onPress={() => set('kind')(k.id)}>
          <Text style={ui.name}>{k.title}</Text>
          <Text style={ui.sub}>{k.text}</Text>
        </Pressable>
      ))}
      <Text style={ui.label}>How it works</Text>
      {STEPS.map((s, i) => (
        <Text key={s} style={ui.sub}>{i + 1}. {s}</Text>
      ))}
      {sent ? (
        <Text style={ui.ok}>Thank you. We will call you within one working day with a quote.</Text>
      ) : (
        <>
          <Text style={ui.label}>Your enquiry</Text>
          <TextInput style={ui.input} placeholder="Your name" placeholderTextColor={C.muted} value={f.name} onChangeText={set('name')} />
          <TextInput style={ui.input} placeholder="Mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
          <TextInput style={ui.input} placeholder="Email" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
          <TextInput style={ui.input} placeholder="Company (optional)" placeholderTextColor={C.muted} value={f.company} onChangeText={set('company')} />
          <TextInput style={ui.input} placeholder="Event date, e.g. 2026-11-01" placeholderTextColor={C.muted} value={f.event_date} onChangeText={set('event_date')} />
          <TextInput style={ui.input} placeholder="Number of guests" placeholderTextColor={C.muted} keyboardType="number-pad" value={f.guests} onChangeText={set('guests')} />
          <TextInput style={ui.input} placeholder="Venue or location" placeholderTextColor={C.muted} value={f.location} onChangeText={set('location')} />
          <TextInput style={[ui.input, ui.area]} placeholder="Anything else we should know" placeholderTextColor={C.muted} multiline value={f.message} onChangeText={set('message')} />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
            <Text style={ui.btnText}>{busy ? 'Sending…' : 'Send enquiry'}</Text>
          </Pressable>
        </>
      )}
      <View style={{ height: 8 }} />
    </Page>
  );
}
