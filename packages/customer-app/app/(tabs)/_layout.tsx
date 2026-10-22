import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../src/theme';

function Icon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.navy2,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Menu', tabBarIcon: ({ color }) => <Icon glyph="☕" color={color} /> }} />
      <Tabs.Screen name="offers" options={{ title: 'Offers', tabBarIcon: ({ color }) => <Icon glyph="🏷" color={color} /> }} />
      <Tabs.Screen name="branches" options={{ title: 'Branches', tabBarIcon: ({ color }) => <Icon glyph="📍" color={color} /> }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: ({ color }) => <Icon glyph="⭐" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Icon glyph="☰" color={color} /> }} />
    </Tabs>
  );
}
