import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { CartProvider } from '../src/cart';
import { registerForPush } from '../src/push';
import { C } from '../src/theme';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

export default function RootLayout() {
  useEffect(() => {
    registerForPush();
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <CartProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="cart" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="scan" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="gift" options={{ headerShown: false }} />
            <Stack.Screen name="group/index" options={{ headerShown: false }} />
            <Stack.Screen name="group/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="business" options={{ headerShown: false }} />
            <Stack.Screen name="pages" options={{ headerShown: false }} />
            <Stack.Screen name="orders" options={{ headerShown: false }} />
          </Stack>
        </CartProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
