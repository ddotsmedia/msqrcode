import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getJson, type Promotion } from '../../src/api';
import { C } from '../../src/theme';

export default function OffersScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['promotions'], queryFn: () => getJson<Promotion[]>('/promotions') });
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={<Text style={styles.hero}>Offers</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{isLoading ? 'Loading…' : 'No offers right now. Check back soon.'}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12, marginTop: 40 },
  card: { backgroundColor: C.caramel, borderRadius: 20, padding: 18, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: C.white },
  desc: { fontSize: 14, color: '#f5e6d3', marginTop: 4 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
