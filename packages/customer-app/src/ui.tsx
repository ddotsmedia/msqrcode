import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';

/**
 * Animated empty-state card: icon bounces in, title + body fade up.
 * Drop-in replacement for static empty-state Views.
 */
export function AnimatedEmptyState({
  icon,
  title,
  body,
  action,
  onAction,
  style,
}: {
  icon: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  style?: object;
}) {
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(14)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBtnIn = () => Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true, friction: 8 }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <View style={[emptyStyles.card, style]}>
      <Animated.Text style={[emptyStyles.icon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
        {icon}
      </Animated.Text>
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
        <Text style={emptyStyles.title}>{title}</Text>
        <Text style={emptyStyles.body}>{body}</Text>
        {!!action && !!onAction && (
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable style={emptyStyles.btn} onPress={onAction} onPressIn={onBtnIn} onPressOut={onBtnOut}>
              <Text style={emptyStyles.btnText}>{action}</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    marginTop: 8,
  },
  icon: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: C.navy, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  btn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: C.white, fontWeight: '600', fontSize: 15 },
});

/** Error state with a retry button — fires Medium haptic on retry press. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={errStyles.card}>
      <Text style={errStyles.icon}>⚠️</Text>
      <Text style={errStyles.msg}>{message ?? 'Something went wrong.'}</Text>
      {!!onRetry && (
        <Pressable
          style={errStyles.btn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onRetry();
          }}
        >
          <Text style={errStyles.btnText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const errStyles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.line, marginTop: 8 },
  icon: { fontSize: 36, marginBottom: 10 },
  msg: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  btn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
  btnText: { color: C.white, fontWeight: '600', fontSize: 14 },
});

// Shared page frame for the secondary screens (back link, kicker, title).
export function Page({ title, kicker, children, onRefresh, refreshing }: { title: string; kicker?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.navy2} /> : undefined}
    >
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={ui.back}>‹ Back</Text>
      </Pressable>
      {kicker ? <Text style={ui.kicker}>{kicker}</Text> : null}
      <Text style={ui.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  back: { color: C.brown, fontWeight: '600', marginBottom: 10, fontSize: 16 },
  kicker: { fontSize: 12, fontWeight: '700', color: C.caramel, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '600', color: C.navy, marginBottom: 12 },
  lead: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy2, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  input: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 16, color: C.navy, marginBottom: 10 },
  area: { minHeight: 90, textAlignVertical: 'top' },
  button: { backgroundColor: C.navy2, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: C.white, fontWeight: '600', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: C.white },
  chipOn: { backgroundColor: C.navy2, borderColor: C.navy2 },
  chipText: { color: C.navy, fontWeight: '600' },
  chipTextOn: { color: C.white },
  error: { color: '#b91c1c', marginBottom: 8 },
  ok: { color: C.green, fontSize: 16, fontWeight: '600', marginTop: 12, lineHeight: 22 },
  name: { fontSize: 17, fontWeight: '600', color: C.navy },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  link: { color: C.brown, fontWeight: '600', marginTop: 8 },
});
