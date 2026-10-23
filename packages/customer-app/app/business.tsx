import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson, money } from '../src/api';
import { clearBusinessToken, getBusinessToken, setBusinessToken } from '../src/business';
import { ui } from '../src/ui';
import { C } from '../src/theme';

type Portal = {
  company: string;
  contact_name: string;
  status: string;
  credit_limit: number;
  unbilled: number;
  invoices: { id: string; number: string; month: string; order_count: number; total: number; status: string }[];
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  paid:    { bg: '#dcfce7', text: '#16a34a', label: 'Paid' },
  pending: { bg: '#fef9c3', text: '#ca8a04', label: 'Pending' },
  overdue: { bg: '#fee2e2', text: '#dc2626', label: 'Overdue' },
};

function CreditBar({ used, limit }: { used: number; limit: number }) {
  const progress = limit > 0 ? Math.min(1, used / limit) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 700, useNativeDriver: false }).start();
  }, [progress]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const isHigh = progress > 0.8;

  return (
    <View style={cb.wrap}>
      <View style={cb.labelRow}>
        <Text style={cb.label}>Credit used</Text>
        <Text style={cb.amount}>{money(used)} <Text style={cb.of}>/ {money(limit)}</Text></Text>
      </View>
      <View style={cb.track}>
        <Animated.View style={[cb.fill, { width, backgroundColor: isHigh ? '#ef4444' : C.caramel }]} />
      </View>
      <Text style={cb.pct}>{Math.round(progress * 100)}% of your credit limit used</Text>
    </View>
  );
}

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

  const portal = useQuery({
    queryKey: ['portal', token],
    enabled: !!token,
    queryFn: () => getJson<Portal>(`/corporate/portal/${token}`),
  });

  if (!ready) return null;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </Pressable>
      <Text style={s.hero}>Business accounts</Text>

      {token && portal.data ? (
        <>
          {/* Company card */}
          <View style={s.companyCard}>
            <View style={s.companyHead}>
              <View style={s.companyIcon}>
                <Text style={s.companyIconText}>🏢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.companyName}>{portal.data.company}</Text>
                <Text style={s.companyContact}>{portal.data.contact_name}</Text>
              </View>
              <View style={[s.statusBadge,
                portal.data.status === 'active' ? s.statusActive : s.statusInactive]}>
                <Text style={[s.statusText,
                  portal.data.status === 'active' ? s.statusActiveText : s.statusInactiveText]}>
                  {portal.data.status === 'active' ? '● Active' : portal.data.status}
                </Text>
              </View>
            </View>
            <CreditBar used={portal.data.unbilled} limit={portal.data.credit_limit} />
          </View>

          <Text style={s.infoText}>
            Pickup orders go on this account and are invoiced monthly with UAE VAT.
          </Text>

          {/* Invoices */}
          <Text style={s.sectionLabel}>Invoices</Text>
          {portal.data.invoices.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>📄</Text>
              <Text style={s.emptyTitle}>No invoices yet</Text>
              <Text style={s.emptySub}>Your first invoice will appear after the end of the month.</Text>
            </View>
          ) : (
            portal.data.invoices.map((inv) => {
              const st = STATUS_COLORS[inv.status] ?? STATUS_COLORS.pending;
              return (
                <View key={inv.id} style={s.invoiceRow}>
                  <View style={s.invoiceLeft}>
                    <Text style={s.invoiceNumber}>{inv.number}</Text>
                    <Text style={s.invoiceMeta}>{inv.month} · {inv.order_count} order{inv.order_count !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={s.invoiceRight}>
                    <Text style={s.invoiceAmount}>{money(inv.total)}</Text>
                    <View style={[s.invoiceStatus, { backgroundColor: st.bg }]}>
                      <Text style={[s.invoiceStatusText, { color: st.text }]}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <Pressable
            style={s.switchLink}
            onPress={() => clearBusinessToken().then(() => {
              setToken(null);
              qc.removeQueries({ queryKey: ['portal'] });
            })}>
            <Text style={s.switchLinkText}>Use a different account</Text>
          </Pressable>
        </>
      ) : token ? (
        <View style={s.loadingCard}>
          <Text style={s.loadingText}>Loading your account…</Text>
        </View>
      ) : (
        <>
          <LinkAccount onLinked={setToken} />
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>OR APPLY</Text>
            <View style={s.dividerLine} />
          </View>
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
    <View style={s.sectionBox}>
      <View style={s.sectionBoxHead}>
        <Text style={s.sectionBoxIcon}>🔑</Text>
        <View>
          <Text style={s.sectionBoxTitle}>I have an account</Text>
          <Text style={s.sectionBoxSub}>Enter your account code to link it.</Text>
        </View>
      </View>
      <View style={s.inputRow}>
        <TextInput
          style={[ui.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Account code"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          value={value}
          onChangeText={setValue}
        />
        <Pressable style={s.linkBtn} onPress={link}>
          <Text style={s.linkBtnText}>Link</Text>
        </Pressable>
      </View>
      {!!error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}

function ApplyForm() {
  const [f, setF] = useState({ company: '', contact_name: '', email: '', phone: '', trn: '', team_size: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const send = async () => {
    setError('');
    const res = await fetch(`${API}/corporate/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...f, team_size: f.team_size ? Number(f.team_size) : undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(Array.isArray(json.message) ? json.message[0] : json.message || 'Could not send the application');
    setSent(true);
  };

  if (sent) {
    return (
      <ApplySuccess />
    );
  }

  const FIELDS: { key: keyof typeof f; placeholder: string; keyboard?: any; caps?: any }[] = [
    { key: 'company',      placeholder: 'Company name' },
    { key: 'contact_name', placeholder: 'Contact name' },
    { key: 'email',        placeholder: 'Email address',   keyboard: 'email-address', caps: 'none' },
    { key: 'phone',        placeholder: 'Mobile number',   keyboard: 'phone-pad' },
    { key: 'trn',          placeholder: 'UAE TRN (optional, 15 digits)', keyboard: 'number-pad' },
    { key: 'team_size',    placeholder: 'Team size (optional)', keyboard: 'number-pad' },
  ];

  return (
    <View style={s.sectionBox}>
      <View style={s.sectionBoxHead}>
        <Text style={s.sectionBoxIcon}>📋</Text>
        <View>
          <Text style={s.sectionBoxTitle}>Apply for a business account</Text>
          <Text style={s.sectionBoxSub}>We'll set you up within one working day.</Text>
        </View>
      </View>
      {FIELDS.map(({ key, placeholder, keyboard, caps }) => (
        <TextInput
          key={key}
          style={ui.input}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          keyboardType={keyboard ?? 'default'}
          autoCapitalize={caps ?? 'sentences'}
          value={f[key]}
          onChangeText={set(key)}
        />
      ))}
      {!!error && <Text style={ui.error}>{error}</Text>}
      <Pressable style={ui.button} onPress={send}>
        <Text style={ui.btnText}>Send application</Text>
      </Pressable>
    </View>
  );
}

function ApplySuccess() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 6 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[s.successCard, { opacity, transform: [{ translateY }] }]}>
      <Text style={s.successIcon}>✅</Text>
      <Text style={s.successTitle}>Application sent!</Text>
      <Text style={s.successSub}>
        Thank you — we will review your details and contact you within one working day to activate your account.
      </Text>
    </Animated.View>
  );
}

/* Credit bar styles */
const cb = StyleSheet.create({
  wrap: { marginTop: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  amount: { color: C.white, fontSize: 13, fontWeight: '700' },
  of: { color: 'rgba(255,255,255,0.5)', fontWeight: '400' },
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 },
  fill: { height: 8, borderRadius: 999 },
  pct: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },

  backBtn: { marginBottom: 12 },
  backText: { color: C.brown, fontWeight: '600', fontSize: 15 },
  hero: { fontSize: 26, fontWeight: '700', color: C.navy, marginBottom: 16 },

  // Company card
  companyCard: { backgroundColor: C.navy, borderRadius: 24, padding: 20, marginBottom: 16 },
  companyHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  companyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  companyIconText: { fontSize: 22 },
  companyName: { color: C.white, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  companyContact: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  statusBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusActiveText: { color: '#16a34a' },
  statusInactiveText: { color: 'rgba(255,255,255,0.6)' },

  infoText: { fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 19 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.brown,
    marginBottom: 10,
  },

  // Invoice rows
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  invoiceLeft: { flex: 1 },
  invoiceNumber: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 2 },
  invoiceMeta: { fontSize: 12, color: C.muted },
  invoiceRight: { alignItems: 'flex-end', gap: 6 },
  invoiceAmount: { fontSize: 15, fontWeight: '700', color: C.navy },
  invoiceStatus: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  invoiceStatusText: { fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyCard: { backgroundColor: C.white, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 4 },
  emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 18 },

  switchLink: { alignItems: 'center', marginTop: 20 },
  switchLinkText: { color: C.brown, fontWeight: '600', fontSize: 14 },

  loadingCard: { backgroundColor: C.white, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  loadingText: { fontSize: 14, color: C.muted },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5 },

  // Section boxes (link + apply)
  sectionBox: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  sectionBoxHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionBoxIcon: { fontSize: 28 },
  sectionBoxTitle: { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 2 },
  sectionBoxSub: { fontSize: 13, color: C.muted },

  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  linkBtn: { backgroundColor: C.navy2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20 },
  linkBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },

  // Success card
  successCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: '700', color: C.navy, marginBottom: 8 },
  successSub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
});
