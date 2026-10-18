// Anonymous Offers page counts (views, code copies, shares…), sent in small batches.
type Ev = { promotion_id: string; type: string };
let queue: Ev[] = [];
let timer: number | null = null;
const URL_ = '/api/offers/events';

function flush() {
  if (timer) window.clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 30) });
  try {
    if (!navigator.sendBeacon?.(URL_, new Blob([body], { type: 'application/json' }))) throw new Error('no beacon');
  } catch {
    fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  }
  if (queue.length) timer = window.setTimeout(flush, 500);
}

export function trackOffer(promotion_id: string, type: string) {
  queue.push({ promotion_id, type });
  if (queue.length >= 30) flush();
  else if (!timer) timer = window.setTimeout(flush, 3000);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
