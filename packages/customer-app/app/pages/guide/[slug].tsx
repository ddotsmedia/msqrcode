import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GUIDES } from '../../../src/guides';
import { Page, ui } from '../../../src/ui';
import { C } from '../../../src/theme';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function GuideScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const g = GUIDES.find((x) => x.slug === slug);
  const [coffee, setCoffee] = useState(g?.coffee ?? 15);
  const [step, setStep] = useState(-1); // -1 = not started
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  // A timed step finished: stop the clock. The user moves on with "Next".
  useEffect(() => {
    if (running && left === 0) setRunning(false);
  }, [left, running]);

  if (!g) return <Page title="Guide not found">{null}</Page>;

  const water = Math.round(Math.max(1, coffee) * g.ratio);
  const go = (i: number) => {
    setStep(i);
    const s = g.steps[i]?.seconds ?? 0;
    setLeft(s);
    setRunning(s > 0);
  };
  const done = step >= g.steps.length;

  return (
    <Page kicker={g.time} title={g.name}>
      <Text style={ui.lead}>{g.tagline}</Text>
      <View style={ui.card}>
        <Text style={ui.name}>How much?</Text>
        <View style={[ui.chips, { alignItems: 'center', marginTop: 10 }]}>
          <TextInput
            style={[ui.input, { width: 90, marginBottom: 0 }]}
            keyboardType="number-pad"
            value={String(coffee)}
            onChangeText={(v) => setCoffee(Math.min(500, Number(v) || 1))}
            accessibilityLabel="Coffee in grams"
          />
          <Text style={ui.sub}>g coffee → </Text>
          <Text style={[ui.name, { color: C.navy2 }]}>{water} {g.slug === 'arabic-coffee' ? 'ml' : 'g'}</Text>
          <Text style={ui.sub}>water{g.unit ? ` (${g.unit})` : ''}</Text>
        </View>
        {g.extra && <Text style={[ui.sub, { marginTop: 10 }]}>{g.extra}</Text>}
      </View>
      <View style={ui.card}>
        <Text style={ui.sub}>Grind: {g.grind}</Text>
        <Text style={ui.sub}>Water: {g.water}</Text>
        <Text style={ui.sub}>Ratio: 1 : {g.ratio}</Text>
      </View>

      <Text style={ui.label}>Steps</Text>
      {step === -1 ? (
        <Pressable style={ui.button} onPress={() => go(0)}>
          <Text style={ui.btnText}>Start brewing</Text>
        </Pressable>
      ) : done ? (
        <>
          <Text style={ui.ok}>Enjoy your coffee.</Text>
          <Pressable style={[ui.button, { marginTop: 10 }]} onPress={() => setStep(-1)}>
            <Text style={ui.btnText}>Brew again</Text>
          </Pressable>
        </>
      ) : (
        <View style={ui.card}>
          <Text style={ui.sub}>Step {step + 1} of {g.steps.length}</Text>
          <Text style={[ui.name, { fontSize: 17, marginVertical: 8 }]}>{g.steps[step].text}</Text>
          {g.steps[step].seconds ? (
            <Text style={{ fontSize: 34, fontWeight: '600', color: running ? C.navy2 : C.muted }}>{fmt(left)}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {g.steps[step].seconds ? (
              <Pressable style={[ui.button, { flex: 1, marginTop: 0 }]} onPress={() => setRunning((r) => !r)}>
                <Text style={ui.btnText}>{running ? 'Pause' : left > 0 ? 'Resume' : 'Restart timer'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={[ui.button, { flex: 1, marginTop: 0, backgroundColor: C.caramel }]} onPress={() => go(step + 1)}>
              <Text style={ui.btnText}>{step + 1 === g.steps.length ? 'Finish' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {step >= 0 && !done && <Text style={[ui.sub, { marginTop: 4 }]}>Tip: {g.tip}</Text>}
    </Page>
  );
}
