import { Tabs } from 'expo-router';
import { C } from '../../src/theme';

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
      <Tabs.Screen name="index" options={{ title: 'Menu' }} />
      <Tabs.Screen name="offers" options={{ title: 'Offers' }} />
      <Tabs.Screen name="branches" options={{ title: 'Branches' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
