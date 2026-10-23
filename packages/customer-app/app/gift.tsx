import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, money } from '../src/api';
import { Page, ui } from '../src/ui';
import { C } from '../src/theme';

const AMOUNTS = [50, 100, 200, 500];
const DESIGNS = [
  ['classic',  '☕', 'Classic',  '#1e3a5f'],
  ['birthday', '🎂', 'Birthday', '#7c3aed'],
  ['eid',      '🌙', 'Eid',      '#065f46'],
  ['thanks',   '💛', 'Thank You','#92400e'],
] as const;

type Design = typeof DESIGNS[number][0];

function GiftCardPreview({ design, amount }: { design: Design; amount: number }) {
  const row = DESIGNS.find((d) => d[0] === design) ?? DESIGNS[0];
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [design]);

  return (
    <Animated.View style={[s.previewCard, { backgroundColor: row[3], transform: [{ scale }], opacity }]}>
      <View style={s.previewTop}>
        <Text style={s.previewEmoji}>{row[1]}</Text>
        <View>
          <Text style={s.previewBrand}>MILESTONES COFFEE</Text>
          <Text style={s.previewDesignName}>{row[2]}</Text>
        </View>
      </View>
      <Text style={s.previewAmount}>{money(amount)}</Text>
      <Text style={s.previewCode}>••••  ••••  ••••</Text>
    </Animated.View>
  );
}

function SuccessView({ code, amount }: { code: string; amount: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 6 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();
  }, [opacity, translateY, scale]);

  return (
    <Animated.View style={[s.successWrap, { opacity, transform: [{ translateY }, { scale }] }]}>
      <Text style={s.successEmoji}>🎁</Text>
      <Text style={s.successTitle}>Gift card created!</Text>
      <Text style={s.successSub}>Share this code with your recipient.</Text>
      <View style={s.codeCard}>
        <Text style={s.codeLabel}>GIFT CARD CODE</Text>
        <Text style={s.codeValue}>{code}</Text>
        <Text style={s.codeAmount}>{money(amount)}</Text>
      </View>
      <Text style={s.successHint}>Take a screenshot to save the code.</Text>
    </Animated.View>
  );
}

function BalanceResult({ balance }: { balance: number }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, []);
  return (
    <Animated.View style={[s.balanceResult, { transform: [{ scale }] }]}>
      <Text style={s.balanceIcon}>💳</Text>
      <Text style={s.balanceLabel}>Current balance</Text>
      <Text style={s.balanceAmount}>{money(balance)}</Text>
    </Animated.View>
  );
}

export default function GiftScreen() {
  const [amount, setAmount] = useState(100);
  const [customRaw, setCustomRaw] = useState('');
  const [design, setDesign] = useState<Design>('classic');
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ code: string } | null>(null);

  const [balanceCode, setBalanceCode] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [found, setFound] = useState<{ balance: number } | null>(null);

  const effectiveAmount = customRaw
    ? Math.max(10, Math.min(5000, Number(customRaw.replace(/[^\d]/g, '')) || amount))
    : amount;

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/gift-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          design,
          recipient_name: recipientName.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not create gift card');
      setCreated(json);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const checkBalance = async () => {
    setBalanceError('');
    setFound(null);
    const t = balanceCode.trim();
    if (!t) return;
    setCheckBusy(true);
    try {
      const res = await fetch(`${API}/gift-cards/${t}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Card not found');
      setFound(json);
    } catch (e: any) {
      setBalanceError(e.message || 'Card not found. Check the code and try again.');
    } finally {
      setCheckBusy(false);
    }
  };

  if (created) {
    return (
      <Page kicker="Gift" title="Gift Card">
        <SuccessView code={created.code} amount={effectiveAmount} />
      </Page>
    );
  }

  return (
    <Page kicker="Gift" title="Gift Card">
      {/* Design picker */}
      <Text style={ui.label}>Design</Text>
      <View style={s.designRow}>
        {DESIGNS.map(([id, icon, label, color]) => (
          <Pressable
            key={id}
            style={[s.designChip, design === id && { borderColor: color, borderWidth: 2 }]}
            onPress={() => setDesign(id)}>
            <View style={[s.designIconBox, { backgroundColor: color }]}>
              <Text style={s.designIcon}>{icon}</Text>
            </View>
            <Text style={[s.designLabel, design === id && { color: C.navy, fontWeight: '700' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Live preview */}
      <GiftCardPreview design={design} amount={effectiveAmount} />

      {/* Amount picker */}
      <Text style={ui.label}>Amount (AED)</Text>
      <View style={ui.chips}>
        {AMOUNTS.map((a) => (
          <Pressable
            key={a}
            style={[ui.chip, amount === a && !customRaw && ui.chipOn]}
            onPress={() => { setAmount(a); setCustomRaw(''); }}>
            <Text style={[ui.chipText, amount === a && !customRaw && ui.chipTextOn]}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={ui.input}
        placeholder="Or enter custom amount…"
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        value={customRaw}
        onChangeText={setCustomRaw}
      />

      {/* Optional details */}
      <Text style={ui.label}>Recipient name (optional)</Text>
      <TextInput
        style={ui.input}
        placeholder="e.g. Sarah"
        placeholderTextColor={C.muted}
        value={recipientName}
        onChangeText={setRecipientName}
      />
      <Text style={ui.label}>Personal note (optional)</Text>
      <TextInput
        style={[ui.input, ui.area]}
        placeholder="A short message for the recipient…"
        placeholderTextColor={C.muted}
        multiline
        maxLength={200}
        value={note}
        onChangeText={setNote}
      />

      {!!error && <Text style={ui.error}>{error}</Text>}
      <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={create} disabled={busy}>
        <Text style={ui.btnText}>{busy ? 'Creating…' : `Create ${money(effectiveAmount)} Gift Card`}</Text>
      </Pressable>

      {/* Divider */}
      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerLabel}>CHECK A BALANCE</Text>
        <View style={s.dividerLine} />
      </View>

      {/* Balance check */}
      <View style={s.balanceSection}>
        <TextInput
          style={ui.input}
          placeholder="Enter gift card code…"
          placeholderTextColor={C.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          value={balanceCode}
          onChangeText={(t) => { setBalanceCode(t); setFound(null); setBalanceError(''); }}
        />
        {!!balanceError && <Text style={ui.error}>{balanceError}</Text>}
        <Pressable
          style={[ui.button, { backgroundColor: C.navy }, checkBusy && { opacity: 0.6 }]}
          onPress={checkBalance}
          disabled={checkBusy}>
          <Text style={ui.btnText}>{checkBusy ? 'Checking…' : 'Check balance'}</Text>
        </Pressable>
        {found && <BalanceResult balance={found.balance} />}
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  // Design picker
  designRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  designChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
    gap: 6,
  },
  designIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  designIcon: { fontSize: 18 },
  designLabel: { fontSize: 11, color: C.muted, textAlign: 'center' },

  // Card preview
  previewCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  previewEmoji: { fontSize: 32 },
  previewBrand: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  previewDesignName: { color: C.white, fontSize: 16, fontWeight: '700', marginTop: 2 },
  previewAmount: { color: C.white, fontSize: 32, fontWeight: '700', letterSpacing: 1 },
  previewCode: { color: 'rgba(255,255,255,0.4)', fontSize: 14, letterSpacing: 4, marginTop: 8 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5 },

  // Balance section
  balanceSection: { marginBottom: 8 },
  balanceResult: {
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginTop: 14,
  },
  balanceIcon: { fontSize: 32, marginBottom: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  balanceAmount: { color: C.white, fontSize: 32, fontWeight: '700' },

  // Success
  successWrap: { alignItems: 'center', paddingTop: 20 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '700', color: C.navy, marginBottom: 8 },
  successSub: { fontSize: 15, color: C.muted, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  codeCard: { backgroundColor: C.navy, borderRadius: 20, padding: 24, alignItems: 'center', width: '100%', marginBottom: 16 },
  codeLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  codeValue: { color: C.white, fontSize: 28, fontWeight: '700', letterSpacing: 4, marginBottom: 8 },
  codeAmount: { color: C.gold, fontSize: 20, fontWeight: '700' },
  successHint: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
