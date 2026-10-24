import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, money } from '../../src/api';
import { useCart } from '../../src/cart';
import { SkeletonCard } from '../../src/skeleton';
import { ErrorState } from '../../src/ui';
import { C } from '../../src/theme';
import type { OptionSet, ProductFull } from '../../src/types';

// Pill tag for allergens / dietary info
function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

// Derive display tags from product fields
function tagsFor(p: ProductFull): { label: string; color: string; bg: string }[] {
  const tags: { label: string; color: string; bg: string }[] = [];
  const desc = (p.description ?? '').toLowerCase();
  const name = (p.name ?? '').toLowerCase();
  const both = desc + ' ' + name;
  if (both.includes('vegan')) tags.push({ label: 'Vegan', color: '#16a34a', bg: '#dcfce7' });
  else if (both.includes('vegetarian')) tags.push({ label: 'Vegetarian', color: '#15803d', bg: '#f0fdf4' });
  if (both.includes('gluten')) tags.push({ label: 'Gluten-free', color: '#b45309', bg: '#fef3c7' });
  if (both.includes('dairy-free') || both.includes('dairy free')) tags.push({ label: 'Dairy-free', color: '#0369a1', bg: '#e0f2fe' });
  if (both.includes('sugar-free') || both.includes('no sugar')) tags.push({ label: 'Sugar-free', color: '#7c3aed', bg: '#f3e8ff' });
  if (both.includes('cold brew') || both.includes('cold')) tags.push({ label: 'Cold', color: '#0284c7', bg: '#e0f2fe' });
  if (both.includes('seasonal') || both.includes('special')) tags.push({ label: 'Seasonal', color: '#b45309', bg: '#fff7ed' });
  return tags;
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { add } = useCart();
  const { data: p, isLoading, isError, refetch } = useQuery({ queryKey: ['product', id], queryFn: () => getJson<ProductFull>(`/products/${id}`) });
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  // Footer spring-in
  const footerY = useRef(new Animated.Value(80)).current;
  const footerOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!p) return;
    Animated.parallel([
      Animated.spring(footerY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
      Animated.timing(footerOp, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [p, footerY, footerOp]);

  // Hero image entrance
  const heroScale = useRef(new Animated.Value(1.05)).current;
  const heroOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!p?.image_url) return;
    Animated.parallel([
      Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, friction: 10 }),
      Animated.timing(heroOp, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [p?.image_url, heroScale, heroOp]);

  // Add-to-cart button press flash
  const addScale = useRef(new Animated.Value(1)).current;
  const flashAdd = () => {
    Animated.sequence([
      Animated.spring(addScale, { toValue: 0.95, useNativeDriver: true, friction: 8 }),
      Animated.spring(addScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();
  };

  if (isError && !p) {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <Pressable onPress={() => router.back()} style={s.backRow}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <ErrorState onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  if (isLoading || !p) {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  const groups: OptionSet[] = [...(p.variants ?? []), ...(p.option_groups ?? [])].filter((g) => g.options?.choices?.length);
  const extra = groups.reduce((sum, g) => {
    const list = g.options!.choices!;
    const chosen = list.find((c) => c.name === picked[g.id]) ?? list[0];
    return sum + (Number(chosen.price_adjustment) || 0);
  }, 0);
  const unit = Number(p.base_price) + extra;
  const tags = tagsFor(p);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={s.backRow}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        {/* Hero image with animated entrance */}
        {!!p.image_url && (
          <Animated.View style={[s.heroWrap, { opacity: heroOp, transform: [{ scale: heroScale }] }]}>
            <Image source={{ uri: p.image_url }} style={s.hero} resizeMode="cover" />
          </Animated.View>
        )}

        {/* Title row with price badge */}
        <View style={s.titleRow}>
          <Text style={s.title}>{p.name}</Text>
          <View style={s.priceBadge}>
            <Text style={s.priceBase}>{money(unit)}</Text>
          </View>
        </View>

        {/* Description */}
        {!!p.description && <Text style={s.desc}>{p.description}</Text>}

        {/* Dietary / allergen tags */}
        {tags.length > 0 && (
          <View style={s.tagRow}>
            {tags.map((t) => <Tag key={t.label} {...t} />)}
          </View>
        )}

        {/* Option groups */}
        {groups.map((g) => (
          <View key={g.id} style={s.group}>
            <Text style={s.groupTitle}>{g.name}</Text>
            <View style={s.chips}>
              {g.options!.choices!.map((c) => {
                const on = (picked[g.id] ?? g.options!.choices![0].name) === c.name;
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => setPicked((prev) => ({ ...prev, [g.id]: c.name }))}
                    style={[s.chip, on && s.chipOn]}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>
                      {c.name}
                      {Number(c.price_adjustment) ? ` +${Number(c.price_adjustment).toFixed(0)}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Barista note */}
        <Text style={s.groupTitle}>Note for the barista</Text>
        <TextInput
          style={s.noteBox}
          value={note}
          onChangeText={setNote}
          maxLength={140}
          placeholder="e.g. extra shot, less ice…"
          placeholderTextColor={C.muted}
          multiline
        />
        <Text style={s.noteCount}>{note.length}/140</Text>

        {/* Spacer so footer doesn't overlap content */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Animated footer */}
      <Animated.View style={[s.footer, { opacity: footerOp, transform: [{ translateY: footerY }] }]}>
        {/* Quantity stepper */}
        <View style={s.qty}>
          <Pressable
            style={s.qtyBtnWrap}
            onPress={() => setQty((q) => Math.max(1, q - 1))}>
            <Text style={s.qtyBtn}>−</Text>
          </Pressable>
          <Text style={s.qtyNum}>{qty}</Text>
          <Pressable
            style={s.qtyBtnWrap}
            onPress={() => setQty((q) => Math.min(20, q + 1))}>
            <Text style={s.qtyBtn}>+</Text>
          </Pressable>
        </View>

        {/* Add button */}
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: addScale }] }]}>
          <Pressable
            style={s.addBtn}
            onPress={() => {
              flashAdd();
              add(p, qty, picked, note.trim());
              router.back();
            }}>
            <Text style={s.addText}>Add to cart · {money(unit * qty)}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.muted, fontSize: 15 },

  backRow: { marginBottom: 14 },
  backText: { color: C.brown, fontWeight: '600', fontSize: 15 },

  heroWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  hero: { width: '100%', height: 230, borderRadius: 20 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: C.navy, flex: 1, marginRight: 10, lineHeight: 30 },
  priceBadge: { backgroundColor: C.navy2, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginTop: 2 },
  priceBase: { color: C.white, fontWeight: '700', fontSize: 16 },

  desc: { fontSize: 15, color: C.muted, lineHeight: 22, marginBottom: 12 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 12, fontWeight: '600' },

  group: { marginTop: 20 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600', fontSize: 14 },
  chipTextOn: { color: C.white },

  noteBox: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    color: C.navy,
    borderWidth: 1,
    borderColor: C.line,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  noteCount: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 },

  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  qtyBtnWrap: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.cream },
  qtyBtn: { fontSize: 22, color: C.navy2, fontWeight: '600', lineHeight: 26 },
  qtyNum: { fontSize: 16, fontWeight: '700', minWidth: 28, textAlign: 'center', color: C.navy },
  addBtn: { backgroundColor: C.navy2, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  addText: { color: C.white, fontWeight: '700', fontSize: 16 },
});
