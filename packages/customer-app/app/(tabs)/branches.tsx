import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { SkeletonCard } from '../../src/skeleton';
import { C } from '../../src/theme';

function isOpenNow(branch: Branch): boolean | undefined {
  if (branch.is_open !== undefined) return branch.is_open;
  return undefined;
}

function HoursRow({ label, hours }: { label: string; hours: string }) {
  return (
    <View style={styles.hoursRow}>
      <Text style={styles.hoursLabel}>{label}</Text>
      <Text style={styles.hoursValue}>{hours}</Text>
    </View>
  );
}

export default function BranchesScreen() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isFirstLoad = isLoading && !data;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(b) => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.hero}>Branches</Text>
          {isFirstLoad && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const open = isOpenNow(item);
        return (
          <View style={styles.card}>
            {/* Header: name + open/closed badge */}
            <View style={styles.head}>
              <Text style={styles.name}>{item.name}</Text>
              {open !== undefined && (
                <View style={[styles.badge, open ? styles.badgeOpen : styles.badgeClosed]}>
                  <View style={[styles.dot, { backgroundColor: open ? C.green : C.muted }]} />
                  <Text style={[styles.badgeText, { color: open ? C.green : C.muted }]}>
                    {open ? 'Open now' : 'Closed'}
                  </Text>
                </View>
              )}
            </View>

            {/* Address */}
            {!!item.address && (
              <Text style={styles.addr}>📍 {item.address}</Text>
            )}
            {!!item.phone && (
              <Text style={styles.addr}>📞 {item.phone}</Text>
            )}

            {/* Opening hours if provided */}
            {!!(item as any).opening_hours && (
              <View style={styles.hoursBox}>
                <Text style={styles.hoursTitle}>Opening hours</Text>
                {typeof (item as any).opening_hours === 'string' ? (
                  <Text style={styles.hoursValue}>{(item as any).opening_hours}</Text>
                ) : (
                  Object.entries((item as any).opening_hours as Record<string, string>).map(([day, hrs]) => (
                    <HoursRow key={day} label={day} hours={hrs} />
                  ))
                )}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.btnRow}>
              {!!item.address && (
                <Pressable
                  style={styles.btnPrimary}
                  onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(item.address!)}`)}>
                  <Text style={styles.btnPrimaryText}>📍 Directions</Text>
                </Pressable>
              )}
              {!!item.phone && (
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                  <Text style={styles.btnGhostText}>📞 Call</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        !isFirstLoad ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No branches found</Text>
            <Text style={styles.emptySub}>Pull down to refresh.</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12, marginTop: 40 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 17, fontWeight: '600', color: C.navy, flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeOpen: { backgroundColor: '#dcfce7' },
  badgeClosed: { backgroundColor: '#f1f5f9' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  addr: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  hoursBox: { backgroundColor: C.cream, borderRadius: 12, padding: 12, marginTop: 10 },
  hoursTitle: { fontSize: 11, fontWeight: '700', color: C.brown, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hoursLabel: { fontSize: 13, color: C.navy, fontWeight: '500', textTransform: 'capitalize' },
  hoursValue: { fontSize: 13, color: C.muted },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnPrimary: { flex: 1, backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnPrimaryText: { color: C.white, fontWeight: '600', fontSize: 13 },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  btnGhostText: { color: C.navy2, fontWeight: '600', fontSize: 13 },
  emptyCard: { backgroundColor: C.white, borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.line },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted },
});
