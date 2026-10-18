// The iPhone / Android app (Capacitor) runs this same React app from local files. This file is the bridge:
// API calls go to the live server, shared links use the public site address, and native features plug in.
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
const SITE = (import.meta.env.VITE_SITE_ORIGIN as string | undefined) || 'https://coffeesales.ae';
// Links people share (gift cards, group orders, referrals) must point at the website, not the app's local address.
export const PUBLIC_ORIGIN = isNative ? SITE : window.location.origin;

// In the app every '/api/…' call goes to the live server.
export function routeApiToServer() {
  if (!isNative) return;
  axios.defaults.baseURL = SITE;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(typeof input === 'string' && input.startsWith('/api') ? `${SITE}${input}` : input, init);
  const beacon = navigator.sendBeacon?.bind(navigator);
  if (beacon) navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => beacon(typeof url === 'string' && url.startsWith('/api') ? `${SITE}${url}` : url, data);
}

const loyaltyToken = () => {
  try {
    return localStorage.getItem('milestones_loyalty_token') || undefined;
  } catch {
    return undefined;
  }
};

// Native push: ask once, send the phone's token (with its rewards card) to the server, open the page a tap points to.
export async function setupPush(go: (path: string) => void) {
  // Android push needs the Firebase config baked into the build (VITE_PUSH=1); without it registering would crash.
  if (!isNative || (platform === 'android' && import.meta.env.VITE_PUSH !== '1')) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.addListener('registration', (t) => {
    try {
      localStorage.setItem('msq_device_token', t.value);
    } catch {
      /* ignore */
    }
    axios.post('/api/push/devices', { token: t.value, platform, loyalty_token: loyaltyToken() }).catch(() => undefined);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const url = a.notification.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) go(url);
  });
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
  if (perm.receive === 'granted') await PushNotifications.register();
}

// Re-link the phone to the rewards card after joining or switching cards.
export function linkDeviceToCard() {
  if (!isNative) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem('msq_device_token');
  } catch {
    token = null;
  }
  if (token) axios.post('/api/push/devices', { token, platform, loyalty_token: loyaltyToken() }).catch(() => undefined);
}

// coffeesales.ae links (gift cards, group orders, offers, table QR) open inside the app.
export async function setupDeepLinks(go: (path: string) => void) {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      go(`${u.pathname}${u.search}`);
    } catch {
      /* not a link we know */
    }
  });
  await App.addListener('resume', linkDeviceToCard);
}

// Is this app version older than the minimum the server asks for?
export async function updateNeeded(): Promise<string | null> {
  if (!isNative) return null;
  const { App } = await import('@capacitor/app');
  const [{ version }, { data }] = await Promise.all([App.getInfo(), axios.get('/api/app/version')]);
  const num = (v: string) => v.split('.').map((n) => Number(n) || 0);
  const [a, b] = [num(version), num(String(data?.min_version ?? '0'))];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0) ? (platform === 'ios' ? data.ios_url : data.android_url) || '' : null;
  return null;
}

// Native camera scanner (returns the QR text, or null if cancelled).
export async function scanNative(): Promise<string | null> {
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
  try {
    const r = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.QR_CODE, scanInstructions: 'Point at the QR code on your table' });
    return r?.ScanResult || null;
  } catch {
    return null;
  }
}
