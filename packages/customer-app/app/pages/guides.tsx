import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { GUIDES } from '../../src/guides';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

export default function GuidesScreen() {
  return (
    <Page kicker="At home" title="Brew guides">
      <Text style={ui.lead}>Make café-quality coffee at home. Each guide has a ratio calculator and a step-by-step timer.</Text>
      {GUIDES.map((g) => (
        <Pressable key={g.slug} style={ui.card} onPress={() => router.push(`/pages/guide/${g.slug}`)}>
          <Text style={ui.name}>{g.name}</Text>
          <Text style={ui.sub}>{g.tagline}</Text>
          <Text style={[ui.sub, { color: C.brown, fontWeight: '600' }]}>{g.time}</Text>
        </Pressable>
      ))}
    </Page>
  );
}
