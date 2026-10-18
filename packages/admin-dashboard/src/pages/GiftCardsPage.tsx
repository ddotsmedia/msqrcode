import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api';

interface Gift {
  code: string;
  amount: number;
  balance: number;
  status: 'pending' | 'active' | 'used' | 'cancelled' | 'expired';
  design: string;
  from: string;
  to: string | null;
  message: string | null;
  expires_on: string | null;
  buyer_phone?: string | null;
  created_at?: string;
  uses?: { amount: number; at: string }[];
}

const showCode = (c: string) => `GIFT-${c.slice(0, 4)}-${c.slice(4)}`;
const aed = (n: number) => `AED ${n.toFixed(2)}`;
const norm = (raw: string) => raw.toUpperCase().replace(/^MSQ-GIFT:/, '').replace(/^GIFT/, '').replace(/[^A-Z0-9]/g, '');
const BADGE: Record<Gift['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  used: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};
const MENU_URL = (import.meta.env.VITE_MENU_URL as string | undefined) ?? 'https://coffeesales.ae';

// Counter and admin: activate online gift cards when paid, spend balances, sell cards, see all cards.
export default function GiftCardsPage({ token, role }: { token: string; role: string }) {
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [card, setCard] = useState<Gift | null>(null);
  const [spend, setSpend] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Gift[]>([]);
  const [filter, setFilter] = useState('');
  const [sell, setSell] = useState({ amount: '100', buyer_name: '', recipient_name: '', buyer_phone: '', design: 'classic', message: '' });
  const [sold, setSold] = useState<Gift | null>(null);

  const loadList = () =>
    api<Gift[]>(`/admin/gift-cards${filter ? `?status=${filter}` : ''}`, token)
      .then(setList)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, token]);

  async function run<T>(fn: () => Promise<T>, ok?: (r: T) => string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg(ok(r));
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const open = (raw: string) =>
    run(async () => {
      const c = norm(raw);
      if (c.length !== 8) throw new Error('A gift card code has 8 letters and numbers');
      const g = await api<Gift>(`/admin/gift-cards/${c}`, token);
      setCard(g);
      setSpend('');
      setCode('');
      return g;
    });

  const refresh = async (c: string) => {
    setCard(await api<Gift>(`/admin/gift-cards/${c}`, token));
    loadList();
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Gift card at the counter</h2>
        <p className="text-sm text-gray-500">Scan the customer's gift card QR or type its code (GIFT-XXXX-XXXX).</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            open(code);
          }}
        >
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GIFT-ABCD-2345" aria-label="Gift card code" className="w-48 rounded border border-gray-300 px-3 py-2 font-mono uppercase tracking-wider" />
          <button type="submit" disabled={busy} className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Open
          </button>
          <button type="button" onClick={() => setScan((v) => !v)} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
            {scan ? 'Close scanner' : 'Scan QR'}
          </button>
        </form>
        {scan && (
          <Scanner
            onCode={(t) => {
              setScan(false);
              open(t);
            }}
          />
        )}
        {error && <p className="mt-3 rounded bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {msg && (
          <p role="status" className="mt-3 rounded bg-green-50 p-3 font-semibold text-green-800">
            {msg}
          </p>
        )}
        {card && (
          <div className="mt-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-lg font-bold">{showCode(card.code)}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${BADGE[card.status]}`}>{card.status}</span>
            </div>
            <p className="mt-1 text-3xl font-bold text-gray-900">{aed(card.balance)}</p>
            <p className="text-sm text-gray-500">
              of {aed(card.amount)} · for {card.to ?? '—'} · from {card.from}
              {card.expires_on ? ` · valid until ${card.expires_on}` : ''}
            </p>
            {card.status === 'pending' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => api<Gift>(`/admin/gift-cards/${card.code}/activate`, token, { method: 'POST' }), (g) => `Activated. Take ${aed(g.amount)} from the customer.`).then((g) => g && refresh(card.code))}
                className="mt-3 rounded bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Customer paid {aed(card.amount)} — activate
              </button>
            )}
            {card.status === 'active' && (
              <form
                className="mt-3 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () => api<{ taken: number; balance: number }>(`/admin/gift-cards/${card.code}/redeem`, token, { method: 'POST', body: JSON.stringify({ amount: Number(spend) }) }),
                    (r) => `✓ Took ${aed(r.taken)}. ${aed(r.balance)} left on the card.`,
                  ).then((r) => r && refresh(card.code));
                }}
              >
                <label className="text-sm text-gray-700">
                  Bill amount (AED){' '}
                  <input type="number" step="0.01" min="0.01" max={card.balance} required value={spend} onChange={(e) => setSpend(e.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1.5" />
                </label>
                <button type="button" onClick={() => setSpend(String(card.balance))} className="rounded border px-3 py-1.5 text-sm">
                  All ({card.balance.toFixed(2)})
                </button>
                <button type="submit" disabled={busy} className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Take from card
                </button>
              </form>
            )}
            {role === 'admin' && (card.status === 'pending' || card.status === 'active') && (
              <button
                type="button"
                disabled={busy}
                onClick={() => window.confirm(`Cancel ${showCode(card.code)}? It cannot be used afterwards.`) && run(() => api(`/admin/gift-cards/${card.code}/cancel`, token, { method: 'POST' }), () => 'Gift card cancelled.').then(() => refresh(card.code))}
                className="mt-3 block text-sm font-semibold text-red-700 underline"
              >
                Cancel this card
              </button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Sell a gift card</h2>
        <p className="text-sm text-gray-500">The customer pays now; the card is active at once. Give them the link to send on WhatsApp.</p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api<Gift>('/admin/gift-cards', token, { method: 'POST', body: JSON.stringify({ ...sell, amount: Number(sell.amount) }) }), (g) => `Sold ${showCode(g.code)} for ${aed(g.amount)}.`).then((g) => {
              if (!g) return;
              setSold(g);
              setSell((s) => ({ ...s, buyer_name: '', recipient_name: '', buyer_phone: '', message: '' }));
              loadList();
            });
          }}
        >
          <input type="number" min={25} max={2000} required value={sell.amount} onChange={(e) => setSell({ ...sell, amount: e.target.value })} aria-label="Amount (AED)" placeholder="Amount (AED)" className="rounded border border-gray-300 px-3 py-2" />
          <input required value={sell.buyer_name} maxLength={60} onChange={(e) => setSell({ ...sell, buyer_name: e.target.value })} placeholder="From (buyer)" aria-label="Buyer name" className="rounded border border-gray-300 px-3 py-2" />
          <input value={sell.recipient_name} maxLength={60} onChange={(e) => setSell({ ...sell, recipient_name: e.target.value })} placeholder="For (optional)" aria-label="Recipient name" className="rounded border border-gray-300 px-3 py-2" />
          <input value={sell.buyer_phone} maxLength={20} onChange={(e) => setSell({ ...sell, buyer_phone: e.target.value })} placeholder="Buyer mobile (optional)" aria-label="Buyer mobile" className="rounded border border-gray-300 px-3 py-2" />
          <select value={sell.design} onChange={(e) => setSell({ ...sell, design: e.target.value })} aria-label="Design" className="rounded border border-gray-300 px-3 py-2">
            <option value="classic">Classic</option>
            <option value="birthday">Birthday</option>
            <option value="eid">Eid</option>
            <option value="thanks">Thank you</option>
          </select>
          <input value={sell.message} maxLength={200} onChange={(e) => setSell({ ...sell, message: e.target.value })} placeholder="Message (optional)" aria-label="Message" className="rounded border border-gray-300 px-3 py-2" />
          <button type="submit" disabled={busy} className="rounded bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-3">
            Sell gift card
          </button>
        </form>
        {sold && (
          <p className="mt-3 rounded bg-brand-50 p-3 text-sm">
            Card link for the customer:{' '}
            <a className="font-mono font-semibold text-brand-700 underline" href={`${MENU_URL}/gift/${sold.code}`} target="_blank" rel="noreferrer">
              {MENU_URL.replace(/^https?:\/\//, '')}/gift/{sold.code}
            </a>
          </p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-800">All gift cards</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status" className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="pending">Not paid yet</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Outstanding balance on active cards: <strong>{aed(list.filter((g) => g.status === 'active').reduce((s, g) => s + g.balance, 0))}</strong>
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="py-2 pr-3">Code</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Balance</th>
                <th className="pr-3">From → for</th>
                <th className="pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.code} className="border-t">
                  <td className="py-2 pr-3">
                    <button type="button" onClick={() => open(g.code)} className="font-mono font-semibold text-brand-700 underline">
                      {showCode(g.code)}
                    </button>
                  </td>
                  <td className="pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${BADGE[g.status]}`}>{g.status}</span>
                  </td>
                  <td className="pr-3 tabular-nums">
                    {g.balance.toFixed(2)} / {g.amount.toFixed(2)}
                  </td>
                  <td className="pr-3">
                    {g.from}
                    {g.buyer_phone ? ` (${g.buyer_phone})` : ''} → {g.to ?? '—'}
                  </td>
                  <td className="pr-3 text-gray-500">{g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB') : ''}</td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No gift cards yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const once = useRef(false);
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('gift-qr-reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    scanner.render(
      (text) => {
        if (once.current) return;
        once.current = true;
        scanner.clear().catch(() => {});
        onCode(text);
      },
      () => {},
    );
    return () => {
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div id="gift-qr-reader" className="mt-3 max-w-sm rounded-xl border p-2" />;
}
