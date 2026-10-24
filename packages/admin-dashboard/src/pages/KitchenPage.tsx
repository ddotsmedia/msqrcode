import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { chime } from './RequestsPage';

interface Line {
  name: string;
  qty: number;
  options?: { choices?: { choice: string }[]; note?: string | null } | null;
}
interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  phone: string;
  table: string | null;
  type?: 'pickup' | 'dine_in';
  pickup_at?: string | null;
  rewards_card?: boolean;
  on_account?: string | null;
  car?: string | null;
  arrived_at?: string | null;
  status: 'placed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total: number;
  discounts?: { title: string; amount: number }[];
  created_at: string;
  items: Line[];
}
interface Board {
  ordering_enabled: boolean;
  pickup_enabled: boolean;
  open: Order[];
  finished: Order[];
}

const COLUMNS: { status: Order['status']; title: string; next?: { to: Order['status']; label: string } }[] = [
  { status: 'placed', title: 'New', next: { to: 'preparing', label: 'Start' } },
  { status: 'preparing', title: 'Preparing', next: { to: 'ready', label: 'Ready' } },
  { status: 'ready', title: 'Ready', next: { to: 'completed', label: 'Collected' } },
];

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
// "Table 5" or "Pickup 18:30"
const where = (o: Order) => (o.type === 'pickup' && o.pickup_at ? `Pickup ${hhmm(o.pickup_at)}` : o.table ? `Table ${o.table}` : '');

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : `${m} min ago`;
};

// Orders customers send from the table QR menu. Checks every 5 seconds and chimes on a new order.
export default function KitchenPage({
  token,
  branchId,
  branches,
  onBranch,
}: {
  token: string;
  branchId: string;
  branches: { id: string; name: string }[];
  onBranch: (id: string) => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const outside = useRef<Set<string> | null>(null);

  async function load() {
    try {
      const res = await api<Board>(`/admin/orders?branch_id=${branchId}`, token);
      const ids = new Set(res.open.map((o) => o.id));
      if (seen.current && res.open.some((o) => o.status === 'placed' && !seen.current!.has(o.id))) chime();
      seen.current = ids;
      // Curbside: chime again when a customer taps "I'm here".
      const here = new Set(res.open.filter((o) => o.arrived_at).map((o) => o.id));
      if (outside.current && [...here].some((id) => !outside.current!.has(id))) chime();
      outside.current = here;
      setBoard(res);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    seen.current = null;
    outside.current = null;
    setBoard(null);
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [branchId, token]);

  async function move(o: Order, status: Order['status']) {
    if (status === 'cancelled' && !window.confirm(`Cancel order ${o.order_no} for ${o.customer_name}?`)) return;
    setBusy(o.id);
    try {
      await api(`/admin/orders/${o.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleOrdering(kind: 'table' | 'pickup') {
    if (!board) return;
    setBusy('switch');
    try {
      const res = await api<{ ordering_enabled: boolean; pickup_enabled: boolean }>(`/admin/orders/ordering`, token, {
        method: 'PATCH',
        body: JSON.stringify({ branch_id: branchId, kind, enabled: kind === 'pickup' ? !board.pickup_enabled : !board.ordering_enabled }),
      });
      setBoard({ ...board, ...res });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        {branches.length > 1 && (
          <select value={branchId} onChange={(e) => onBranch(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm" aria-label="Branch">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1 min-w-[12rem] text-sm text-gray-500">New orders chime; keep this screen open. Customers pay at the counter.</div>
        {(
          [
            ['table', 'Order from table QR', board?.ordering_enabled],
            ['pickup', 'Order ahead & pickup', board?.pickup_enabled],
          ] as const
        ).map(([kind, label, on]) => (
          <button
            key={kind}
            type="button"
            role="switch"
            aria-checked={!!on}
            disabled={!board || busy === 'switch'}
            onClick={() => toggleOrdering(kind)}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${on ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {label}: {on ? 'On' : 'Off'}
          </button>
        ))}
      </div>

      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          // Customers waiting outside go to the top.
          const list = (board?.open.filter((o) => o.status === col.status) ?? []).sort((x, y) => Number(!!y.arrived_at) - Number(!!x.arrived_at));
          return (
            <section key={col.status} className="rounded-lg bg-gray-200/60 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 font-semibold text-gray-700">
                {col.title}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.length === 0 && <p className="px-1 text-sm text-gray-500">No orders</p>}
                {list.map((o) => (
                  <article
                    key={o.id}
                    className={`animate-fade-slide-up rounded-lg bg-white p-3 shadow-sm ${o.arrived_at ? 'ring-2 ring-green-600' : col.status === 'placed' ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    {o.arrived_at && (
                      <p className="-mx-3 -mt-3 mb-2 rounded-t-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white">
                        🚗 Outside since {hhmm(o.arrived_at)} · {o.car}
                      </p>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-lg font-bold text-gray-900">
                        #{o.order_no} {where(o) && <span className={o.type === 'pickup' ? 'text-amber-700' : 'text-brand-700'}>· {where(o)}</span>}
                      </p>
                      <span className="text-xs text-gray-500">{ago(o.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {o.customer_name}
                      {o.phone && <span className="text-gray-400"> · {o.phone}</span>}
                      {o.rewards_card && <span className="ml-1 text-amber-700" title="Earns a stamp when collected">· ⭐ rewards</span>}
                    </p>
                    {o.car && !o.arrived_at && <p className="text-xs text-gray-500">🚗 Curbside: {o.car}</p>}
                    <ul className="mt-2 space-y-1 text-sm">
                      {o.items.map((i, n) => (
                        <li key={n}>
                          <span className="font-semibold">{i.qty}×</span> {i.name}
                          {(i.options?.choices?.length || i.options?.note) && (
                            <span className="block pl-5 text-xs text-gray-500">
                              {[...(i.options?.choices ?? []).map((c) => c.choice), i.options?.note && `“${i.options.note}”`].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {(o.discounts ?? []).map((d) => (
                      <p key={d.title} className="mt-1 text-xs font-semibold text-green-700">
                        🎁 {d.title} −AED {d.amount.toFixed(2)}
                      </p>
                    ))}
                    {o.on_account ? (
                      <p className="mt-2 rounded bg-brand-50 px-2 py-1 text-sm font-semibold text-brand-800">AED {o.total.toFixed(2)} · on {o.on_account} account — do not charge</p>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-gray-700">AED {o.total.toFixed(2)} · pay at counter</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {col.next && (
                        <button
                          type="button"
                          disabled={busy === o.id}
                          onClick={() => move(o, col.next!.to)}
                          className="flex-1 rounded bg-brand-700 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {col.next.label}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === o.id}
                        onClick={() => move(o, 'cancelled')}
                        className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {board && board.finished.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-700">Last 2 hours</h2>
          <ul className="divide-y text-sm">
            {board.finished.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-2">
                <span>
                  #{o.order_no} · {o.customer_name} {where(o) && `· ${where(o)}`}
                </span>
                <span className={o.status === 'cancelled' ? 'text-red-600' : 'text-green-700'}>
                  {o.status === 'cancelled' ? 'Cancelled' : 'Collected'} · AED {o.total.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
