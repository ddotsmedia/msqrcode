import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { SkeletonCard } from '../../src/skeleton';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

function isOpenNow(b: Branch): boolean | null {
  if (b.is_open === undefined || b.is_open === null) return null;
  return b.is_open ?? null;
}

function BranchCard({ branch, index }: { branch: Branch; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  const open = isOpenNow(branch);
  const hasMap = branch.latitude != null && branch.longitude != null;

  const openMaps = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`);
  const callBranch = () => branch.phone && Linking.openURL(`tel:${branch.phone.replace(/\s/g, '')}`);

  return (
    <Animated.View style={[s.card, { opacity, transform: [{ translateY }] }]}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{branch.name}</Text>
          {!!branch.address && <Text style={s.address}>{branch.address}</Text>}
        </View>
        {open !== null && (
          <View style={[s.badge, open ? s.badgeOpen : s.badgeClosed]}>
            <Text style={[s.badgeText, open ? s.badgeTextOpen : s.badgeTextClosed]}>
              {open ? 'Open' : 'Closed'}
            </Text>
          </View>
        )}
      </View>

<View style={s.actions}>
        {hasMap && (
          <Pressable style={s.actionBtn} onPress={openMaps}>
            <Text style={s.actionIcon}>📍</Text>
            <Text style={s.actionText}>Directions</Text>
          </Pressable>
        )}
        {!!branch.phone && (
          <Pressable style={[s.actionBtn, s.actionBtnSecondary]} onPress={callBranch}>
            <Text style={s.actionIcon}>📞</Text>
            <Text style={[s.actionText, { color: C.navy2 }]}>Call</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function MapScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => getJson<Branch[]>('/branches'),
  });

  return (
    <Page kicker="Find us" title="Branch map">
      <Text style={ui.lead}>All Milestones Coffee branches across Abu Dhabi.</Text>
      {isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
      {(data ?? []).map((b, i) => (
        <BranchCard key={b.id} branch={b} index={i} />
      ))}
      {!isLoading && (data ?? []).length === 0 && (
        <View style={ui.card}>
          <Text style={ui.name}>No branches found</Text>
          <Text style={ui.sub}>Pull down to refresh.</Text>
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 17, fontWeight: '700', color: C.navy, marginBottom: 2 },
  address: { fontSize: 13, color: C.muted, lineHeight: 18 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 10, marginTop: 2 },
  badgeOpen: { backgroundColor: '#d1fae5' },
  badgeClosed: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextOpen: { color: '#065f46' },
  badgeTextClosed: { color: '#991b1b' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
  hoursIcon: { fontSize: 13 },
  hours: { fontSize: 13, color: C.muted },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.navy2,
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnSecondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  actionIcon: { fontSize: 14 },
  actionText: { color: C.white, fontWeight: '600', fontSize: 14 },
});
