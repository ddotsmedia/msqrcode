import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { API, getJson, type Branch } from '../../src/api';
import { Page, ui } from '../../src/ui';
import { C } from '../../src/theme';

export default function FeedbackScreen() {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => getJson<Branch[]>('/branches') });
  const [branchId, setBranchId] = useState('');
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
        <Text style={ui.ok}>Thank you for your feedback. It helps us improve.</Text>
      ) : (
        <>
          <Text style={ui.label}>Branch</Text>
          <View style={ui.chips}>
            {(branches.data ?? []).map((b) => (
              <Pressable key={b.id} style={[ui.chip, branchId === b.id && ui.chipOn]} onPress={() => setBranchId(b.id)}>
                <Text style={[ui.chipText, branchId === b.id && ui.chipTextOn]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={ui.label}>Rating</Text>
          <Text style={{ fontSize: 34, letterSpacing: 6, color: C.gold }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={n} onPress={() => setRating(n)} style={{ color: n <= rating ? C.gold : C.line }}>★</Text>
            ))}
          </Text>
          <Text style={ui.label}>Comment (optional)</Text>
          <TextInput style={[ui.input, ui.area]} placeholder="What did you enjoy, or what could be better?" placeholderTextColor={C.muted} multiline maxLength={500} value={comment} onChangeText={setComment} />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Pressable style={[ui.button, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
            <Text style={ui.btnText}>{busy ? 'Sending…' : 'Send feedback'}</Text>
          </Pressable>
        </>
      )}
    </Page>
  );
}
