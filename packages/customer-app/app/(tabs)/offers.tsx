import { useQuery } from '@tanstack/react-query';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { getJson, money, type Category } from '../../src/api';
import { comboPrice, isLive, type Promo } from '../../src/deals';
import { C } from '../../src/theme';
import type { ProductFull } from '../../src/types';

export default function OffersScreen() {
  const promos = useQuery({ queryKey: ['promotions'], queryFn: () => getJson<Promo[]>('/promotions') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => getJson<ProductFull[]>('/products') });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => getJson<Category[]>('/categories') });
  const all = promos.data ?? [];
  const name = (id: string) => products.data?.find((p) => p.id === id)?.name ?? '';

  const happy = all.filter((p) => isLive(p));
  const combos = all.filter((p) => p.combo_product_ids?.length && comboPrice(p) != null);
  const other = all.filter((p) => !isLive(p) && !(p.combo_product_ids?.length && comboPrice(p) != null) && (p.title || p.body));

  const sections = [
    { title: 'Happy hour now', data: happy },
    { title: 'Combo deals', data: combos },
    { title: 'More offers', data: other },
  ].filter((s) => s.data.length);

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={<Text style={styles.hero}>Offers</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item, section }) => (
        <View style={[styles.card, section.title === 'Happy hour now' && styles.hh]}>
          <Text style={styles.title}>{item.title}</Text>
          {section.title === 'Combo deals' && (
            <Text style={styles.desc}>
              {(item.combo_product_ids ?? []).map(name).filter(Boolean).join(' + ')} · {money(comboPrice(item) ?? 0)}
            </Text>
          )}
          {section.title === 'Happy hour now' && item.discount_percent ? (
            <Text style={styles.desc}>{item.discount_percent}% off {categoryNames(item, categories.data ?? [])}</Text>
          ) : null}
          {!!item.body && <Text style={styles.desc}>{item.body}</Text>}
          {!!item.promo_code && <Text style={styles.code}>Code: {item.promo_code}</Text>}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{promos.isLoading ? 'Loading…' : 'No offers right now. Check back soon.'}</Text>}
    />
  );
}

function categoryNames(p: Promo, cats: Category[]) {
  if (!p.category_ids?.length) return 'on everything';
  return `on ${cats.filter((c) => p.category_ids!.includes(c.id)).map((c) => c.name).join(', ')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 40, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 8 },
  section: { backgroundColor: C.cream, paddingVertical: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.brown },
  card: { backgroundColor: C.caramel, borderRadius: 20, padding: 18, marginBottom: 12 },
  hh: { backgroundColor: C.navy2 },
  title: { fontSize: 18, fontWeight: '600', color: C.white },
  desc: { fontSize: 14, color: '#f5e6d3', marginTop: 4 },
  code: { fontSize: 14, color: C.gold, marginTop: 6, fontWeight: '600' },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
