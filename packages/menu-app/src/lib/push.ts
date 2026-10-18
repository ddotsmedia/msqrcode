import axios from 'axios';

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Makes sure this phone gets notifications for the rewards card (asks permission once). Same flow as the card's "Get reminders".
export async function ensurePush(token: string): Promise<'ok' | 'unsupported' | 'blocked' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'blocked';
    const reg = await navigator.serviceWorker.ready;
    const { data } = await axios.get<{ key: string }>('/api/push/key');
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.key) }));
    await axios.post('/api/push/subscribe', { token, subscription: sub.toJSON() });
    return 'ok';
  } catch {
    return 'error';
  }
}
