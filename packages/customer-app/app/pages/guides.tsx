import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GUIDES } from '../../src/guides';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const DIFFICULTY: Record<string, { label: string; color: string }> = {
  v60:           { label: 'Intermediate', color: '#f59e0b' },
  'french-press':{ label: 'Easy',         color: '#10b981' },
  'cold-brew':   { label: 'Easy',         color: '#10b981' },
  'moka-pot':    { label: 'Easy',         color: '#10b981' },
  'arabic-coffee':{ label: 'Intermediate', color: '#f59e0b' },
};

const ICON: Record<string, string> = {
  v60:            '🫗',
  'french-press': '🟤',
  'cold-brew':    '🧊',
  'moka-pot':     '🫖',
  'arabic-coffee':'☕',
};

// Animated guide card — staggered slide-up + press scale
function GuideCard({ g, index }: { g: typeof GUIDES[number]; index: number }) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 70;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  const diff = DIFFICULTY[g.slug];
  const icon = ICON[g.slug] ?? '☕';

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        style={s.card}
        onPress={() => router.push(`/pages/guide/${g.slug}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={s.cardLeft}>
          <View style={s.iconBox}>
            <Text style={s.icon}>{icon}</Text>
          </View>
        </View>
        <View style={s.cardBody}>
          <Text style={s.name}>{g.name}</Text>
          <Text style={s.tagline} numberOfLines={2}>{g.tagline}</Text>
          <View style={s.pills}>
            <View style={s.pill}>
              <Text style={s.pillText}>⏱ {g.time}</Text>
            </View>
            {diff && (
              <View style={[s.pill, { backgroundColor: diff.color + '20' }]}>
                <Text style={[s.pillText, { color: diff.color }]}>{diff.label}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function GuidesScreen() {
  return (
    <Page kicker="At home" title="Brew guides">
      <Text style={ui.lead}>Make café-quality coffee at home. Each guide has a ratio calculator and a step-by-step timer.</Text>
      {GUIDES.map((g, i) => (
        <GuideCard key={g.slug} g={g} index={i} />
      ))}
    </Page>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.line,
    gap: 14,
  },
  cardLeft: {},
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  cardBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: C.navy, marginBottom: 3 },
  tagline: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 8 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: {
    backgroundColor: C.cream,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: C.brown },
  chevron: { fontSize: 22, color: C.muted, fontWeight: '300' },
});
