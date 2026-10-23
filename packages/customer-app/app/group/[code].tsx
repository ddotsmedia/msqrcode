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

function MemberCard({ m, mine }: { m: Member; mine: boolean }) {
  return (
    <View style={[s.memberCard, mine && s.memberCardMine]}>
      <View style={s.memberHead}>
        <View style={s.memberAvatar}>
          <Text style={s.memberAvatarText}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={s.memberInfo}>
          <Text style={s.memberName}>{m.name}{mine ? ' (you)' : ''}</Text>
          <Text style={s.memberCount}>{m.lines.length} item{m.lines.length !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={s.memberTotal}>{money(m.total)}</Text>
      </View>
      {m.lines.map((l, j) => (
        <View key={j} style={s.lineRow}>
          <View style={s.lineQty}>
            <Text style={s.lineQtyText}>{l.qty}</Text>
          </View>
          <View style={s.lineBody}>
            <Text style={s.lineName}>{l.name}</Text>
            {l.labels.length > 0 && <Text style={s.lineSub}>{l.labels.join(' · ')}</Text>}
            {!!l.note && <Text style={s.lineNote}>"{l.note}"</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function GroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const qc = useQueryClient();
  const { lines, clear, count } = useCart();
  const [saved, setSaved] = useState<SavedGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
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

  const addMine = async () => {
    setNotice('');
    const memberName = (saved?.name || joinName).trim();
    if (!memberName) return setNotice('Please enter your name');
    try {
      const items = lines.map((l) => ({ product_id: l.product_id, qty: l.qty, choices: l.choices, note: l.note || undefined }));
      const r = await groupCall(`/${code}/items`, 'PUT', { member_key: saved?.memberKey || undefined, name: memberName, lines: items });
      if (!saved && r.member_key) {
        await saveGroup({ code: String(code), memberKey: r.member_key, name: memberName });
        setSaved({ code: String(code), memberKey: r.member_key, name: memberName });
      }
      clear();
      setNotice('Your items are in the group.');
      setNoticeOk(true);
      qc.invalidateQueries({ queryKey: ['group', code] });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not add your items');
      setNoticeOk(false);
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
            setNoticeOk(true);
            if (r.order_id) router.push(`/order/${r.order_id}`);
            qc.invalidateQueries({ queryKey: ['group', code] });
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'Could not send the order');
            setNoticeOk(false);
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
            setNoticeOk(false);
          }
        },
      },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>← Back</Text>
      </Pressable>

      {q.isLoading && (
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>Loading group…</Text>
        </View>
      )}
      {q.isError && (
        <View style={s.errorCard}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Group not found</Text>
          <Text style={s.errorSub}>Check the code and try again.</Text>
        </View>
      )}

      {g && (
        <>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.hero}>Group order</Text>
              <Text style={s.branch}>📍 {g.branch.name}</Text>
            </View>
            <View style={[s.statusBadge, g.status !== 'open' && s.statusBadgeClosed]}>
              <Text style={[s.statusText, g.status !== 'open' && s.statusTextClosed]}>
                {g.status === 'open' ? 'Open' : g.status}
              </Text>
            </View>
          </View>

          {/* Code card */}
          <View style={s.codeCard}>
            <Text style={s.codeLabel}>Share this code</Text>
            <Text style={s.codeValue}>{g.code}</Text>
            <Text style={s.codeSub}>Others can join at Milestones → Group order → Join with a code</Text>
          </View>

          {/* Members */}
          <Text style={s.sectionLabel}>
            {g.members.length > 0 ? `${g.members.length} member${g.members.length !== 1 ? 's' : ''}` : 'No members yet'}
          </Text>
          {g.members.map((m, i) => (
            <MemberCard key={i} m={m} mine={m.mine} />
          ))}

          {/* Total */}
          {g.members.length > 0 && (
            <View style={s.totalCard}>
              <Text style={s.totalLabel}>Group total</Text>
              <Text style={s.totalValue}>{money(g.total)}</Text>
            </View>
          )}

          {/* Actions */}
          {g.status === 'open' && (
            <View style={s.actionsCard}>
              <Text style={s.sectionLabel}>Your items</Text>
              {!saved && (
                <TextInput
                  style={s.input}
                  placeholder="Your name"
                  placeholderTextColor={C.muted}
                  value={joinName}
                  onChangeText={setJoinName}
                />
              )}
              <Pressable style={s.button} onPress={addMine}>
                <Text style={s.btnText}>Add my cart ({count} item{count !== 1 ? 's' : ''})</Text>
              </Pressable>

              {!!notice && (
                <Text style={[s.notice, noticeOk && s.noticeOk]}>{notice}</Text>
              )}

              {isHost && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Host controls</Text>
                  <Pressable style={[s.button, s.buttonGold]} onPress={send}>
                    <Text style={s.btnText}>Send to the branch</Text>
                  </Pressable>
                  <Pressable style={s.dangerRow} onPress={cancel}>
                    <Text style={s.danger}>Cancel group order</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  back: { color: C.brown, fontWeight: '600', fontSize: 15, marginBottom: 16 },

  placeholder: { alignItems: 'center', paddingTop: 40 },
  placeholderText: { color: C.muted, fontSize: 15 },
  errorCard: { backgroundColor: C.white, borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.line },
  errorIcon: { fontSize: 32, marginBottom: 8 },
  errorTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 4 },
  errorSub: { fontSize: 13, color: C.muted },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  hero: { fontSize: 26, fontWeight: '700', color: C.navy },
  branch: { fontSize: 13, color: C.muted, marginTop: 4 },
  statusBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, marginTop: 4 },
  statusBadgeClosed: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  statusTextClosed: { color: C.muted },

  codeCard: {
    backgroundColor: C.navy,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  codeValue: { fontSize: 32, fontWeight: '700', color: C.gold, letterSpacing: 6 },
  codeSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center', lineHeight: 17 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.brown,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  memberCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  memberCardMine: { borderColor: C.caramel },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.navy2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: C.white },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: C.navy },
  memberCount: { fontSize: 12, color: C.muted, marginTop: 1 },
  memberTotal: { fontSize: 16, fontWeight: '700', color: C.navy2 },

  lineRow: { flexDirection: 'row', gap: 10, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.line },
  lineQty: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  lineQtyText: { fontSize: 12, fontWeight: '700', color: C.navy },
  lineBody: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '600', color: C.navy },
  lineSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  lineNote: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 1 },

  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontWeight: '700', color: C.navy2 },

  actionsCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  input: {
    backgroundColor: C.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.navy,
    marginBottom: 10,
  },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonGold: { backgroundColor: C.caramel, marginTop: 10 },
  btnText: { color: C.white, fontWeight: '700', fontSize: 16 },
  notice: { color: '#b91c1c', marginTop: 10, fontSize: 13 },
  noticeOk: { color: C.green },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  dangerRow: { alignItems: 'center', marginTop: 12 },
  danger: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
});
