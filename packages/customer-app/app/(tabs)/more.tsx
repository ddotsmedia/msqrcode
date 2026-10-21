import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { C } from '../../src/theme';

const ITEMS: { title: string; text: string; href: string }[] = [
  { title: 'Order history', text: 'Your recent orders, with reorder', href: '/orders' },
  { title: 'Find your drink', text: 'Answer 3 quick questions for a suggestion', href: '/pages/quiz' },
  { title: 'Brew guides', text: 'V60, French press, cold brew, moka pot, Arabic coffee', href: '/pages/guides' },
  { title: 'Gift cards', text: 'Send a gift card or check a balance', href: '/gift' },
  { title: 'Group orders', text: 'Order together with friends or colleagues', href: '/group' },
  { title: 'Business account', text: 'Company pickup orders, invoiced monthly', href: '/business' },
  { title: 'Catering & events', text: 'Office coffee, events and coffee carts', href: '/pages/catering' },
  { title: 'Branch map', text: 'Find a branch and get directions', href: '/pages/map' },
  { title: 'Gallery', text: 'Photos from our branches', href: '/pages/gallery' },
  { title: 'Careers', text: 'Join the team in Abu Dhabi', href: '/pages/careers' },
  { title: 'Feedback', text: 'Rate your visit', href: '/pages/feedback' },
  { title: 'FAQ', text: 'Common questions answered', href: '/pages/faq' },
  { title: 'Privacy policy', text: 'What we collect and how to delete it', href: '/pages/privacy' },
];

export default function MoreScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hero}>More</Text>
      {ITEMS.map((it) => (
        <Pressable key={it.href} style={styles.row} onPress={() => router.push(it.href as never)}>
          <Text style={styles.title}>{it.title}</Text>
          <Text style={styles.text}>{it.text}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 16, paddingTop: 50, paddingBottom: 32 },
  hero: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12 },
  row: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  title: { fontSize: 17, fontWeight: '600', color: C.navy },
  text: { fontSize: 13, color: C.muted, marginTop: 4 },
});
