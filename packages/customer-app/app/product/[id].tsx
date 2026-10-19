import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getJson, money } from '../../src/api';
import { useCart } from '../../src/cart';
import { C } from '../../src/theme';
import type { OptionSet, ProductFull } from '../../src/types';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { add } = useCart();
  const { data: p, isLoading } = useQuery({ queryKey: ['product', id], queryFn: () => getJson<ProductFull>(`/products/${id}`) });
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  if (isLoading || !p) return <View style={styles.screen}><Text style={styles.muted}>Loading…</Text></View>;

  const groups: OptionSet[] = [...(p.variants ?? []), ...(p.option_groups ?? [])].filter((g) => g.options?.choices?.length);
  const extra = groups.reduce((s, g) => {
    const list = g.options!.choices!;
    const chosen = list.find((c) => c.name === picked[g.id]) ?? list[0];
    return s + (Number(chosen.price_adjustment) || 0);
  }, 0);
  const unit = Number(p.base_price) + extra;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.close}>Close</Text></Pressable>
        <Text style={styles.title}>{p.name}</Text>
        {!!p.description && <Text style={styles.desc}>{p.description}</Text>}

        {groups.map((g) => (
          <View key={g.id} style={styles.group}>
            <Text style={styles.groupTitle}>{g.name}</Text>
            <View style={styles.chips}>
              {g.options!.choices!.map((c) => {
                const on = (picked[g.id] ?? g.options!.choices![0].name) === c.name;
                return (
                  <Pressable key={c.name} onPress={() => setPicked((s) => ({ ...s, [g.id]: c.name }))} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {c.name}
                      {Number(c.price_adjustment) ? ` +${Number(c.price_adjustment).toFixed(0)}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.groupTitle}>Note for the barista</Text>
        <TextInput style={styles.noteBox} value={note} onChangeText={setNote} maxLength={140} placeholder="e.g. less sugar" placeholderTextColor={C.muted} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.qty}>
          <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))}><Text style={styles.qtyBtn}>−</Text></Pressable>
          <Text style={styles.qtyNum}>{qty}</Text>
          <Pressable onPress={() => setQty((q) => Math.min(20, q + 1))}><Text style={styles.qtyBtn}>+</Text></Pressable>
        </View>
        <Pressable style={styles.addBtn} onPress={() => { add(p, qty, picked, note.trim()); router.back(); }}>
          <Text style={styles.addText}>Add · {money(unit * qty)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 30 },
  close: { color: C.brown, fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '600', color: C.navy },
  desc: { fontSize: 15, color: C.muted, marginTop: 6, lineHeight: 21 },
  group: { marginTop: 22 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 22, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  noteBox: { backgroundColor: C.white, borderRadius: 14, padding: 14, color: C.navy, borderWidth: 1, borderColor: C.line, fontSize: 15 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 28, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.white },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 },
  qtyBtn: { fontSize: 22, color: C.navy2, fontWeight: '600' },
  qtyNum: { fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  addBtn: { flex: 1, backgroundColor: C.navy2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addText: { color: C.white, fontWeight: '600', fontSize: 16 },
  muted: { color: C.muted, margin: 40 },
});
