import { Linking, Pressable, Text, View } from 'react-native';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What we collect',
    body: [
      'When you place an order, we keep your name, phone number (if you give one), the items and options you chose, and the pickup or table details.',
      'When you join the rewards programme, we keep your phone number and your stamps and points.',
      'When you leave feedback, send a gift card or join a group order, we keep the details you enter for that request.',
      'The app may ask to send you notifications about your orders. You can turn these off in your phone settings at any time.',
    ],
  },
  {
    title: 'What stays on your phone',
    body: [
      'Your cart, the list of orders you placed from this phone, your rewards card link, your favourite products and your last chosen branch.',
      'This information is stored only on your phone. You can remove the order list from Order history, and you can delete your rewards card from the Rewards tab.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'To prepare and collect your orders, to track your stamps and points, to answer your feedback and to keep our branches running well.',
      'We do not sell your personal information.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'Delete your rewards card: Rewards tab, then “Delete my card”. Your stamps and history for that card are removed.',
      'Clear your order history on this phone: More, then Order history, then “Clear order history on this phone”. Orders already placed stay on our system.',
      'For any other request, such as access to or deletion of the personal information we hold, email hello@coffeesales.ae.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <Page kicker="Help" title="Privacy policy">
      {SECTIONS.map((s) => (
        <View key={s.title}>
          <Text style={ui.label}>{s.title}</Text>
          {s.body.map((line, i) => (
            <Text key={i} style={[ui.lead, { color: C.navy2 }]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
      <Pressable onPress={() => Linking.openURL('mailto:hello@coffeesales.ae')} style={{ marginTop: 8 }}>
        <Text style={{ color: C.brown, fontWeight: '600' }}>Email hello@coffeesales.ae</Text>
      </Pressable>
    </Page>
  );
}
