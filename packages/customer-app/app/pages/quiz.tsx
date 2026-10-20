import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getJson, money, type Category, type Product } from '../../src/api';
import { recommend, type Kick, type QuizItem, type Taste, type Temp } from '../../src/quiz';
import { Page, ui } from '../../src/ui';
import { router } from 'expo-router';
import { C } from '../../src/theme';

const QUESTIONS = [
  { key: 'temp', title: 'Hot or cold?', options: [['hot', '☕', 'Hot'], ['iced', '🧊', 'Iced'], ['any', '🤷', 'Either']] },
  { key: 'taste', title: 'How do you like it?', options: [['bold', '💪', 'Strong & bold'], ['milky', '🥛', 'Smooth & milky'], ['sweet', '🍯', 'Sweet treat'], ['light', '🍃', 'Light, not coffee']] },
  { key: 'kick', title: 'How much of a kick?', options: [['high', '⚡', 'Wake me up'], ['some', '🙂', 'A little'], ['none', '😴', 'No caffeine']] },
] as const;

type Answers = { temp?: Temp; taste?: Taste; kick?: Kick };

export default function QuizScreen() {
  const menu = useQuery({
    queryKey: ['quiz-menu'],
    queryFn: async () => {
      const [p, c] = await Promise.all([getJson<Product[]>('/products'), getJson<Category[]>('/categories')]);
      const cats = new Map(c.map((x) => [x.id, x.name]));
      return p.map((x) => ({ ...x, category: cats.get(x.category_id) ?? '' }) as QuizItem & Product);
    },
  });
  const [answers, setAnswers] = useState<Answers>({});
  const step = QUESTIONS.findIndex((q) => !answers[q.key]);
  const done = step === -1;
  const picks = done && menu.data ? recommend(menu.data, answers.temp!, answers.taste!, answers.kick!) : [];

  return (
    <Page kicker="Not sure what to order?" title="Find your drink">
      {!done ? (
        <View style={ui.card}>
          <Text style={ui.sub}>Question {step + 1} of {QUESTIONS.length}</Text>
          <Text style={[ui.name, { fontSize: 22, marginTop: 4, marginBottom: 12 }]}>{QUESTIONS[step].title}</Text>
          <View style={ui.chips}>
            {QUESTIONS[step].options.map(([value, icon, label]) => (
              <Pressable key={value} style={ui.chip} onPress={() => setAnswers((a) => ({ ...a, [QUESTIONS[step].key]: value }))}>
                <Text style={ui.chipText}>{icon} {label}</Text>
              </Pressable>
            ))}
          </View>
          {step > 0 && (
            <Pressable onPress={() => setAnswers((a) => ({ ...a, [QUESTIONS[step - 1].key]: undefined }))}>
              <Text style={ui.link}>← Back</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <Text style={[ui.name, { fontSize: 20, marginBottom: 8 }]}>{picks.length ? 'We think you will love…' : 'Hmm, nothing matches exactly'}</Text>
          {menu.isLoading && <Text style={ui.lead}>Loading the menu…</Text>}
          {menu.data && picks.length === 0 && <Text style={ui.lead}>Try different answers, or browse the full menu.</Text>}
          {picks.map((p, i) => (
            <Pressable key={p.id} style={[ui.card, i === 0 && { borderColor: C.gold, borderWidth: 2 }]} onPress={() => router.push(`/product/${p.id}`)}>
              {i === 0 && <Text style={{ fontSize: 11, fontWeight: '700', color: C.caramel, textTransform: 'uppercase' }}>Best match</Text>}
              <Text style={ui.name}>{p.name}</Text>
              {!!p.description && <Text style={ui.sub} numberOfLines={2}>{p.description}</Text>}
              <Text style={[ui.sub, { color: C.navy2, fontWeight: '600' }]}>{money(p.base_price)}</Text>
            </Pressable>
          ))}
          <Pressable style={ui.button} onPress={() => setAnswers({})}>
            <Text style={ui.btnText}>Start again</Text>
          </Pressable>
        </>
      )}
    </Page>
  );
}
