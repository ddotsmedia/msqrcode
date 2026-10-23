import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { SkeletonCard } from '../../src/skeleton';
import { C } from '../../src/theme';

function isOpenNow(branch: Branch): boolean | undefined {
  if (branch.is_open !== undefined) return branch.is_open;
  return undefined;
}

function HoursRow({ label, hours }: { label: string; hours: string }) {
  return (
    <View style={s.hoursRow}>
      <Text style={s.hoursLabel}>{label}</Text>
      <Text style={s.hoursValue}>{hours}</Text>
    </View>
  );
}

function BranchCard({ item, index }: { item: Branch; index: number }) {
  const open = isOpenNow(item);
  const [expanded, setExpanded] = useState(false);
  const hasHours = !!(item as any).opening_hours;

  // Entrance animation staggered by index
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, friction: 8, tension: 55, delay: index * 80,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, index]);

  // Open glow pulse
  const glowOp = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!open) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOp, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [open, glowOp]);

  // Hours expand animation
  const hoursHeight = useRef(new Animated.Value(0)).current;
  const hoursOp = useRef(new Animated.Value(0)).current;
  const toggleHours = () => {
    setExpanded((prev) => !prev);
    if (!expanded) {
      Animated.parallel([
        Animated.timing(hoursHeight, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(hoursOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(hoursHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(hoursOp, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  };

  return (
    <Animated.View style={[s.card, { opacity, transform: [{ translateY }] }]}>
      {/* Open status glow strip */}
      {open !== undefined && (
        <Animated.View
          style={[
            s.statusStrip,
            { backgroundColor: open ? C.green : C.muted, opacity: open ? glowOp : 0.3 },
          ]}
        />
      )}

      {/* Header */}
      <View style={s.head}>
        <Text style={s.name}>{item.name}</Text>
        {open !== undefined && (
          <View style={[s.badge, open ? s.badgeOpen : s.badgeClosed]}>
            <Animated.View style={[s.dot, { backgroundColor: open ? C.green : C.muted, opacity: open ? glowOp : 1 }]} />
            <Text style={[s.badgeText, { color: open ? C.green : C.muted }]}>
              {open ? 'Open now' : 'Closed'}
            </Text>
          </View>
        )}
      </View>

      {/* Address & phone */}
      {!!item.address && <Text style={s.addr}>📍 {item.address}</Text>}
      {!!item.phone && <Text style={s.addr}>📞 {item.phone}</Text>}

      {/* Expandable hours */}
      {hasHours && (
        <>
          <Pressable style={s.hoursToggle} onPress={toggleHours}>
            <Text style={s.hoursToggleText}>{expanded ? '▲ Hide hours' : '▼ Opening hours'}</Text>
          </Pressable>
          <Animated.View style={{ opacity: hoursOp, maxHeight: hoursHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }), overflow: 'hidden' }}>
            <View style={s.hoursBox}>
              {typeof (item as any).opening_hours === 'string' ? (
                <Text style={s.hoursValue}>{(item as any).opening_hours}</Text>
              ) : (
                Object.entries((item as any).opening_hours as Record<string, string>).map(([day, hrs]) => (
                  <HoursRow key={day} label={day} hours={hrs} />
                ))
              )}
            </View>
          </Animated.View>
        </>
      )}

      {/* Action buttons */}
      <View style={s.btnRow}>
        {!!item.address && (
          <Pressable
            style={s.btnPrimary}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(item.address!)}`)}>
            <Text style={s.btnPrimaryText}>📍 Directions</Text>
          </Pressable>
        )}
        {!!item.phone && (
          <Pressable
            style={s.btnGhost}
            onPress={() => Linking.openURL(`tel:${item.phone}`)}>
            <Text style={s.btnGhostText}>📞 Call</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
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
      style={s.screen}
      contentContainerStyle={s.content}
      data={data ?? []}
      keyExtractor={(b) => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
      ListHeaderComponent={
        <View>
          <Text style={s.hero}>Branches</Text>
          {isFirstLoad && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
        </View>
      }
      renderItem={({ item, index }) => <BranchCard item={item} index={index} />}
      ListEmptyComponent={
        !isFirstLoad ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📍</Text>
            <Text style={s.emptyTitle}>No branches found</Text>
            <Text style={s.emptySub}>Pull down to refresh.</Text>
          </View>
        ) : null
      }
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '700', color: C.navy, marginBottom: 12, marginTop: 40 },

  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 20, borderTopRightRadius: 20 },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 4 },
  name: { fontSize: 18, fontWeight: '700', color: C.navy, flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  badgeOpen: { backgroundColor: '#dcfce7' },
  badgeClosed: { backgroundColor: '#f1f5f9' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  addr: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 19 },

  hoursToggle: { marginTop: 10 },
  hoursToggleText: { color: C.navy2, fontWeight: '600', fontSize: 13 },
  hoursBox: { backgroundColor: C.cream, borderRadius: 12, padding: 12, marginTop: 6 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hoursLabel: { fontSize: 13, color: C.navy, fontWeight: '500', textTransform: 'capitalize' },
  hoursValue: { fontSize: 13, color: C.muted },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btnPrimary: { flex: 1, backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  btnPrimaryText: { color: C.white, fontWeight: '600', fontSize: 13 },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  btnGhostText: { color: C.navy2, fontWeight: '600', fontSize: 13 },

  emptyCard: { backgroundColor: C.white, borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.line },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted },
});
