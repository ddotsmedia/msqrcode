import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const FAQS = [
  { q: 'What are your opening hours?', a: 'Hours vary by branch. Open the Branches tab to see each branch’s hours, or use "Open now" to filter.' },
  { q: 'How do I find the nearest branch?', a: 'Open the Branches tab, or use the Map page in More to see every branch.' },
  { q: 'Do you have allergen information?', a: 'Products with dietary tags (Vegan, Gluten-Free, Dairy-Free) are marked on the menu. For other allergens, please ask our staff before ordering.' },
  { q: 'How does the loyalty card work?', a: 'Sign up with your phone number on the Rewards tab. Collect 10 stamps and your next drink is on us. Show your card to staff when you order; they add one stamp per order.' },
  { q: 'Can I order ahead?', a: 'Yes. Add items to your cart and choose pickup, with a time slot in the next 12 hours. You can also order from your table by scanning the table QR code.' },
  { q: 'How do I scan a branch QR code?', a: 'Tap "Scan table" on the Menu tab and point the camera at the code. It sets your branch and table.' },
  { q: 'How can I give feedback?', a: 'Use Feedback in More to rate your visit and leave a short comment for the branch.' },
];

export default function FaqScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Page kicker="Help" title="FAQ">
      {FAQS.map((f, i) => (
        <Pressable key={f.q} style={ui.card} onPress={() => setOpen(open === i ? null : i)}>
          <Text style={ui.name}>{f.q}</Text>
          {open === i && <Text style={[ui.sub, { fontSize: 15, color: C.navy2 }]}>{f.a}</Text>}
        </Pressable>
      ))}
      <View style={{ height: 8 }} />
    </Page>
  );
}
