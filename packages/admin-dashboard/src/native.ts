// Staff app (iPhone / Android / tablets) runs this admin panel from local files: API calls go to the live
// server, and the device registers for alerts (new orders, customers outside, table calls) after sign-in.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
const SERVER = (import.meta.env.VITE_ADMIN_ORIGIN as string | undefined) || 'https://admin.coffeesales.ae';

export function routeApiToServer() {
  if (!isNative) return;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(typeof input === 'string' && input.startsWith('/api') ? `${SERVER}${input}` : input, init);
}

let registered = false;
export async function registerStaffPush(token: string) {
  if (!isNative || registered || (Capacitor.getPlatform() === 'android' && import.meta.env.VITE_PUSH !== '1')) return;
  registered = true;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.addListener('registration', (t) => {
    fetch('/api/push/staff-devices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: t.value, platform: Capacitor.getPlatform() }),
    }).catch(() => undefined);
  });
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
  if (perm.receive === 'granted') await PushNotifications.register();
}
