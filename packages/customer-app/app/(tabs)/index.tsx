import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, money, type Category } from '../../src/api';
import { cachedJson } from '../../src/cache';
import { useCart } from '../../src/cart';
import { bestDealFor, discounted, type Promo } from '../../src/deals';
import { getFavs, getLastBranch, toggleFav } from '../../src/favs';
import { SkeletonRow } from '../../src/skeleton';
import { ErrorState } from '../../src/ui';
import { getTable, clearTable, type TableSession } from '../../src/table';
import { C } from '../../src/theme';
import type { ProductFull } from '../../src/types';

type Availability = { product_id: string; is_available: boolean };

export default function MenuScreen() {
  const { count } = useCart();
  const [table, setTableState] = useState<TableSession | null>(null);
  const [lastBranch, setLastBranch] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    getTable().then(setTableState);
    getLastBranch().then(setLastBranch);
    getFavs().then(setFavs);
  }, []));

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => cachedJson<Category[]>('categories', '/categories') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => cachedJson<ProductFull[]>('products', '/products') });
  const promos = useQuery({ queryKey: ['promotions'], queryFn: () => cachedJson<Promo[]>('promotions', '/promotions') });

  // Sold-out flags come from the branch the customer is ordering from (table, or last pickup branch).
  const branchId = table?.branchId ?? lastBranch;
  const avail = useQuery({
    queryKey: ['availability', branchId],
    enabled: !!branchId,
    queryFn: () => getJson<Availability[]>(`/branches/${branchId}/products/availability`),
  });
  const soldOut = useMemo(() => new Set((avail.data ?? []).filter((a) => !a.is_available).map((a) => a.product_id)), [avail.data]);

  const live = useMemo(() => (products.data ?? []).filter((p) => p.status === 'active'), [products.data]);
  const term = q.trim().toLowerCase();
  const searching = term.length > 0;

  const sections = useMemo(() => {
    if (searching) {
      const hits = live.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(term));
      return [{ title: 'Results', data: hits }];
    }
    const out: { title: string; data: ProductFull[] }[] = [];
    const favItems = live.filter((p) => favs.includes(p.id));
    if (favItems.length) out.push({ title: 'Your favourites', data: favItems });
    for (const c of categories.data ?? []) {
      const data = live.filter((p) => p.category_id === c.id);
      if (data.length) out.push({ title: c.name, data });
    }
    return out;
  }, [searching, term, live, favs, categories.data]);

  const onFav = async (id: string) => setFavs(await toggleFav(id));

  const isFirstLoad = (categories.isLoading || products.isLoading) && !categories.data && !products.data;
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      categories.refetch(),
      products.refetch(),
      promos.refetch(),
    ]);
    setRefreshing(false);
  };

  const hasError = categories.isError || products.isError;
  const handleRetry = () => { categories.refetch(); products.refetch(); promos.refetch(); };

  if (hasError && !categories.data && !products.data) {
    return (
      <View style={styles.screen}>
        <View style={[styles.content, { marginTop: 40 }]}>
          <View style={[styles.headerRow, { marginTop: 0 }]}>
            <Text style={styles.hero}>Menu</Text>
          </View>
          <ErrorState onRetry={handleRetry} />
        </View>
      </View>
    );
  }

  if (isFirstLoad) {
    return (
      <View style={styles.screen}>
        <View style={[styles.content, { marginTop: 40 }]}>
          <View style={[styles.headerRow, { marginTop: 0 }]}>
            <Text style={styles.hero}>Menu</Text>
          </View>
          {[1, 2, 3, 4, 5].map((k) => <SkeletonRow key={k} />)}
        </View>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(p) => p.id}
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />}
      ListHeaderComponent={
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.hero}>Menu</Text>
            <View style={styles.btnRow}>
              {!table && (
                <Pressable style={styles.scanBtn} onPress={() => router.push('/scan')}>
                  <Text style={styles.scanText}>Scan table</Text>
                </Pressable>
              )}
              <Pressable style={styles.cartBtn} onPress={() => router.push('/cart')}>
                <Text style={styles.cartText}>Cart{count ? ` · ${count}` : ''}</Text>
              </Pressable>
            </View>
          </View>
          {table && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>Ordering from table {table.table}</Text>
              <Pressable onPress={() => clearTable().then(() => setTableState(null))}>
                <Text style={styles.bannerLink}>Leave</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={styles.search}
            placeholder="Search drinks and food"
            placeholderTextColor={C.muted}
            value={q}
            onChangeText={setQ}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => {
        const isOut = soldOut.has(item.id);
        const isFav = favs.includes(item.id);
        return (
          <Pressable style={[styles.row, isOut && { opacity: 0.55 }]} onPress={() => router.push(`/product/${item.id}`)}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : <View style={styles.thumb} />}
            <View style={styles.body}>
              <Text style={styles.name}>{item.name}</Text>
              {isOut ? <Text style={styles.soldOut}>Sold out at this branch</Text> : null}
              {!!item.description && !isOut && <Text numberOfLines={2} style={styles.desc}>{item.description}</Text>}
            </View>
            {(() => {
              const deal = bestDealFor(promos.data ?? [], item.category_id);
              const list = Number(item.base_price);
              return deal?.discount_percent ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.strike}>{money(list)}</Text>
                  <Text style={styles.price}>{money(discounted(list, deal.discount_percent))}</Text>
                </View>
              ) : (
                <Text style={styles.price}>{money(list)}</Text>
              );
            })()}
            <Pressable hitSlop={10} onPress={() => onFav(item.id)} style={styles.fav} accessibilityLabel={isFav ? 'Remove favourite' : 'Add favourite'}>
              <Text style={[styles.favText, isFav && { color: C.gold }]}>{isFav ? '★' : '☆'}</Text>
            </Pressable>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        searching ? (
          <View style={styles.noResultsCard}>
            <Text style={styles.noResultsIcon}>🔍</Text>
            <Text style={styles.noResultsTitle}>Nothing matched “{q}”</Text>
            <Text style={styles.noResultsSub}>Try a different word, or browse the menu below.</Text>
            <Pressable style={styles.noResultsBtn} onPress={() => setQ('')}>
              <Text style={styles.noResultsBtnText}>Clear search</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.empty}>Menu unavailable right now.</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy },
  btnRow: { flexDirection: 'row', gap: 8 },
  scanBtn: { borderWidth: 1, borderColor: C.navy2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  scanText: { color: C.navy2, fontWeight: '600' },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy2, borderRadius: 14, padding: 12, marginBottom: 10 },
  bannerText: { color: C.white, fontWeight: '600' },
  bannerLink: { color: C.gold, fontWeight: '600' },
  cartBtn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  cartText: { color: C.white, fontWeight: '600' },
  search: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: C.navy, marginBottom: 6 },
  section: { backgroundColor: C.cream, paddingVertical: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.brown },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.line, marginRight: 12 },
  body: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '600', color: C.navy },
  desc: { fontSize: 13, color: C.muted, marginTop: 2 },
  soldOut: { fontSize: 13, color: '#b91c1c', marginTop: 2, fontWeight: '600' },
  strike: { fontSize: 12, color: C.muted, textDecorationLine: 'line-through' },
  price: { fontSize: 14, fontWeight: '600', color: C.navy2 },
  fav: { paddingLeft: 10 },
  favText: { fontSize: 22, color: C.muted },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
  noResultsCard: { backgroundColor: C.white, borderRadius: 18, padding: 24, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  noResultsIcon: { fontSize: 32, marginBottom: 10 },
  noResultsTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6, textAlign: 'center' },
  noResultsSub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  noResultsBtn: { borderWidth: 1, borderColor: C.navy2, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
  noResultsBtnText: { color: C.navy2, fontWeight: '600' },
});
