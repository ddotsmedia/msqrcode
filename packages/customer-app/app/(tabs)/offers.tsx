import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { getJson, money, type Category } from '../../src/api';
import { comboPrice, isLive, type Promo } from '../../src/deals';
import { SkeletonCard } from '../../src/skeleton';
import { AnimatedEmptyState, ErrorState } from '../../src/ui';
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

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: object }) {
  const translateX = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: true, friction: 9, tension: 60, delay: index * 70,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 300, delay: index * 70, useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, opacity, index]);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
}

function HappyHourCard({ item, categories, index }: { item: Promo; categories: Category[]; index: number }) {
  const countdown = useCountdown(item.ends_at ?? undefined);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
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
    <AnimatedCard index={index}>
      <Animated.View style={[styles.card, styles.hh, { transform: [{ scale: pulse }] }]}>
        <View style={styles.hhHead}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE NOW</Text>
          </View>
          {countdown ? <Text style={styles.countdown}>⏱ {countdown}</Text> : null}
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.discount_percent ? (
          <Text style={styles.desc}>
            <Text style={styles.discountNum}>{item.discount_percent}%</Text> off {categoryNames()}
          </Text>
        ) : null}
        {!!item.body && <Text style={styles.desc}>{item.body}</Text>}
        {!!item.promo_code && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>PROMO CODE</Text>
            <Text style={styles.code}>{item.promo_code}</Text>
          </View>
        )}
      </Animated.View>
    </AnimatedCard>
  );
}

function PromoCard({ item, nameOf, index }: { item: Promo; nameOf: (id: string) => string; index: number }) {
  const isCombo = !!(item.combo_product_ids?.length && comboPrice(item) != null);
  return (
    <AnimatedCard index={index}>
      <View style={[styles.card, isCombo ? styles.combo : styles.regular]}>
        {isCombo && (
          <View style={styles.comboBadgeWrap}>
            <Text style={styles.comboBadge}>COMBO DEAL</Text>
          </View>
        )}
        <Text style={styles.title}>{item.title}</Text>
        {isCombo && (
          <View style={styles.comboItems}>
            <Text style={styles.comboItemsText}>
              {(item.combo_product_ids ?? []).map(nameOf).filter(Boolean).join('  +  ')}
            </Text>
            <View style={styles.comboPriceBadge}>
              <Text style={styles.comboPriceText}>{money(comboPrice(item) ?? 0)}</Text>
            </View>
          </View>
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
            📅 Until {new Date(item.ends_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
          </Text>
        )}
      </View>
    </AnimatedCard>
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
  ].filter((sec) => sec.data.length);

  const isFirstLoad = promos.isLoading && !promos.data;
  const hasError = promos.isError && !promos.data;
  const handleRetry = () => { promos.refetch(); products.refetch(); categories.refetch(); };

  // Track global item index for staggered entrance
  let itemIdx = 0;

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
          {hasError && <ErrorState onRetry={handleRetry} />}
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item, section }) => {
        const idx = itemIdx++;
        return section.title === 'Happy hour' ? (
          <HappyHourCard item={item} categories={categories.data ?? []} index={idx} />
        ) : (
          <PromoCard item={item} nameOf={nameOf} index={idx} />
        );
      }}
      ListEmptyComponent={
        !isFirstLoad ? (
          <AnimatedEmptyState
            icon="🏷️"
            title="No offers right now"
            body="Pull down to refresh, or check back soon."
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 40, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '700', color: C.navy, marginBottom: 8 },
  section: {
    paddingVertical: 10,
    paddingTop: 18,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.brown,
  },

  card: { borderRadius: 22, padding: 18, marginBottom: 12, overflow: 'hidden' },
  hh: { backgroundColor: C.navy2 },
  regular: { backgroundColor: C.caramel },
  combo: { backgroundColor: C.brown },

  // Happy hour
  hhHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold },
  liveBadgeText: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  countdown: { color: C.gold, fontSize: 13, fontWeight: '600' },
  discountNum: { fontSize: 20, fontWeight: '700', color: C.white },

  // Combo
  comboBadgeWrap: { marginBottom: 8 },
  comboBadge: { color: '#f5e6d3', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  comboItems: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  comboItemsText: { fontSize: 14, color: '#f5e6d3', flex: 1 },
  comboPriceBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  comboPriceText: { color: C.white, fontWeight: '700', fontSize: 15 },

  title: { fontSize: 19, fontWeight: '700', color: C.white, lineHeight: 24 },
  desc: { fontSize: 14, color: '#f5e6d3', marginTop: 5, lineHeight: 20 },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 12 },
  codeLabel: { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1.5 },
  code: { fontSize: 22, fontWeight: '700', color: C.white, letterSpacing: 4, marginTop: 3 },
  validUntil: { fontSize: 12, color: '#f5e6d3', marginTop: 10, opacity: 0.8 },

  emptyCard: { backgroundColor: C.white, borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.line },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
});
