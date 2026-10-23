import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getJson, money, type Category, type Product } from '../../src/api';
import type { ProductFull } from '../../src/types';
import { recommend, type Kick, type QuizItem, type Taste, type Temp } from '../../src/quiz';
import { useCart } from '../../src/cart';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

const QUESTIONS = [
  {
    key: 'temp' as const,
    title: 'Hot or cold?',
    sub: 'Start with the basics.',
    options: [
      { value: 'hot' as Temp, icon: '☕', label: 'Hot' },
      { value: 'iced' as Temp, icon: '🧊', label: 'Iced' },
      { value: 'any' as Temp, icon: '🤷', label: 'Either' },
    ],
  },
  {
    key: 'taste' as const,
    title: 'How do you like it?',
    sub: 'Pick the flavour profile that suits you.',
    options: [
      { value: 'bold' as Taste, icon: '💪', label: 'Strong & bold' },
      { value: 'milky' as Taste, icon: '🥛', label: 'Smooth & milky' },
      { value: 'sweet' as Taste, icon: '🍯', label: 'Sweet treat' },
      { value: 'light' as Taste, icon: '🍃', label: 'Light, not coffee' },
    ],
  },
  {
    key: 'kick' as const,
    title: 'How much of a kick?',
    sub: 'How alert do you need to be?',
    options: [
      { value: 'high' as Kick, icon: '⚡', label: 'Wake me up' },
      { value: 'some' as Kick, icon: '🙂', label: 'A little' },
      { value: 'none' as Kick, icon: '😴', label: 'No caffeine' },
    ],
  },
];

type Answers = { temp?: Temp; taste?: Taste; kick?: Kick };

function ProgressBar({ step, total }: { step: number; total: number }) {
  const anim = useRef(new Animated.Value(step / total)).current;
  Animated.timing(anim, { toValue: step / total, duration: 300, useNativeDriver: false }).start();
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={s.progressTrack}>
      <Animated.View style={[s.progressFill, { width }]} />
    </View>
  );
}

export default function QuizScreen() {
  const { add } = useCart();
  const menu = useQuery({
    queryKey: ['quiz-menu'],
    queryFn: async () => {
      const [p, c] = await Promise.all([getJson<Product[]>('/products'), getJson<Category[]>('/categories')]);
      const cats = new Map(c.map((x) => [x.id, x.name]));
      return p.map((x) => ({ ...x, category: cats.get(x.category_id) ?? '' }) as QuizItem & Product);
    },
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [adding, setAdding] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const step = QUESTIONS.findIndex((q) => !answers[q.key as keyof Answers]);
  const done = step === -1;
  const picks = done && menu.data ? recommend(menu.data, answers.temp!, answers.taste!, answers.kick!) : [];

  const animateNext = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      cb();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    });
  };

  const answer = (key: keyof Answers, value: Temp | Taste | Kick) => {
    animateNext(() => setAnswers((a) => ({ ...a, [key]: value })));
  };

  const back = () => {
    const prevKey = QUESTIONS[step > 0 ? step - 1 : 0].key as keyof Answers;
    animateNext(() => setAnswers((a) => ({ ...a, [prevKey]: undefined })));
  };

  const reset = () => {
    animateNext(() => setAnswers({}));
  };

  const addToCart = (p: Product) => {
    setAdding(p.id);
    add(p as unknown as ProductFull, 1, {}, '');
    setTimeout(() => setAdding(null), 600);
  };

  const currentQ = !done ? QUESTIONS[step] : null;

  return (
    <Page kicker="Not sure what to order?" title="Find your drink">
      {!done && currentQ ? (
        <>
          <ProgressBar step={step} total={QUESTIONS.length} />
          <Text style={s.stepLabel}>Step {step + 1} of {QUESTIONS.length}</Text>
          <Animated.View style={[s.questionCard, { transform: [{ translateX: slideAnim }] }]}>
            <Text style={s.qTitle}>{currentQ.title}</Text>
            <Text style={s.qSub}>{currentQ.sub}</Text>
            <View style={s.optionsGrid}>
              {currentQ.options.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={s.optionBtn}
                  onPress={() => answer(currentQ.key as keyof Answers, opt.value)}>
                  <Text style={s.optionIcon}>{opt.icon}</Text>
                  <Text style={s.optionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {step > 0 && (
              <Pressable onPress={back} style={s.backLink}>
                <Text style={ui.link}>← Back</Text>
              </Pressable>
            )}
          </Animated.View>
        </>
      ) : (
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          <Text style={s.resultTitle}>
            {picks.length ? '✨ We think you\'ll love…' : '🤔 Hmm, nothing matches exactly'}
          </Text>
          {menu.isLoading && <Text style={ui.lead}>Loading the menu…</Text>}
          {menu.data && picks.length === 0 && (
            <Text style={ui.lead}>Try different answers, or browse the full menu.</Text>
          )}
          {picks.map((p, i) => (
            <View key={p.id} style={[s.resultCard, i === 0 && s.resultCardTop]}>
              {i === 0 && (
                <View style={s.bestMatchRow}>
                  <Text style={s.bestMatch}>⭐ Best match</Text>
                </View>
              )}
              <Text style={s.resultName}>{p.name}</Text>
              {!!p.description && (
                <Text style={s.resultDesc} numberOfLines={2}>{p.description}</Text>
              )}
              <Text style={s.resultPrice}>{money(p.base_price)}</Text>
              <View style={s.resultActions}>
                <Pressable style={s.detailBtn} onPress={() => router.push(`/product/${p.id}`)}>
                  <Text style={s.detailText}>View</Text>
                </Pressable>
                <Pressable
                  style={[s.addBtn, adding === p.id && { opacity: 0.6 }]}
                  disabled={adding === p.id}
                  onPress={() => addToCart(p as unknown as Product)}>
                  <Text style={s.addText}>{adding === p.id ? 'Adding…' : '+ Add to cart'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable style={[ui.button, { marginTop: 8 }]} onPress={reset}>
            <Text style={ui.btnText}>Start again</Text>
          </Pressable>
        </Animated.View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  progressTrack: { height: 6, backgroundColor: C.line, borderRadius: 999, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.navy2, borderRadius: 999 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  questionCard: { backgroundColor: C.white, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: C.line },
  qTitle: { fontSize: 24, fontWeight: '700', color: C.navy, marginBottom: 6 },
  qSub: { fontSize: 14, color: C.muted, marginBottom: 20 },
  optionsGrid: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.cream,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
  optionIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '600', color: C.navy },
  backLink: { marginTop: 16 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: C.navy, marginBottom: 16 },
  resultCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  resultCardTop: { borderColor: C.gold, borderWidth: 2 },
  bestMatchRow: { marginBottom: 8 },
  bestMatch: { fontSize: 12, fontWeight: '700', color: C.caramel, textTransform: 'uppercase', letterSpacing: 1 },
  resultName: { fontSize: 18, fontWeight: '700', color: C.navy, marginBottom: 4 },
  resultDesc: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 8 },
  resultPrice: { fontSize: 15, fontWeight: '700', color: C.navy2, marginBottom: 14 },
  resultActions: { flexDirection: 'row', gap: 8 },
  detailBtn: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingVertical: 9, paddingHorizontal: 16,
  },
  detailText: { color: C.navy, fontWeight: '600', fontSize: 14 },
  addBtn: { flex: 1, backgroundColor: C.navy2, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  addText: { color: C.white, fontWeight: '600', fontSize: 14 },
});
