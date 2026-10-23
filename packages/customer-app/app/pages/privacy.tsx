import { Linking, StyleSheet, Text, View } from 'react-native';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const SECTIONS = [
  {
    icon: '📋',
    title: 'What we collect',
    body: 'When you use this app we collect: your name and mobile number (when you join Rewards), orders you place (stored on this device), your branch visit feedback, and app usage data to improve the experience.',
  },
  {
    icon: '☕',
    title: 'How we use it',
    body: 'We use your data to process orders, maintain your loyalty stamps, send you updates about your orders, and (with your permission) notify you about promotions and events at your branch.',
  },
  {
    icon: '🔒',
    title: 'How we protect it',
    body: 'Data is transmitted over encrypted connections. We do not sell your information to third parties. Payment processing is handled by our payment provider and we do not store card details.',
  },
  {
    icon: '🗑️',
    title: 'Your rights',
    body: 'You can request a copy of your data or ask us to delete your account at any time. To delete your Rewards card, go to the Rewards tab and choose "Delete my card". For all other data requests, contact us using the email below.',
  },
];

export default function PrivacyScreen() {
  return (
    <Page kicker="Legal" title="Privacy policy">
      <Text style={ui.lead}>
        Milestones Coffee takes your privacy seriously. Here is a plain-language summary of how we handle your data.
      </Text>

      {SECTIONS.map((sec) => (
        <View key={sec.title} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.icon}>{sec.icon}</Text>
            <Text style={s.title}>{sec.title}</Text>
          </View>
          <Text style={s.body}>{sec.body}</Text>
        </View>
      ))}

      <View style={s.contact}>
        <Text style={s.contactLabel}>Questions or data requests</Text>
        <Text
          style={s.email}
          onPress={() => Linking.openURL('mailto:privacy@milestonescoffee.ae')}>
          privacy@milestonescoffee.ae
        </Text>
        <Text style={s.contactSub}>We aim to respond within 5 working days.</Text>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  icon: { fontSize: 22 },
  title: { fontSize: 16, fontWeight: '700', color: C.navy },
  body: { fontSize: 14, color: C.muted, lineHeight: 22 },
  contact: {
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 20,
    marginTop: 4,
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '700',
    color: C.gold,
    marginBottom: 6,
  },
  contactSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
});
