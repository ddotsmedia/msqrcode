import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, type LoyaltyCard } from '../../src/api';
import { clearCardToken, getCardToken, setCardToken } from '../../src/storage';
import { C } from '../../src/theme';

export default function RewardsScreen() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCardToken().then((t) => {
      setToken(t);
      setReady(true);
    });
  }, []);

  const card = useQuery({
    queryKey: ['card', token],
    enabled: !!token,
    queryFn: () => getJson<LoyaltyCard>(`/loyalty/card/${token}`),
  });

  const link = async () => {
    const t = draft.trim();
    if (!t) return;
    await setCardToken(t);
    setToken(t);
    setDraft('');
  };

  const unlink = async () => {
    await clearCardToken();
    qc.removeQueries({ queryKey: ['card'] });
    setToken(null);
  };

  if (!ready) return null;

  if (!token) {
    return (
      <View style={styles.screen}>
        <Text style={styles.hero}>Rewards</Text>
        <Text style={styles.lead}>Enter the code from your rewards card to see your stamps and points.</Text>
        <TextInput
          style={styles.input}
          placeholder="Card code"
          placeholderTextColor={C.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.button} onPress={link}>
          <Text style={styles.buttonText}>Link my card</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.hero}>Rewards</Text>
      {card.isLoading && <ActivityIndicator color={C.navy2} />}
      {card.isError && <Text style={styles.lead}>We could not find this card. Check the code and try again.</Text>}
      {card.data && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stamps</Text>
          <Text style={styles.cardValue}>{card.data.stamps ?? 0}</Text>
          {card.data.points !== undefined && (
            <>
              <Text style={styles.cardLabel}>Points</Text>
              <Text style={styles.cardValue}>{card.data.points}</Text>
            </>
          )}
        </View>
      )}
      <Pressable style={styles.linkOut} onPress={unlink}>
        <Text style={styles.linkOutText}>Use a different card</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream, padding: 16, paddingTop: 40 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12 },
  lead: { fontSize: 15, color: C.muted, marginBottom: 16, lineHeight: 21 },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginBottom: 12 },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center' },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 16 },
  card: { backgroundColor: C.navy2, borderRadius: 22, padding: 20, marginTop: 8 },
  cardLabel: { color: C.gold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 },
  cardValue: { color: C.white, fontSize: 32, fontWeight: '600' },
  linkOut: { marginTop: 24, alignItems: 'center' },
  linkOutText: { color: C.brown, fontWeight: '600' },
});
