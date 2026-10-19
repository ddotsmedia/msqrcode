import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { getJson, money, type Category } from '../../src/api';
import { useCart } from '../../src/cart';
import { C } from '../../src/theme';
import type { ProductFull } from '../../src/types';

export default function MenuScreen() {
  const { count } = useCart();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => getJson<Category[]>('/categories') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => getJson<ProductFull[]>('/products') });

  const sections = (categories.data ?? [])
    .map((c) => ({ title: c.name, data: (products.data ?? []).filter((p) => p.category_id === c.id && p.status === 'active') }))
    .filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(p) => p.id}
      stickySectionHeadersEnabled
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={styles.hero}>Menu</Text>
          <Pressable style={styles.cartBtn} onPress={() => router.push('/cart')}>
            <Text style={styles.cartText}>Cart{count ? ` · ${count}` : ''}</Text>
          </Pressable>
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/product/${item.id}`)}>
          {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} /> : <View style={styles.thumb} />}
          <View style={styles.body}>
            <Text style={styles.name}>{item.name}</Text>
            {!!item.description && <Text numberOfLines={2} style={styles.desc}>{item.description}</Text>}
          </View>
          <Text style={styles.price}>{money(item.base_price)}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{categories.isLoading || products.isLoading ? 'Loading…' : 'Menu unavailable right now.'}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy },
  cartBtn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  cartText: { color: C.white, fontWeight: '600' },
  section: { backgroundColor: C.cream, paddingVertical: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.brown },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.line, marginRight: 12 },
  body: { flex: 1, paddingRight: 8 },
  name: { fontSize: 16, fontWeight: '600', color: C.navy },
  desc: { fontSize: 13, color: C.muted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '600', color: C.navy2 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
