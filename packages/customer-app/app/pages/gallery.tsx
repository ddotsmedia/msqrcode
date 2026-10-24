import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Dimensions, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SITE } from '../../src/api';
import { SkeletonCard } from '../../src/skeleton';
import { C } from '../../src/theme';
import { Page } from '../../src/ui';

type Item = { src: string; alt: string; caption?: string };

const GAP = 8;
const COLS = 2;
const { width } = Dimensions.get('window');
const CELL = (width - 32 - GAP) / COLS; // 16px side padding each side

function url(src: string) {
  return src.startsWith('http') ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Animated gallery cell — fades in with stagger
function GalleryCell({ item, index }: { item: Item; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const delay = Math.min(index * 40, 320);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.cell, { opacity, transform: [{ scale }] }]}>
      <Image
        source={{ uri: url(item.src) }}
        accessibilityLabel={item.alt}
        style={s.img}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
      {!!item.caption && <Text style={s.caption} numberOfLines={2}>{item.caption}</Text>}
    </Animated.View>
  );
}

export default function GalleryScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['gallery'],
    queryFn: async (): Promise<Item[]> => {
      const r = await fetch(`${SITE}/gallery/gallery.json`);
      if (!r.ok) throw new Error('gallery');
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isFirstLoad = isLoading && !data;

  return (
    <Page kicker="Inside Milestones" title="Gallery" refreshing={refreshing} onRefresh={onRefresh}>
      {isFirstLoad && (
        <>
          <View style={s.row}>
            <View style={s.skeletonCell}><SkeletonCard /></View>
            <View style={s.skeletonCell}><SkeletonCard /></View>
          </View>
          <View style={s.row}>
            <View style={s.skeletonCell}><SkeletonCard /></View>
            <View style={s.skeletonCell}><SkeletonCard /></View>
          </View>
        </>
      )}
      {isError && <Text style={s.error}>Could not load the gallery. Pull down to try again.</Text>}
      {!isFirstLoad && data && data.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyTitle}>Photos coming soon</Text>
          <Text style={s.emptySub}>Check back to see our branches.</Text>
        </View>
      )}
      {(data ?? []).length > 0 && (
        <FlatList
          data={data}
          keyExtractor={(it) => it.src}
          numColumns={COLS}
          columnWrapperStyle={s.row}
          scrollEnabled={false}
          renderItem={({ item, index }) => <GalleryCell item={item} index={index} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy2} />
          }
        />
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  cell: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: C.line },
  img: { width: CELL, height: CELL, borderRadius: 16 },
  caption: { fontSize: 11, color: C.muted, padding: 6, lineHeight: 15 },
  skeletonCell: { flex: 1 },
  error: { color: '#b91c1c', fontSize: 14, textAlign: 'center', marginTop: 16 },
  empty: { alignItems: 'center', paddingTop: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.navy, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.muted },
});
