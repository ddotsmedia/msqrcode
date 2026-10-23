import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getJson, money } from '../../src/api';
import { getFavs, toggleFav } from '../../src/favs';
import { useCart } from '../../src/cart';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';
import type { ProductFull } from '../../src/types';

// Animated favourite row — slides up + fades in
function FavRow({
  item,
  index,
  adding,
  onAdd,
  onRemove,
}: {
  item: ProductFull;
  index: number;
  adding: string | null;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 50, 300);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add-to-cart spring flash
  const addScale = useRef(new Animated.Value(1)).current;
  const handleAdd = () => {
    Animated.sequence([
      Animated.spring(addScale, { toValue: 0.88, useNativeDriver: true, friction: 6 }),
      Animated.spring(addScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
    onAdd();
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={s.row}>
        <Pressable style={s.rowMain} onPress={() => router.push(`/product/${item.id}` as never)}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.name}</Text>
            {!!item.description && (
              <Text numberOfLines={1} style={s.desc}>{item.description}</Text>
            )}
            <Text style={s.price}>{money(Number(item.base_price))}</Text>
          </View>
        </Pressable>
        <View style={s.rowActions}>
          <Animated.View style={{ transform: [{ scale: addScale }] }}>
            <Pressable
              style={[s.addBtn, adding === item.id && { opacity: 0.6 }]}
              disabled={adding === item.id}
              onPress={handleAdd}
            >
              <Text style={s.addText}>{adding === item.id ? '…' : '+'}</Text>
            </Pressable>
          </Animated.View>
          <Pressable hitSlop={12} onPress={onRemove} style={s.removeBtn}>
            <Text style={s.removeStar}>★</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function FavouritesScreen() {
  const qc = useQueryClient();
  const { add } = useCart();
  const [favIds, setFavIds] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

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

  const onAddToCart = async (p: ProductFull) => {
    setAdding(p.id);
    add(p, 1, {}, '');
    setAdding(null);
  };

  return (
    <Page kicker="Account" title="Favourites">
      {isLoading ? <Text style={ui.lead}>Loading…</Text> : null}

      {!isLoading && favProducts.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>☆</Text>
          <Text style={s.emptyTitle}>No favourites yet</Text>
          <Text style={s.emptySub}>
            Tap the ☆ next to any item on the menu to save it here for quick access.
          </Text>
          <Pressable style={s.browseBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.browseBtnText}>Browse the menu</Text>
          </Pressable>
        </View>
      ) : null}

      {favProducts.length > 0 && (
        <>
          <Text style={s.countLabel}>{favProducts.length} saved item{favProducts.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={favProducts}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <FavRow
                item={item}
                index={index}
                adding={adding}
                onAdd={() => onAddToCart(item)}
                onRemove={() => onRemove(item.id)}
              />
            )}
          />
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  countLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowMain: { flex: 1, padding: 14 },
  name: { fontSize: 15, fontWeight: '600', color: C.navy, marginBottom: 2 },
  desc: { fontSize: 12, color: C.muted, marginBottom: 4 },
  price: { fontSize: 13, color: C.caramel, fontWeight: '700' },
  rowActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 8 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.navy2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: C.white, fontSize: 20, fontWeight: '300', lineHeight: 22 },
  removeBtn: { padding: 4 },
  removeStar: { fontSize: 22, color: C.gold },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  emptyIcon: { fontSize: 56, color: C.line, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.navy, marginBottom: 8 },
  emptySub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  browseBtn: {
    backgroundColor: C.navy2,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  browseBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
