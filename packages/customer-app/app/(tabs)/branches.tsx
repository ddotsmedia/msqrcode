import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { C } from '../../src/theme';

export default function BranchesScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(b) => b.id}
      ListHeaderComponent={<Text style={styles.hero}>Branches</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{item.name}</Text>
            {item.is_open !== undefined && <Text style={[styles.badge, { color: item.is_open ? C.green : C.muted }]}>{item.is_open ? 'Open now' : 'Closed'}</Text>}
          </View>
          {!!item.address && <Text style={styles.addr}>{item.address}</Text>}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{isLoading ? 'Loading…' : 'No branches found.'}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12, marginTop: 40 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '600', color: C.navy },
  badge: { fontSize: 12, fontWeight: '600' },
  addr: { fontSize: 13, color: C.muted, marginTop: 4 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
