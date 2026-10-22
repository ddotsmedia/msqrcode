import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getJson, money } from '../../src/api';
import { getFavs, toggleFav } from '../../src/favs';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';
import type { ProductFull } from '../../src/types';

export default function FavouritesScreen() {
  const qc = useQueryClient();
  const [favIds, setFavIds] = useState<string[]>([]);

  useFocusEffect(useCallback(() => { getFavs().then(setFavIds); }, []));

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getJson<ProductFull[]>('/products'),
  });

  const favProducts = allProducts.filter((p) => favIds.includes(p.id) && p.status === 'active');

  const onRemove = async (id: string) => {
    const next = await toggleFav(id);
    setFavIds(next);
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  return (
    <Page kicker="Account" title="Favourites">
      {isLoading ? <Text style={ui.lead}>Loading…</Text> : null}
      {!isLoading && favProducts.length === 0 ? (
        <View style={ui.card}>
          <Text style={ui.name}>No favourites yet</Text>
          <Text style={ui.sub}>Tap the ☆ next to any item on the menu to save it here.</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.btnText}>Browse the menu</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={favProducts}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/product/${item.id}` as never)}>
            <View style={{ flex: 1 }}>
              <Text style={ui.name}>{item.name}</Text>
              {!!item.description && (
                <Text numberOfLines={1} style={ui.sub}>{item.description}</Text>
              )}
              <Text style={styles.price}>{money(Number(item.base_price))}</Text>
            </View>
            <Pressable hitSlop={12} onPress={() => onRemove(item.id)} style={styles.removeTap}>
              <Text style={styles.star}>★</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center' },
  price: { fontSize: 13, color: C.caramel, fontWeight: '600', marginTop: 4 },
  removeTap: { paddingLeft: 10 },
  star: { fontSize: 22, color: C.gold },
  btn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 24, alignSelf: 'flex-start', marginTop: 12 },
  btnText: { color: C.white, fontWeight: '600' },
});
