import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '../src/cart';
import { C } from '../src/theme';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

export default function RootLayout() {
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
          </Stack>
        </CartProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
