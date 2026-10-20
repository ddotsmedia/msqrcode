import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, Text, View } from 'react-native';
import { getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

// Every branch with directions. Opens the phone's own maps app (no map SDK needed).
export default function MapScreen() {
  const { data } = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  return (
    <Page kicker="Find us" title="Branch map">
      {(data ?? []).map((b) => (
        <View key={b.id} style={ui.card}>
          <Text style={ui.name}>{b.name}</Text>
          {!!b.address && <Text style={ui.sub}>{b.address}</Text>}
          {!!b.phone && <Text style={ui.sub}>{b.phone}</Text>}
          {b.latitude != null && b.longitude != null && (
            <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`)}>
              <Text style={[ui.link, { color: C.brown }]}>Get directions →</Text>
            </Pressable>
          )}
        </View>
      ))}
    </Page>
  );
}
