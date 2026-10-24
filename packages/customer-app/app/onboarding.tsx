/**
 * Onboarding flow — 3-screen intro shown once on first launch.
 * Shown from _layout.tsx when AsyncStorage key 'msq_onboarded' is absent.
 * On "Get started" the key is set and the user lands on the main tabs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../src/theme';

export const ONBOARDED_KEY = 'msq_onboarded';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '☕',
    title: 'Welcome to Milestones',
    body: 'Your favourite specialty coffee, right from your phone. Browse the menu, order ahead, and collect your drinks with ease.',
    bg: C.navy,
    accent: C.gold,
  },
  {
    emoji: '⭐',
    title: 'Earn rewards with every visit',
    body: 'Collect a stamp with every drink. Reach 10 stamps and enjoy a free coffee — on us. Plus birthday treats and double-stamp days.',
    bg: C.navy2,
    accent: C.caramel,
  },
  {
    emoji: '📱',
    title: 'Scan, order, enjoy',
    body: 'Scan the QR code on your table to start an order, or pick up from any branch. Track your order live from placed to ready.',
    bg: '#1a2f1a',
    accent: C.gold,
  },
] as const;

// Individual slide with staggered entrance animations
function Slide({ slide, active }: { slide: typeof SLIDES[number]; active: boolean }) {
  const emojiScale = useRef(new Animated.Value(0.6)).current;
  const emojiOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!active) return;
    // Staggered: emoji → title → body
    Animated.sequence([
      Animated.parallel([
        Animated.spring(emojiScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 100 }),
        Animated.timing(emojiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(titleY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
      ]),
      Animated.parallel([
        Animated.timing(bodyOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(bodyY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
      ]),
    ]).start();
    return () => {
      emojiScale.setValue(0.6);
      emojiOpacity.setValue(0);
      titleOpacity.setValue(0);
      titleY.setValue(20);
      bodyOpacity.setValue(0);
      bodyY.setValue(16);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View style={[s.slide, { backgroundColor: slide.bg }]}>
      <Animated.Text style={[s.emoji, { opacity: emojiOpacity, transform: [{ scale: emojiScale }] }]}>
        {slide.emoji}
      </Animated.Text>
      <Animated.Text style={[s.title, { color: slide.accent, opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        {slide.title}
      </Animated.Text>
      <Animated.Text style={[s.body, { opacity: bodyOpacity, transform: [{ translateY: bodyY }] }]}>
        {slide.body}
      </Animated.Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const goTo = (next: number) => {
    const dir = next > index ? 1 : -1;
    // Slide out current, slide in next
    Animated.timing(slideX, { toValue: -dir * width, duration: 250, useNativeDriver: true }).start(() => {
      slideX.setValue(dir * width);
      setIndex(next);
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }).start();
    });
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    router.replace('/(tabs)');
  };

  const slide = SLIDES[index];

  // Dot press scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn = () => Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true, friction: 8 }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[s.screen, { backgroundColor: slide.bg }]}>
      {/* Slides */}
      <Animated.View style={[s.slideWrap, { transform: [{ translateX: slideX }] }]}>
        <Slide slide={slide} active />
      </Animated.View>

      {/* Dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => i < index ? goTo(i) : undefined}>
            <View style={[s.dot, i === index && s.dotActive, { backgroundColor: i === index ? slide.accent : 'rgba(255,255,255,0.3)' }]} />
          </Pressable>
        ))}
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <Animated.View style={[s.btnWrap, { transform: [{ scale: btnScale }] }]}>
          <Pressable
            style={[s.btn, { backgroundColor: slide.accent }]}
            onPress={isLast ? finish : () => goTo(index + 1)}
            onPressIn={onBtnIn}
            onPressOut={onBtnOut}
          >
            <Text style={[s.btnText, { color: slide.bg }]}>
              {isLast ? 'Get started' : 'Next'}
            </Text>
          </Pressable>
        </Animated.View>

        {!isLast && (
          <Pressable onPress={finish} style={s.skipBtn}>
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  slideWrap: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  emoji: { fontSize: 80, marginBottom: 28 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: { width: 24, borderRadius: 4 },

  actions: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 12,
  },
  btnWrap: {},
  btn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 6 },
  skipText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '500' },
});
