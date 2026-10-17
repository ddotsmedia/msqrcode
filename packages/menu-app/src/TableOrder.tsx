import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useLang } from './i18n';
import { pickupSlots } from './lib/hours';

// Ordering from the table QR menu: cart, "send to the counter" and live status. Payment is at the counter.

export interface Choice {
  name: string;
  price_adjustment: number;
}
export interface ChoiceGroup {
  id: string;
  name: string;
  display_order?: number;
  options?: { choices?: Choice[] } | null;
}
export interface OrderableProduct {
  id: string;
  name: string;
  base_price: number | string;
  variants?: ChoiceGroup[];
  option_groups?: ChoiceGroup[];
}
export interface CartLine {
  key: string;
  product_id: string;
  name: string;
  qty: number;
  unit: number;
  choices: Record<string, string>; // group id -> choice name
  labels: string[];
  note: string;
}
interface Placed {
  id: string;
  token: string;
  order_no: string;
  at: number;
  status?: string;
  seen?: boolean;
  pickup?: string; // pickup time label, for order-ahead
}
interface Tracked {
  order_no: string;
  status: string;
  total: number;
  items: {
    name: string;
    qty: number;
    unit_price: number;
    options?: { choices?: { choice: string }[]; note?: string | null } | null;
  }[];
}

const money = (n: number) => `AED ${n.toFixed(2)}`;
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the cart just won't survive a reload */
  }
};

export function groupsOf(p: OrderableProduct) {
  const sort = (g: ChoiceGroup[] = []) => [...g].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return [...sort(p.variants), ...sort(p.option_groups)].filter((g) => (g.options?.choices ?? []).length > 0);
}

export function unitPrice(p: OrderableProduct, picked: Record<string, string>) {
  let n = Number(p.base_price) || 0;
  for (const g of groupsOf(p)) {
    const list = g.options?.choices ?? [];
    const c = list.find((x) => x.name === picked[g.id]) ?? list[0];
    n += Number(c?.price_adjustment) || 0;
  }
  return Math.max(0, Math.round(n * 100) / 100);
}

export function useCart(branchId: string, table: string) {
  const key = `msq_cart_${branchId}_${table}`;
  const [lines, setLines] = useState<CartLine[]>(() => read<CartLine[]>(key, []));
  useEffect(() => write(key, lines), [key, lines]);

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const k = `${line.product_id}|${JSON.stringify(line.choices)}|${line.note}`;
    setLines((prev) => {
      const hit = prev.find((l) => l.key === k);
      if (hit) return prev.map((l) => (l.key === k ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l));
      return [...prev, { ...line, key: k }];
    });
  }, []);
  const setQty = useCallback((k: string, qty: number) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== k) : prev.map((l) => (l.key === k ? { ...l, qty: Math.min(20, qty) } : l))));
  }, []);
  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = Math.round(lines.reduce((s, l) => s + l.unit * l.qty, 0) * 100) / 100;
  return { lines, add, setQty, clear, count, total };
}
export type Cart = ReturnType<typeof useCart>;

// Choices, quantity and note inside the product sheet.
export function AddToOrder({
  product,
  available,
  onAdd,
  discount,
}: {
  product: OrderableProduct;
  available: boolean;
  onAdd: (line: Omit<CartLine, 'key'>) => void;
  discount?: number; // happy-hour %
}) {
  const { t } = useLang();
  const groups = useMemo(() => groupsOf(product), [product]);
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [g.id, g.options!.choices![0].name])));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const unit = discount ? Math.round(unitPrice(product, picked) * (100 - discount)) / 100 : unitPrice(product, picked);

  if (!available) {
    return <p className="rounded-xl bg-slate-100 py-3 text-center font-semibold text-slate-500">{t('orderSoldOut')}</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.id}>
          <legend className="mb-2 text-sm font-semibold text-slate-700">{g.name}</legend>
          <div className="flex flex-wrap gap-2">
            {g.options!.choices!.map((c) => {
              const on = picked[g.id] === c.name;
              const adj = Number(c.price_adjustment) || 0;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => ({ ...p, [g.id]: c.name }))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
                  }`}
                >
                  {c.name}
                  {adj !== 0 && (
                    <span className={on ? 'text-brand-100' : 'text-slate-400'}>
                      {' '}
                      {adj > 0 ? '+' : '−'}
                      {Math.abs(adj).toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">{t('orderNote')}</span>
        <input
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('orderNotePh')}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <Stepper value={qty} onChange={(n) => setQty(Math.max(1, Math.min(20, n)))} />
        <button
          type="button"
          onClick={() => {
            const labels = groups.map((g) => picked[g.id]).filter(Boolean);
            onAdd({
              product_id: product.id,
              name: product.name,
              qty,
              unit,
              choices: picked,
              labels,
              note: note.trim(),
            });
          }}
          className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-900"
        >
          {t('orderAdd')} · {money(unit * qty)}
        </button>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, small }: { value: number; onChange: (n: number) => void; small?: boolean }) {
  const b = `grid place-items-center rounded-full border border-slate-200 font-semibold text-brand-700 ${small ? 'h-7 w-7' : 'h-10 w-10 text-lg'}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(value - 1)} className={b}>
        −
      </button>
      <span className={`min-w-[1.5rem] text-center font-semibold tabular-nums ${small ? 'text-sm' : ''}`}>{value}</span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(value + 1)} className={b}>
        +
      </button>
    </div>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* sound is a bonus */
  }
}

const STATUS_KEY: Record<string, string> = {
  placed: 'orderPlaced',
  preparing: 'orderPreparing',
  ready: 'orderReady',
  completed: 'orderCompleted',
  cancelled: 'orderCancelled',
};
const STEPS = ['placed', 'preparing', 'ready'];

// The order bar: placed orders with live status, then the cart. With a table it orders to the table;
// without one it is order-ahead with a pickup time from the branch's opening hours.
export function TableOrder({
  branchId,
  table,
  cart,
  hours,
  timezone = 'Asia/Dubai',
}: {
  branchId: string;
  table: string | null;
  cart: Cart;
  hours?: Record<string, { open: string; close: string }> | null;
  timezone?: string;
}) {
  const { t } = useLang();
  const pickup = !table;
  const slots = pickup ? pickupSlots(hours, timezone, new Date()) : [];
  const [pickupAt, setPickupAt] = useState('');
  const slot = slots.find((x) => x.at === pickupAt) ?? slots[0];
  const where = pickup ? t('orderPickupAt').replace('{t}', slot?.label ?? '') : t('orderTable').replace('{t}', table ?? '');
  const ordersKey = `msq_orders_${branchId}`;
  const [placed, setPlaced] = useState<Placed[]>(() => read<Placed[]>(ordersKey, []).filter((o) => Date.now() - o.at < 6 * 3600_000));
  const [sheet, setSheet] = useState<'cart' | string | null>(null); // 'cart' or an order id
  const [name, setName] = useState(() => read<string>('msq_order_name', ''));
  const [phone, setPhone] = useState(() => read<string>('msq_order_phone', ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Tracked | null>(null);
  const placedRef = useRef(placed);
  placedRef.current = placed;

  useEffect(() => write(ordersKey, placed), [ordersKey, placed]);

  // Check open orders every 5 seconds; chime when one becomes ready.
  const live = placed.filter((o) => !['completed', 'cancelled'].includes(o.status ?? ''));
  useEffect(() => {
    if (!live.length) return;
    const tick = async () => {
      const updates = await Promise.all(
        placedRef.current
          .filter((o) => !['completed', 'cancelled'].includes(o.status ?? ''))
          .map((o) =>
            axios
              .get(`/api/orders/${o.id}`, { params: { token: o.token } })
              .then((r) => ({ id: o.id, status: r.data.status as string }))
              .catch((e) => (e?.response?.status === 404 ? { id: o.id, status: 'cancelled' } : null)),
          ),
      );
      const changed = updates.filter((u): u is { id: string; status: string } => !!u && placedRef.current.find((o) => o.id === u.id)?.status !== u.status);
      if (!changed.length) return;
      if (changed.some((u) => u.status === 'ready')) beep();
      setPlaced((prev) =>
        prev.map((o) => ({
          ...o,
          status: changed.find((u) => u.id === o.id)?.status ?? o.status,
        })),
      );
    };
    tick();
    const timer = setInterval(tick, 8000);
    return () => clearInterval(timer);
  }, [live.length]);

  // Order detail sheet loads the full order.
  useEffect(() => {
    if (!sheet || sheet === 'cart') return;
    const o = placed.find((x) => x.id === sheet);
    if (!o) return;
    setDetail(null);
    axios
      .get(`/api/orders/${o.id}`, { params: { token: o.token } })
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null));
  }, [sheet, placed.find((x) => x.id === sheet)?.status]);

  async function send() {
    if (!name.trim()) {
      setError(t('orderNameNeeded'));
      return;
    }
    if (pickup && phone.replace(/\D/g, '').length < 7) {
      setError(t('orderPhoneNeeded'));
      return;
    }
    if (pickup && !slot) {
      setError(t('orderPickupClosed'));
      return;
    }
    setBusy(true);
    setError(null);
    write('msq_order_name', name.trim());
    write('msq_order_phone', phone.trim());
    try {
      const r = await axios.post('/api/orders', {
        branch_id: branchId,
        ...(pickup ? { type: 'pickup', pickup_at: slot!.at } : { table }),
        customer_name: name.trim(),
        phone: phone.trim() || undefined,
        items: cart.lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          choices: l.choices,
          note: l.note || undefined,
        })),
      });
      setPlaced((prev) => [
        {
          id: r.data.id,
          token: r.data.access_token,
          order_no: r.data.order_no,
          at: Date.now(),
          status: 'placed',
          ...(pickup ? { pickup: slot!.label } : {}),
        },
        ...prev,
      ]);
      cart.clear();
      setSheet(r.data.id);
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : t('orderError'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(o: Placed) {
    setBusy(true);
    setError(null);
    try {
      await axios.post(`/api/orders/${o.id}/cancel`, { token: o.token });
      setPlaced((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: 'cancelled' } : x)));
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : t('orderError'));
    } finally {
      setBusy(false);
    }
  }

  const shown = placed.filter((o) => !o.seen);
  const current = sheet && sheet !== 'cart' ? placed.find((o) => o.id === sheet) : null;

  return (
    <>
      {shown.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {shown.slice(0, 3).map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSheet(o.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                  o.status === 'ready' ? 'bg-green-600 text-white' : 'bg-brand-50 text-brand-900'
                }`}
              >
                <span className="shrink-0 whitespace-nowrap font-semibold">{t('orderNo').replace('{n}', o.order_no)}</span>
                <span role="status" className="font-medium">
                  {o.status === 'ready' ? t('orderReadyText') : t(STATUS_KEY[o.status ?? 'placed'] ?? 'orderPlaced')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cart.count === 0 && shown.length === 0 && (
        <p className="mb-2 rounded-xl bg-cream px-3 py-2 text-sm font-medium text-brand-900">
          {!pickup ? t('orderHint') : slots.length ? t('orderPickupHint').replace('{t}', slots[0].label) : t('orderPickupClosed')}
        </p>
      )}
      {cart.count > 0 && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSheet('cart');
          }}
          className="mb-2 flex w-full items-center justify-between rounded-xl bg-copper-500 px-4 py-3 text-sm font-semibold text-white hover:bg-copper-700"
        >
          <span>
            {cart.count === 1 ? t('orderItem') : t('orderItems').replace('{n}', String(cart.count))} · {money(cart.total)}
          </span>
          <span>{t('orderReview')} →</span>
        </button>
      )}

      {sheet &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSheet(null)}>
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            >
              {sheet === 'cart' ? (
                <>
                  <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="font-display text-2xl text-brand-900">{t('orderYour')}</h2>
                    <span className="text-sm font-semibold text-slate-500">{where}</span>
                  </div>
                  {cart.lines.length === 0 ? (
                    <p className="py-6 text-center text-slate-500">{t('orderEmpty')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {cart.lines.map((l) => (
                        <li key={l.key} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{l.name}</p>
                            {(l.labels.length > 0 || l.note) && (
                              <p className="text-xs text-slate-500">{[...l.labels, l.note && `“${l.note}”`].filter(Boolean).join(' · ')}</p>
                            )}
                            <p className="mt-0.5 text-sm text-slate-600">{money(l.unit * l.qty)}</p>
                          </div>
                          <Stepper small value={l.qty} onChange={(n) => cart.setQty(l.key, n)} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {cart.lines.length > 0 && (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <input
                          value={name}
                          maxLength={60}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t('orderName')}
                          aria-label={t('orderName')}
                          autoComplete="given-name"
                          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                        />
                        <input
                          value={phone}
                          maxLength={20}
                          inputMode="tel"
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder={t(pickup ? 'orderMobile' : 'orderPhone')}
                          aria-label={t(pickup ? 'orderMobile' : 'orderPhone')}
                          autoComplete="tel"
                          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                      {pickup && (
                        <label className="mt-3 block">
                          <span className="mb-1 block text-sm font-semibold text-slate-700">{t('orderPickupTime')}</span>
                          {slots.length ? (
                            <select
                              value={slot?.at ?? ''}
                              onChange={(e) => setPickupAt(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                            >
                              {slots.map((x, i) => (
                                <option key={x.at} value={x.at}>
                                  {i === 0 ? t('orderPickupEarliest').replace('{t}', x.label) : x.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-600">{t('orderPickupClosed')}</p>
                          )}
                        </label>
                      )}
                      <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                        <span className="font-semibold text-slate-700">{t('orderTotal')}</span>
                        <span className="text-xl font-bold text-brand-900">{money(cart.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{t('orderPayCounter')}</p>
                      {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
                      <button
                        type="button"
                        onClick={send}
                        disabled={busy || (pickup && !slot)}
                        className="mt-4 w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                      >
                        {busy ? t('orderSending') : `${t('orderSend')} · ${money(cart.total)}`}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setSheet(null)} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500">
                    {t('orderClose')}
                  </button>
                </>
              ) : current ? (
                <>
                  <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="font-display text-2xl text-brand-900">{t('orderNo').replace('{n}', current.order_no)}</h2>
                    <span className="text-sm font-semibold text-slate-500">
                      {current.pickup ? t('orderPickupAt').replace('{t}', current.pickup) : t('orderTable').replace('{t}', table ?? '')}
                    </span>
                  </div>
                  {['completed', 'cancelled'].includes(current.status ?? '') ? (
                    <p className="mb-4 rounded-xl bg-slate-100 p-3 text-center font-semibold text-slate-600">{t(STATUS_KEY[current.status!])}</p>
                  ) : (
                    <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Order progress">
                      {STEPS.map((s, i) => {
                        const reached = STEPS.indexOf(current.status ?? 'placed') >= i;
                        return (
                          <li key={s} className="text-center">
                            <div
                              className={`h-1.5 rounded-full ${reached ? (current.status === 'ready' ? 'bg-green-600' : 'bg-brand-700') : 'bg-slate-200'}`}
                            />
                            <p className={`mt-1.5 text-xs font-semibold ${reached ? 'text-brand-900' : 'text-slate-400'}`}>{t(STATUS_KEY[s])}</p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {current.status === 'ready' && (
                    <p className="mb-4 rounded-xl bg-green-50 p-3 text-center font-semibold text-green-800">{t('orderReadyText')}</p>
                  )}
                  {detail && (
                    <>
                      <ul className="divide-y divide-slate-100 text-sm">
                        {detail.items.map((i, n) => (
                          <li key={n} className="flex justify-between gap-3 py-2">
                            <span>
                              {i.qty}× {i.name}
                              {(i.options?.choices?.length || i.options?.note) && (
                                <span className="block text-xs text-slate-500">
                                  {[...(i.options?.choices ?? []).map((c) => c.choice), i.options?.note && `“${i.options.note}”`].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-slate-600">{money(i.unit_price * i.qty)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold">
                        <span>{t('orderTotal')}</span>
                        <span>{money(detail.total)}</span>
                      </div>
                      {!['completed', 'cancelled'].includes(current.status ?? '') && <p className="mt-1 text-xs text-slate-500">{t('orderPayCounter')}</p>}
                    </>
                  )}
                  {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
                  <div className="mt-4 flex gap-2">
                    {current.status === 'placed' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => cancel(current)}
                        className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                      >
                        {t('orderCancel')}
                      </button>
                    )}
                    {['completed', 'cancelled'].includes(current.status ?? '') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlaced((prev) => prev.map((x) => (x.id === current.id ? { ...x, seen: true } : x)));
                          setSheet(null);
                        }}
                        className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
                      >
                        {t('orderDismiss')}
                      </button>
                    )}
                    <button type="button" onClick={() => setSheet(null)} className="flex-1 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white">
                      {t('orderMore')}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
