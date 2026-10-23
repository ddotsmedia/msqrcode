import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../../src/theme';

// Pastel background tints for icon boxes — one per section group
const ICON_BG: Record<string, string> = {
  '🧾': '#fef9ec', '❤️': '#fee2e2', '🔔': '#f0fdf4', '🎁': '#fdf4ff', '🏢': '#eff6ff',
  '☕': '#fef9ec', '📖': '#fff7ed', '🤝': '#f0fdf4', '🍽️': '#fff1f2', '📍': '#f0f9ff',
  '📸': '#fdf4ff', '💼': '#f9fafb',
  '⭐': '#fefce8', '❓': '#f0f9ff', '🔒': '#f9fafb',
};

type Item = { icon: string; title: string; text: string; href: string };
type Section = { heading: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    heading: 'Account',
    items: [
      { icon: '🧾', title: 'Order history', text: 'Your recent orders, with reorder', href: '/orders' },
      { icon: '❤️', title: 'Favourites', text: 'Items you saved from the menu', href: '/pages/favourites' },
      { icon: '🔔', title: 'Notifications', text: 'Manage what we send you', href: '/pages/notifications' },
      { icon: '🎁', title: 'Gift cards', text: 'Send a gift card or check a balance', href: '/gift' },
      { icon: '🏢', title: 'Business account', text: 'Company pickup orders, invoiced monthly', href: '/business' },
    ],
  },
  {
    heading: 'Discover',
    items: [
      { icon: '☕', title: 'Find your drink', text: 'Answer 3 quick questions for a suggestion', href: '/pages/quiz' },
      { icon: '📖', title: 'Brew guides', text: 'V60, French press, cold brew, moka pot, Arabic coffee', href: '/pages/guides' },
      { icon: '🤝', title: 'Group orders', text: 'Order together with friends or colleagues', href: '/group' },
      { icon: '🍽️', title: 'Catering & events', text: 'Office coffee, events and coffee carts', href: '/pages/catering' },
      { icon: '📍', title: 'Branch map', text: 'Find a branch and get directions', href: '/pages/map' },
      { icon: '📸', title: 'Gallery', text: 'Photos from our branches', href: '/pages/gallery' },
      { icon: '💼', title: 'Careers', text: 'Join the team in Abu Dhabi', href: '/pages/careers' },
    ],
  },
  {
    heading: 'Support',
    items: [
      { icon: '⭐', title: 'Feedback', text: 'Rate your visit', href: '/pages/feedback' },
      { icon: '❓', title: 'FAQ', text: 'Common questions answered', href: '/pages/faq' },
      { icon: '🔒', title: 'Privacy policy', text: 'What we collect and how to delete it', href: '/pages/privacy' },
    ],
  },
];

// Compute a global stagger index per section
const SECTION_START = SECTIONS.reduce<number[]>((acc, sec, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SECTIONS[i - 1].items.length + 1); // +1 for the heading
  return acc;
}, []);

// Animated section block — fades + slides up
function AnimatedSection({ sec, sectionIndex }: { sec: Section; sectionIndex: number }) {
  const baseDelay = SECTION_START[sectionIndex] * 45;

  // Heading entrance
  const headOpacity = useRef(new Animated.Value(0)).current;
  const headY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headOpacity, { toValue: 1, duration: 200, delay: baseDelay, useNativeDriver: true }),
      Animated.spring(headY, { toValue: 0, delay: baseDelay, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [headOpacity, headY, baseDelay]);

  // Card entrance (slightly after heading)
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const delay = baseDelay + 50;
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [cardOpacity, cardY, baseDelay]);

  return (
    <View style={styles.section}>
      <Animated.Text
        style={[styles.sectionLabel, { opacity: headOpacity, transform: [{ translateY: headY }] }]}
      >
        {sec.heading}
      </Animated.Text>
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        {sec.items.map((it, idx) => (
          <MoreRow key={it.href} it={it} isLast={idx === sec.items.length - 1} />
        ))}
      </Animated.View>
    </View>
  );
}

// Individual row with press scale feedback
function MoreRow({ it, isLast }: { it: Item; isLast: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.row, !isLast && styles.rowBorder]}
        onPress={() => router.push(it.href as never)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={[styles.iconBox, { backgroundColor: ICON_BG[it.icon] ?? C.cream }]}>
          <Text style={styles.icon}>{it.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{it.title}</Text>
          <Text style={styles.text}>{it.text}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function MoreScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hero}>More</Text>
      {SECTIONS.map((sec, i) => (
        <AnimatedSection key={sec.heading} sec={sec} sectionIndex={i} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 50, paddingBottom: 40 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.brown,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: C.navy },
  text: { fontSize: 12, color: C.muted, marginTop: 2 },
  chevron: { fontSize: 20, color: C.muted, fontWeight: '300' },
});
