import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const FAQS: { topic: string; icon: string; items: { q: string; a: string }[] }[] = [
  {
    topic: 'Ordering',
    icon: '☕',
    items: [
      { q: 'Can I order ahead?', a: 'Yes. Add items to your cart and choose pickup, with a time slot in the next 12 hours. You can also order from your table by scanning the table QR code.' },
      { q: 'How do I scan a branch QR code?', a: 'Tap "Scan table" on the Menu tab and point the camera at the code. It sets your branch and table automatically.' },
      { q: 'Can I customise my drink?', a: 'Yes — tap any item on the menu to choose milk type, size, sweetness, and extras before adding to your cart.' },
    ],
  },
  {
    topic: 'Branches & hours',
    icon: '📍',
    items: [
      { q: 'What are your opening hours?', a: "Hours vary by branch. Open the Branches tab to see each branch's live hours, or use \"Open now\" to filter to branches you can visit right now." },
      { q: 'How do I find the nearest branch?', a: 'Open the Branches tab for a filterable list, or use the Branch map in More to see all branches and get directions.' },
    ],
  },
  {
    topic: 'Loyalty & rewards',
    icon: '⭐',
    items: [
      { q: 'How does the loyalty card work?', a: 'Sign up with your phone number on the Rewards tab. Collect 10 stamps and your next drink is on us. Show your card to staff when you order; they add one stamp per order.' },
      { q: 'Can I transfer my stamps to another account?', a: 'Stamps are tied to your phone number and cannot be transferred. If you change your number, please speak to a branch manager.' },
    ],
  },
  {
    topic: 'Allergens & dietary',
    icon: '🌿',
    items: [
      { q: 'Do you have allergen information?', a: 'Products with dietary tags (Vegan, Gluten-Free, Dairy-Free) are marked on the menu. For other allergens, please ask our staff before ordering — we are happy to help.' },
      { q: 'Do you have dairy-free milk options?', a: 'Yes — we offer oat, almond and soy milk across all branches. Select your choice when you customise your drink.' },
    ],
  },
  {
    topic: 'Feedback & contact',
    icon: '💬',
    items: [
      { q: 'How can I give feedback?', a: 'Use Feedback in More to rate your visit and leave a short comment for the branch. We read every one.' },
      { q: 'How do I report a problem with my order?', a: 'Tap your order in Order history and use the "Report a problem" option. Our team will get back to you within one working day.' },
    ],
  },
];

function AccordionItem({ q, a, isLast }: { q: string; a: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.spring(anim, { toValue: next ? 1 : 0, useNativeDriver: false, friction: 8 }).start();
  };

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const opacity = anim;

  return (
    <View style={[s.item, !isLast && s.itemBorder]}>
      <Pressable style={s.question} onPress={toggle}>
        <Text style={[s.qText, open && { color: C.navy2 }]} numberOfLines={open ? undefined : 2}>{q}</Text>
        <Text style={[s.chevron, open && s.chevronOpen]}>›</Text>
      </Pressable>
      <Animated.View style={{ maxHeight, opacity, overflow: 'hidden' }}>
        <Text style={s.answer}>{a}</Text>
      </Animated.View>
    </View>
  );
}

export default function FaqScreen() {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();

  const filtered = FAQS.map((sec) => ({
    ...sec,
    items: sec.items.filter((f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
  })).filter((sec) => sec.items.length > 0);

  return (
    <Page kicker="Help" title="FAQ">
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search questions…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Text style={s.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {filtered.length === 0 && (
        <View style={ui.card}>
          <Text style={ui.name}>No matches</Text>
          <Text style={ui.sub}>Try different keywords or clear the search.</Text>
        </View>
      )}

      {filtered.map((sec) => (
        <View key={sec.topic} style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionIcon}>{sec.icon}</Text>
            <Text style={s.sectionTitle}>{sec.topic}</Text>
          </View>
          <View style={s.card}>
            {sec.items.map((f, i) => (
              <AccordionItem key={f.q} q={f.q} a={f.a} isLast={i === sec.items.length - 1} />
            ))}
          </View>
        </View>
      ))}
    </Page>
  );
}

const s = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: C.navy },
  clearIcon: { fontSize: 14, color: C.muted, padding: 4 },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginLeft: 4 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.brown },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  item: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  question: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingBottom: 4 },
  qText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.navy, lineHeight: 21 },
  chevron: { fontSize: 22, color: C.muted, fontWeight: '300', transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  answer: { fontSize: 14, color: C.muted, lineHeight: 21, paddingBottom: 8, paddingTop: 4 },
});
