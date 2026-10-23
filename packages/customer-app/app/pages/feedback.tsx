import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  const tap = (n: number) => {
    onChange(n);
    // Bounce the tapped star and all filled ones
    scales.forEach((s, i) => {
      if (i < n) {
        Animated.sequence([
          Animated.timing(s, { toValue: 1.4, duration: 120, useNativeDriver: true }),
          Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ]).start();
      } else {
        Animated.timing(s, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      }
    });
  };

  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => tap(n)} hitSlop={8}>
          <Animated.Text style={[s.star, { transform: [{ scale: scales[n - 1] }], color: n <= value ? C.gold : C.line }]}>
            ★
          </Animated.Text>
        </Pressable>
      ))}
    </View>
  );
}

function SuccessView() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 6 }),
    ]).start();
  }, [opacity, translateY]);
  return (
    <Animated.View style={[s.success, { opacity, transform: [{ translateY }] }]}>
      <Text style={s.successIcon}>🎉</Text>
      <Text style={s.successTitle}>Thank you!</Text>
      <Text style={s.successSub}>Your feedback helps us improve every cup.</Text>
    </Animated.View>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function FeedbackScreen() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const { branch } = useLocalSearchParams<{ branch?: string }>();
  const [branchId, setBranchId] = useState(
    typeof branch === 'string' && /^[a-f0-9-]{36}$/i.test(branch) ? branch : '',
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    setError('');
    if (!branchId) return setError('Please choose the branch you visited.');
    if (!rating) return setError('Please tap a star rating.');
    setBusy(true);
    try {
      const res = await fetch(`${API}/branches/${branchId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error('send');
      setSent(true);
    } catch {
      setError('Could not send your feedback. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page kicker="Your visit" title="Feedback">
      {sent ? (
        <SuccessView />
      ) : (
        <>
          <Text style={ui.label}>Branch you visited</Text>
          <View style={ui.chips}>
            {(branches.data ?? []).map((b) => (
              <Pressable
                key={b.id}
                style={[ui.chip, branchId === b.id && ui.chipOn]}
                onPress={() => setBranchId(b.id)}>
                <Text style={[ui.chipText, branchId === b.id && ui.chipTextOn]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={ui.label}>Your rating</Text>
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <Text style={s.ratingLabel}>{LABELS[rating]}</Text>
          )}

          <Text style={[ui.label, { marginTop: 20 }]}>Comment (optional)</Text>
          <TextInput
            style={[ui.input, ui.area]}
            placeholder="What did you enjoy, or what could be better?"
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
            value={comment}
            onChangeText={setComment}
          />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
            <Text style={ui.btnText}>{busy ? 'Sending…' : 'Send feedback'}</Text>
          </Pressable>
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  star: { fontSize: 40 },
  ratingLabel: { fontSize: 15, fontWeight: '600', color: C.brown, marginBottom: 4 },
  success: { alignItems: 'center', paddingTop: 24 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: C.navy, marginBottom: 8 },
  successSub: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
});
