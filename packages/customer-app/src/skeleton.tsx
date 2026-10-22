/**
 * Animated shimmer skeleton for loading states.
 * Usage: <SkeletonCard /> or <SkeletonRow />
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { C } from './theme';

function Shimmer({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: C.line, borderRadius: 8 }, style, { opacity }]} />;
}

/** A card-shaped skeleton block (for rewards, orders). */
export function SkeletonCard() {
  return (
    <View style={s.card}>
      <Shimmer style={s.title} />
      <Shimmer style={s.sub} />
      <Shimmer style={s.sub2} />
    </View>
  );
}

/** A row-shaped skeleton block (for menu items). */
export function SkeletonRow() {
  return (
    <View style={s.row}>
      <Shimmer style={s.thumb} />
      <View style={s.rowBody}>
        <Shimmer style={s.rowTitle} />
        <Shimmer style={s.rowDesc} />
      </View>
      <Shimmer style={s.price} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  title: { height: 18, width: '60%', marginBottom: 10 },
  sub: { height: 13, width: '85%', marginBottom: 8 },
  sub2: { height: 13, width: '50%' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  thumb: { width: 56, height: 56, borderRadius: 12, marginRight: 12, flexShrink: 0 },
  rowBody: { flex: 1, paddingRight: 8 },
  rowTitle: { height: 16, width: '70%', marginBottom: 8 },
  rowDesc: { height: 13, width: '90%' },
  price: { width: 40, height: 16 },
});
