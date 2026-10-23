import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GUIDES } from '../../../src/guides';
import { Page, ui } from '../../../src/ui';
import { C } from '../../../src/theme';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// SVG-style circular timer using Animated transforms
function CircularTimer({ progress, timeLeft, running }: { progress: number; timeLeft: number; running: boolean }) {
  const SIZE = 160;
  const STROKE = 10;
  const R = (SIZE - STROKE * 2) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  const animProgress = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(animProgress, { toValue: progress, duration: 500, useNativeDriver: false }).start();
  }, [progress]);

  const strokeDashoffset = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!running) { pulse.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [running, pulse]);

  return (
    <Animated.View style={[ct.wrapper, { transform: [{ scale: pulse }] }]}>
      {/* Background ring */}
      <View style={ct.ring}>
        <View style={ct.ringTrack} />
      </View>
      {/* Foreground arc (simulated with border) */}
      <View style={[ct.arc, { borderColor: running ? C.navy2 : C.caramel }]} />
      {/* Center content */}
      <View style={ct.center}>
        <Text style={[ct.time, { color: running ? C.navy2 : C.muted }]}>{fmt(timeLeft)}</Text>
        <Text style={ct.timeSub}>{running ? 'remaining' : timeLeft === 0 ? 'done ✓' : 'paused'}</Text>
      </View>
    </Animated.View>
  );
}

function StepCard({ text, stepNum, total }: { text: string; stepNum: number; total: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [stepNum]);

  return (
    <Animated.View style={[sc.card, { opacity, transform: [{ translateY }] }]}>
      <View style={sc.badgeRow}>
        <View style={sc.badge}>
          <Text style={sc.badgeText}>{stepNum}</Text>
        </View>
        <Text style={sc.progress}>Step {stepNum} of {total}</Text>
      </View>
      <Text style={sc.text}>{text}</Text>
    </Animated.View>
  );
}

function BrewSuccess({ onReset }: { onReset: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[doneStyles.wrap, { opacity, transform: [{ scale }] }]}>
      <Text style={doneStyles.emoji}>☕</Text>
      <Text style={doneStyles.title}>Enjoy your coffee!</Text>
      <Text style={doneStyles.sub}>Your brew is ready. Sit back and savour it.</Text>
      <Pressable style={[ui.button, { alignSelf: 'stretch', marginTop: 20 }]} onPress={onReset}>
        <Text style={ui.btnText}>Brew again</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function GuideScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const g = GUIDES.find((x) => x.slug === slug);
  const [coffee, setCoffee] = useState(g?.coffee ?? 15);
  const [step, setStep] = useState(-1);
  const [left, setLeft] = useState(0);
  const [initial, setInitial] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  useEffect(() => {
    if (running && left === 0) setRunning(false);
  }, [left, running]);

  if (!g) return <Page title="Guide not found">{null}</Page>;

  const water = Math.round(Math.max(1, coffee) * g.ratio);
  const go = (i: number) => {
    setStep(i);
    const secs = g.steps[i]?.seconds ?? 0;
    setLeft(secs);
    setInitial(secs);
    setRunning(secs > 0);
  };
  const done = step >= g.steps.length;
  const currentStep = g.steps[step];
  const timerProgress = initial > 0 ? (initial - left) / initial : 0;

  return (
    <Page kicker={g.time} title={g.name}>
      <Text style={ui.lead}>{g.tagline}</Text>

      {/* Ratio calculator */}
      <View style={ui.card}>
        <Text style={ui.name}>Ratio calculator</Text>
        <View style={styles.ratioRow}>
          <View style={styles.ratioInputWrap}>
            <TextInput
              style={styles.ratioInput}
              keyboardType="number-pad"
              value={String(coffee)}
              onChangeText={(v) => setCoffee(Math.min(500, Number(v) || 1))}
              accessibilityLabel="Coffee in grams"
            />
            <Text style={styles.ratioUnit}>g coffee</Text>
          </View>
          <Text style={styles.ratioArrow}>→</Text>
          <View style={styles.ratioResult}>
            <Text style={styles.ratioResultNum}>{water}</Text>
            <Text style={styles.ratioUnit}>{g.slug === 'arabic-coffee' ? 'ml' : 'g'} water</Text>
          </View>
        </View>
        {g.extra && <Text style={[ui.sub, { marginTop: 8 }]}>{g.extra}</Text>}
      </View>

      {/* Specs */}
      <View style={styles.specsRow}>
        {[['Grind', g.grind], ['Water', g.water], ['Ratio', `1 : ${g.ratio}`]].map(([label, val]) => (
          <View key={label} style={styles.specChip}>
            <Text style={styles.specLabel}>{label}</Text>
            <Text style={styles.specValue}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Steps section */}
      <Text style={ui.label}>Steps</Text>

      {step === -1 ? (
        <Pressable style={ui.button} onPress={() => go(0)}>
          <Text style={ui.btnText}>Start brewing ☕</Text>
        </Pressable>
      ) : done ? (
        <BrewSuccess onReset={() => setStep(-1)} />
      ) : (
        <>
          <StepCard text={currentStep.text} stepNum={step + 1} total={g.steps.length} />

          {currentStep.seconds ? (
            <CircularTimer progress={timerProgress} timeLeft={left} running={running} />
          ) : null}

          <View style={styles.btnRow}>
            {currentStep.seconds ? (
              <Pressable
                style={[ui.button, styles.flex1, { marginTop: 0 }]}
                onPress={() => setRunning((r) => !r)}>
                <Text style={ui.btnText}>{running ? 'Pause' : left > 0 ? 'Resume' : 'Restart'}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[ui.button, styles.flex1, { marginTop: 0, backgroundColor: C.caramel }]}
              onPress={() => go(step + 1)}>
              <Text style={ui.btnText}>{step + 1 === g.steps.length ? 'Finish ✓' : 'Next →'}</Text>
            </Pressable>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>{g.tip}</Text>
          </View>
        </>
      )}
    </Page>
  );
}

const ct = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    borderColor: C.line,
  },
  ringTrack: { flex: 1 },
  arc: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    borderColor: C.navy2,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  center: { alignItems: 'center' },
  time: { fontSize: 32, fontWeight: '700' },
  timeSub: { fontSize: 12, color: C.muted, marginTop: 2 },
});

const sc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 12,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.navy2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: C.white, fontWeight: '700', fontSize: 14 },
  progress: { fontSize: 12, color: C.muted, fontWeight: '600' },
  text: { fontSize: 16, color: C.navy, lineHeight: 24 },
});

const doneStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20 },
  emoji: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: C.navy, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
});

const styles = StyleSheet.create({
  ratioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  ratioInputWrap: { alignItems: 'center' },
  ratioInput: {
    backgroundColor: C.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '700',
    color: C.navy,
    textAlign: 'center',
    width: 80,
    marginBottom: 4,
  },
  ratioUnit: { fontSize: 12, color: C.muted },
  ratioArrow: { fontSize: 22, color: C.muted, fontWeight: '300' },
  ratioResult: { alignItems: 'center' },
  ratioResultNum: { fontSize: 28, fontWeight: '700', color: C.navy2, marginBottom: 4 },
  specsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  specChip: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  specLabel: { fontSize: 10, fontWeight: '700', color: C.brown, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  specValue: { fontSize: 12, color: C.navy, fontWeight: '600', textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex1: { flex: 1 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fef9ec',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  tipIcon: { fontSize: 16, marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, color: C.brown, lineHeight: 19 },
});
