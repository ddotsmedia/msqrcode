import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { C } from './theme';

// Shared page frame for the secondary screens (back link, kicker, title).
export function Page({ title, kicker, children, onRefresh, refreshing }: { title: string; kicker?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.navy2} /> : undefined}
    >
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={ui.back}>‹ Back</Text>
      </Pressable>
      {kicker ? <Text style={ui.kicker}>{kicker}</Text> : null}
      <Text style={ui.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  back: { color: C.brown, fontWeight: '600', marginBottom: 10, fontSize: 16 },
  kicker: { fontSize: 12, fontWeight: '700', color: C.caramel, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12 },
  lead: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginBottom: 10 },
  area: { minHeight: 90, textAlignVertical: 'top' },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: C.white, fontWeight: '600', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: C.white },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  error: { color: '#b91c1c', marginBottom: 8 },
  ok: { color: C.green, fontSize: 16, fontWeight: '600', marginTop: 12, lineHeight: 22 },
  name: { fontSize: 17, fontWeight: '600', color: C.navy },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  link: { color: C.brown, fontWeight: '600', marginTop: 8 },
});
