import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const KEY = 'msq_notif_prefs';

type Prefs = {
  orderUpdates: boolean;
  promotions: boolean;
  loyaltyNews: boolean;
};

const DEFAULT: Prefs = { orderUpdates: true, promotions: true, loyaltyNews: true };

async function loadPrefs(): Promise<Prefs> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

async function savePrefs(p: Prefs) {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadPrefs().then((p) => { setPrefs(p); setReady(true); }); }, []);

  const toggle = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await savePrefs(next);
  };

  const rows: { key: keyof Prefs; title: string; sub: string }[] = [
    { key: 'orderUpdates', title: 'Order updates', sub: 'When your order is ready for pickup or at your table.' },
    { key: 'promotions', title: 'Promotions', sub: 'Special offers, limited drinks, and branch events.' },
    { key: 'loyaltyNews', title: 'Loyalty & rewards', sub: 'Stamp milestones, birthday treats, and double-stamp days.' },
  ];

  if (!ready) return null;

  return (
    <Page kicker="Account" title="Notifications">
      <Text style={ui.lead}>
        These preferences are saved on this phone. Your device notification settings control whether notifications can arrive at all.
      </Text>

      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={ui.name}>{r.title}</Text>
            <Text style={ui.sub}>{r.sub}</Text>
          </View>
          <Switch
            value={prefs[r.key]}
            onValueChange={() => toggle(r.key)}
            trackColor={{ true: C.navy2, false: C.line }}
            thumbColor={C.white}
          />
        </View>
      ))}

      <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
        <Text style={styles.settingsText}>Open device notification settings</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center' },
  settingsBtn: { marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, alignItems: 'center' },
  settingsText: { color: C.navy2, fontWeight: '600' },
});
