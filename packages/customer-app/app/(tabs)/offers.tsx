import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { getJson, money, type Category } from '../../src/api';
import { comboPrice, isLive, type Promo } from '../../src/deals';
import { SkeletonCard } from '../../src/skeleton';
import { C } from '../../src/theme';

// Countdown timer for happy-hour end
function useCountdown(target: string | undefined) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}h ${m}m left`
    : m > 0
    ? `${m}m ${s.toString().padStart(2, '0')}s left`
    : `${s}s left`;
}

function HappyHourCard({ item, categories }: { item: Promo; categories: Category[] }) {
  const countdown = useCountdown(item.ends_at ?? undefined);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  function categoryNames() {
    if (!item.category_ids?.length) return 'on everything';
    return `on ${categories.filter((c) => item.category_ids!.includes(c.id)).map((c) => c.name).join(', ')}`;
  }

  return (
    <Animated.View style={[styles.card, styles.hh, { transform: [{ scale: pulse }] }]}>
      <View style={styles.hhHead}>
        <Text style={styles.hhBadge}>⚡ LIVE NOW</Text>
        {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      {item.discount_percent ? (
        <Text style={styles.desc}>{item.discount_percent}% off {categoryNames()}</Text>
      ) : null}
      {!!item.body && <Text style={styles.desc}>{item.body}</Text>}
      {!!item.promo_code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>PROMO CODE</Text>
          <Text style={styles.code}>{item.promo_code}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function PromoCard({ item, nameOf }: { item: Promo; nameOf: (id: string) => string }) {
  const isCombo = !!(item.combo_product_ids?.length && comboPrice(item) != null);
  return (
    <View style={[styles.card, isCombo && styles.combo]}>
      {isCombo && <Text style={styles.comboBadge}>COMBO DEAL</Text>}
      <Text style={styles.title}>{item.title}</Text>
      {isCombo && (
        <Text style={styles.desc}>
          {(item.combo_product_ids ?? []).map(nameOf).filter(Boolean).join(' + ')}{' '}
          · {money(comboPrice(item) ?? 0)}
        </Text>
      )}
      {!!item.body && <Text style={styles.desc}>{item.body}</Text>}
      {!!item.promo_code && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>PROMO CODE</Text>
          <Text style={styles.code}>{item.promo_code}</Text>
        </View>
      )}
      {!!item.ends_at && !isLive(item) && (
        <Text style={styles.validUntil}>
          Until {new Date(item.ends_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
        </Text>
      )}
    </View>
  );
}

export default function OffersScreen() {
  const promos = useQuery({ queryKey: ['promotions'], queryFn: () => getJson<Promo[]>('/promotions') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => getJson<Promo[]>('/products') });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => getJson<Category[]>('/categories') });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([promos.refetch(), products.refetch(), categories.refetch()]);
    setRefreshing(false);
  };

  const nameOf = (id: string) => (products.data as any[])?.find((p: any) => p.id === id)?.name ?? '';
  const all = promos.data ?? [];
  const happy = all.filter((p) => isLive(p));
  const combos = all.filter((p) => !isLive(p) && p.combo_product_ids?.length && comboPrice(p) != null);
  const other = all.filter((p) => !isLive(p) && !(p.combo_product_ids?.length && comboPrice(p) != null) && (p.title || p.body));

  const sections = [
    { title: 'Happy hour', data: happy },
    { title: 'Combo deals', data: combos },
    { title: 'More offers', data: other },
  ].filter((s) => s.data.length);

  const isFirstLoad = promos.isLoading && !promos.data;

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(p) => p.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.hero}>Offers</Text>
          {isFirstLoad && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item, section }) =>
        section.title === 'Happy hour' ? (
          <HappyHourCard item={item} categories={categories.data ?? []} />
        ) : (
          <PromoCard item={item} nameOf={nameOf} />
        )
      }
      ListEmptyComponent={
        !isFirstLoad ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={styles.emptyTitle}>No offers right now</Text>
            <Text style={styles.emptySub}>Pull down to refresh, or check back soon.</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 40, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 8 },
  section: { paddingVertical: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.brown },
  card: { backgroundColor: C.caramel, borderRadius: 20, padding: 18, marginBottom: 12 },
  hh: { backgroundColor: C.navy2 },
  combo: { backgroundColor: C.brown },
  hhHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  hhBadge: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  countdown: { color: C.gold, fontSize: 13, fontWeight: '600' },
  comboBadge: { color: '#f5e6d3', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '600', color: C.white },
  desc: { fontSize: 14, color: '#f5e6d3', marginTop: 4 },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, marginTop: 10 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1.5 },
  code: { fontSize: 20, fontWeight: '700', color: C.white, letterSpacing: 3, marginTop: 2 },
  validUntil: { fontSize: 12, color: '#f5e6d3', marginTop: 8, opacity: 0.7 },
  emptyCard: { backgroundColor: C.white, borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.line },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
});
