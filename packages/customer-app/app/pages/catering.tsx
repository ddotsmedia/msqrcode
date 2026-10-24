import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const KINDS = [
  { id: 'office', icon: '🏢', title: 'Office coffee', text: 'Coffee and pastries for meetings, trainings and team mornings.' },
  { id: 'event', icon: '🎉', title: 'Events & weddings', text: 'A barista team serving specialty coffee to your guests, from 20 to 2,000 people.' },
  { id: 'cart', icon: '☕', title: 'Coffee cart', text: 'Our mobile coffee bar at your venue, launch or exhibition stand, fully branded.' },
];

const HOW = [
  { icon: '📝', step: '1', text: 'Tell us about your event' },
  { icon: '📞', step: '2', text: 'We call you within one working day with a quote' },
  { icon: '✅', step: '3', text: 'We set up, serve and clear away' },
];

// Animated service kind card — staggered slide-up + press scale
function KindCard({
  k,
  index,
  selected,
  onPress,
}: {
  k: typeof KINDS[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 70;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        style={[s.kindCard, selected && s.kindCardOn]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Text style={s.kindIcon}>{k.icon}</Text>
        <View style={s.kindBody}>
          <Text style={[s.kindTitle, selected && s.kindTitleOn]}>{k.title}</Text>
          <Text style={s.kindText}>{k.text}</Text>
        </View>
        {selected && <Text style={s.kindCheck}>✓</Text>}
      </Pressable>
    </Animated.View>
  );
}

export default function CateringScreen() {
  const [f, setF] = useState({ kind: 'office', name: '', phone: '', email: '', company: '', event_date: '', guests: '30', location: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  // "How it works" card entrance (after kind cards)
  const howOpacity = useRef(new Animated.Value(0)).current;
  const howY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(howOpacity, { toValue: 1, duration: 240, delay: 280, useNativeDriver: true }),
      Animated.spring(howY, { toValue: 0, delay: 280, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [howOpacity, howY]);

  // Form entrance (after "how it works")
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, { toValue: 1, duration: 240, delay: 360, useNativeDriver: true }),
      Animated.spring(formY, { toValue: 0, delay: 360, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [formOpacity, formY]);

  // Submit button spring
  const btnScale = useRef(new Animated.Value(1)).current;
  const handleSend = async () => {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true, friction: 6 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
    await send();
  };

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
      {/* Service type — staggered */}
      <Text style={ui.label}>What do you need?</Text>
      {KINDS.map((k, i) => (
        <KindCard
          key={k.id}
          k={k}
          index={i}
          selected={f.kind === k.id}
          onPress={() => set('kind')(k.id)}
        />
      ))}

      {/* How it works — fades in after kind cards */}
      <Animated.View style={{ opacity: howOpacity, transform: [{ translateY: howY }] }}>
        <Text style={[ui.label, { marginTop: 20 }]}>How it works</Text>
        <View style={s.howBox}>
          {HOW.map((h, i) => (
            <View key={h.step} style={[s.howRow, i < HOW.length - 1 && s.howRowBorder]}>
              <View style={s.howBadge}>
                <Text style={s.howBadgeText}>{h.step}</Text>
              </View>
              <Text style={s.howIcon}>{h.icon}</Text>
              <Text style={s.howText}>{h.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Form / success — fades in last */}
      <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formY }] }}>
        {sent ? (
          <View style={s.successCard}>
            <Text style={s.successIcon}>🎉</Text>
            <Text style={s.successTitle}>Enquiry sent!</Text>
            <Text style={s.successSub}>We will call you within one working day with a quote.</Text>
          </View>
        ) : (
          <>
            <Text style={[ui.label, { marginTop: 20 }]}>Your enquiry</Text>
            <TextInput style={ui.input} placeholder="Your name" placeholderTextColor={C.muted} value={f.name} onChangeText={set('name')} />
            <TextInput style={ui.input} placeholder="Mobile number" placeholderTextColor={C.muted} keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
            <TextInput style={ui.input} placeholder="Email" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set('email')} />
            <TextInput style={ui.input} placeholder="Company (optional)" placeholderTextColor={C.muted} value={f.company} onChangeText={set('company')} />
            <TextInput style={ui.input} placeholder="Event date, e.g. 2026-11-01" placeholderTextColor={C.muted} value={f.event_date} onChangeText={set('event_date')} />
            <TextInput style={ui.input} placeholder="Number of guests" placeholderTextColor={C.muted} keyboardType="number-pad" value={f.guests} onChangeText={set('guests')} />
            <TextInput style={ui.input} placeholder="Venue or location" placeholderTextColor={C.muted} value={f.location} onChangeText={set('location')} />
            <TextInput style={[ui.input, ui.area]} placeholder="Anything else we should know" placeholderTextColor={C.muted} multiline value={f.message} onChangeText={set('message')} />
            {!!error && <Text style={ui.error}>{error}</Text>}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={handleSend} disabled={busy}>
                <Text style={ui.btnText}>{busy ? 'Sending…' : 'Send enquiry'}</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </Animated.View>
      <View style={{ height: 8 }} />
    </Page>
  );
}

const s = StyleSheet.create({
  kindCard: {
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
  kindCardOn: { borderColor: C.navy2, backgroundColor: '#f0f4ff' },
  kindIcon: { fontSize: 24 },
  kindBody: { flex: 1 },
  kindTitle: { fontSize: 15, fontWeight: '700', color: C.navy },
  kindTitleOn: { color: C.navy2 },
  kindText: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },
  kindCheck: { fontSize: 18, color: C.navy2, fontWeight: '700' },

  howBox: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  howRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  howBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.navy2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howBadgeText: { fontSize: 13, fontWeight: '700', color: C.white },
  howIcon: { fontSize: 18 },
  howText: { flex: 1, fontSize: 14, color: C.navy, lineHeight: 20 },

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
