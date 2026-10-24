import { useEffect, useRef } from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { Page } from '../../src/ui';
import { C } from '../../src/theme';

const SECTIONS = [
  {
    icon: '📋',
    title: 'Information we collect',
    body: 'We collect information you give us directly — your name, phone number and email when you place an order, join our loyalty programme or contact us. We also collect order history and preferences to personalise your experience.',
  },
  {
    icon: '☕',
    title: 'How we use it',
    body: 'We use your information to process orders, send order updates, manage your loyalty points and, where you have opted in, send you offers and promotions. We do not sell your data to third parties.',
  },
  {
    icon: '🔒',
    title: 'Data security',
    body: 'Your data is stored on secure servers and transmitted over encrypted connections. We retain your personal data only as long as your account is active or as needed to provide services.',
  },
  {
    icon: '✉️',
    title: 'Your rights',
    body: 'You may request access to, correction of or deletion of your personal data at any time. To exercise these rights, contact us at privacy@milestones.ae. We will respond within 30 days.',
  },
];

// Animated policy section card — staggered slide-up entrance
function PolicyCard({ section, index }: { section: typeof SECTIONS[number]; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const delay = index * 70;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.card, { opacity, transform: [{ translateY }] }]}>
      <View style={s.cardHeader}>
        <Text style={s.cardIcon}>{section.icon}</Text>
        <Text style={s.cardTitle}>{section.title}</Text>
      </View>
      <Text style={s.cardBody}>{section.body}</Text>
    </Animated.View>
  );
}

export default function PrivacyScreen() {
  // Contact block fades up after all cards
  const contactOpacity = useRef(new Animated.Value(0)).current;
  const contactY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    const delay = SECTIONS.length * 70 + 120;
    Animated.parallel([
      Animated.timing(contactOpacity, { toValue: 1, duration: 260, delay, useNativeDriver: true }),
      Animated.spring(contactY, { toValue: 0, delay, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [contactOpacity, contactY]);

  return (
    <Page kicker="Legal" title="Privacy Policy">
      <Text style={s.intro}>
        Milestones Coffee is committed to protecting your privacy. This policy explains how we collect, use and safeguard your personal data.
      </Text>

      {SECTIONS.map((section, i) => (
        <PolicyCard key={section.title} section={section} index={i} />
      ))}

      {/* Contact block */}
      <Animated.View style={[s.contactBlock, { opacity: contactOpacity, transform: [{ translateY: contactY }] }]}>
        <Text style={s.contactTitle}>Questions?</Text>
        <Text style={s.contactText}>
          If you have any questions about this privacy policy, please contact our data protection team.
        </Text>
        <Text style={s.contactEmail} onPress={() => Linking.openURL('mailto:privacy@milestones.ae')}>
          privacy@milestones.ae
        </Text>
        <Text style={s.contactMeta}>Last updated: January 2026</Text>
      </Animated.View>
      <View style={{ height: 8 }} />
    </Page>
  );
}

const s = StyleSheet.create({
  intro: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    marginBottom: 16,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.navy, flex: 1 },
  cardBody: { fontSize: 13, color: C.muted, lineHeight: 20 },

  contactBlock: {
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 22,
    marginTop: 8,
  },
  contactTitle: { fontSize: 17, fontWeight: '700', color: C.white, marginBottom: 6 },
  contactText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20, marginBottom: 10 },
  contactEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: C.gold,
    marginBottom: 10,
  },
  contactMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});
