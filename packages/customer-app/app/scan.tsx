import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from 'react-native';
import { API } from '../src/api';
import { getCardToken } from '../src/storage';
import { parseTableCode, setTable } from '../src/table';
import { logScan } from '../src/scans';
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
    // Feedback code on a receipt or table card: open the feedback form for that branch.
    const feedback = data.match(/[?&]branch=([a-f0-9-]{36})/i);
    if (feedback && /[?&]feedback=1/.test(data)) {
      setDone(true);
      logScan({ kind: 'feedback', branch_id: feedback[1] });
      router.replace(`/pages/feedback?branch=${feedback[1]}`);
      return;
    }
    // Offer poster code: open the offers tab.
    const promo = data.match(/[?&]promo=([a-f0-9-]{36})/i);
    if (promo) {
      setDone(true);
      logScan({ kind: 'promo', promotion_id: promo[1] });
      router.replace('/(tabs)/offers');
      return;
    }
    const session = parseTableCode(data);
    if (!session) return setMessage('That code is not a table code. Try the one on your table.');
    setDone(true);
    logScan({ kind: 'table', branch_id: session.branchId, table: session.table });
    await setTable(session);
    router.replace('/(tabs)');
  };

  // Permission screen: button + link fade/slide in
  const permOpacity = useRef(new Animated.Value(0)).current;
  const permY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(permOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(permY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [permOpacity, permY]);

  // Overlay message fades in from below on the camera screen
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }),
      Animated.spring(overlayY, { toValue: 0, delay: 200, useNativeDriver: true, friction: 7, tension: 80 }),
    ]).start();
  }, [overlayOpacity, overlayY]);

  // Cancel button spring on press
  const cancelScale = useRef(new Animated.Value(1)).current;
  const onCancelPressIn = () => Animated.spring(cancelScale, { toValue: 0.95, useNativeDriver: true, friction: 8 }).start();
  const onCancelPressOut = () => Animated.spring(cancelScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <Animated.View style={[styles.permContent, { opacity: permOpacity, transform: [{ translateY: permY }] }]}>
          <Text style={styles.text}>Allow the camera to scan your table code.</Text>
          <Animated.View style={{ transform: [{ scale: cancelScale }] }}>
            <Pressable
              style={styles.btn}
              onPress={requestPermission}
              onPressIn={onCancelPressIn}
              onPressOut={onCancelPressOut}
            >
              <Text style={styles.btnText}>Allow camera</Text>
            </Pressable>
          </Animated.View>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Not now</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity, transform: [{ translateY: overlayY }] }]}>
        <Text style={styles.msg}>{message}</Text>
        <Animated.View style={{ transform: [{ scale: cancelScale }] }}>
          <Pressable
            onPress={() => router.back()}
            style={styles.btn}
            onPressIn={onCancelPressIn}
            onPressOut={onCancelPressOut}
          >
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permContent: { alignItems: 'center', width: '100%' },
  text: { color: C.white, fontSize: 16, textAlign: 'center', marginBottom: 16 },
  overlay: { position: 'absolute', bottom: 60, left: 20, right: 20, alignItems: 'center', gap: 14 },
  msg: { color: C.white, backgroundColor: 'rgba(11,26,51,0.8)', padding: 12, borderRadius: 12, textAlign: 'center' },
  btn: { backgroundColor: C.navy2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: C.white, fontWeight: '600' },
  link: { color: C.gold, marginTop: 14 },
});
