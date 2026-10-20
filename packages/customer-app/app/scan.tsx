import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from 'react-native';
import { API } from '../src/api';
import { getCardToken } from '../src/storage';
import { parseTableCode, setTable } from '../src/table';
import { C } from '../src/theme';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState('Point the camera at the QR code on your table.');
  const [done, setDone] = useState(false);

  const onScanned = async ({ data }: { data: string }) => {
    if (done) return;
    // Counter stamp code from the till screen: adds a stamp to the rewards card.
    const stamp = data.match(/[?&]stamp=([a-f0-9-]{8,64}(?:\.|%2E)[A-Z2-9]{8})/i) ?? data.match(/^([a-f0-9-]{8,64}\.[A-Z2-9]{8})$/i);
    if (stamp) {
      setDone(true);
      const token = await getCardToken();
      if (!token) {
        Alert.alert('Join rewards first', 'Create or link your rewards card, then scan again.', [{ text: 'OK', onPress: () => router.replace('/(tabs)/rewards') }]);
        return;
      }
      const code = decodeURIComponent(stamp[1]);
      const r = await fetch(`${API}/loyalty/self-stamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token, code }),
      }).then((x) => x.json().catch(() => ({})));
      Alert.alert(r.ok ? 'Stamp added' : 'Stamp not added', r.ok ? `You now have ${r.stamps} stamps.` : r.message || 'Please try again.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/rewards') },
      ]);
      return;
    }
    const session = parseTableCode(data);
    if (!session) return setMessage('That code is not a table code. Try the one on your table.');
    setDone(true);
    await setTable(session);
    router.replace('/(tabs)');
  };

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Allow the camera to scan your table code.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Allow camera</Text></Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Not now</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      <View style={styles.overlay}>
        <Text style={styles.msg}>{message}</Text>
        <Pressable onPress={() => router.back()} style={styles.btn}><Text style={styles.btnText}>Cancel</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: C.white, fontSize: 16, textAlign: 'center', marginBottom: 16 },
  overlay: { position: 'absolute', bottom: 60, left: 20, right: 20, alignItems: 'center', gap: 14 },
  msg: { color: C.white, backgroundColor: 'rgba(11,26,51,0.8)', padding: 12, borderRadius: 12, textAlign: 'center' },
  btn: { backgroundColor: C.navy2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: C.white, fontWeight: '600' },
  link: { color: C.gold, marginTop: 14 },
});
