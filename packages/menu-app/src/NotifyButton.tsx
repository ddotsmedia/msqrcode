import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLang } from './i18n';

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// "Get reminders" switch on the rewards card. iPhones only allow it once the site is added to the home screen.
export function NotifyButton({ token }: { token: string }) {
  const { t } = useLang();
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setOn(!!s))
      .catch(() => setOn(false));
  }, [supported]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setMsg(t('notifyBlocked'));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { data } = await axios.get<{ key: string }>('/api/push/key');
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.key) }));
      await axios.post('/api/push/subscribe', { token, subscription: sub.toJSON() });
      setOn(true);
      setMsg(t('notifyOnDone'));
    } catch {
      setMsg(t('notifyError'));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await axios.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setOn(false);
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return ios && !standalone ? <p className="text-xs text-gray-500">{t('notifyIosHint')}</p> : null;
  }
  if (on === null) return null;
  return (
    <div className="mt-3 border-t pt-2">
      <p className="text-xs font-semibold text-gray-700">{t('notifyTitle')}</p>
      <p className="text-xs text-gray-600 mt-0.5">{t('notifyText')}</p>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy || (typeof Notification !== 'undefined' && Notification.permission === 'denied' && !on)}
        className={`mt-2 px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${on ? 'border border-gray-300 text-gray-700' : 'bg-brand-700 text-white'}`}
      >
        {on ? t('notifyOff') : t('notifyOn')}
      </button>
      {msg && <p className="mt-1 text-xs text-gray-600">{msg}</p>}
      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && !on && <p className="mt-1 text-xs text-amber-700">{t('notifyBlocked')}</p>}
    </div>
  );
}
