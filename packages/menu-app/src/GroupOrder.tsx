import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { pickupSlots } from './lib/hours';
import { setPageTitle } from './lib/seo';
import { readBusiness } from './Business';
import type { Cart, CartLine } from './TableOrder';

interface GroupView {
  code: string;
  branch: { id: string; name: string };
  host: string;
  status: 'open' | 'closed' | 'sent' | 'cancelled';
  closes_at: string;
  members: { name: string; mine: boolean; total: number; lines: { name: string; qty: number; unit: number; labels: string[]; note: string }[] }[];
  total: number;
  order: { order_no: string; status: string; total: number; pickup_at: string | null } | null;
}
// What this phone knows about a group: the person's key (and the host's key if they started it), name and items.
interface Saved {
  member_key?: string;
  host_key?: string;
  name?: string;
  lines?: Omit<CartLine, 'key'>[];
}

const money = (n: number) => `AED ${n.toFixed(2)}`;
const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none';
export const groupCode = (v: string | null) => (v && /^[A-Z2-9]{6}$/.test(v) ? v : null);
const key = (code: string) => `msq_group_${code}`;
function readSaved(code: string): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(key(code)) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function save(code: string, patch: Saved) {
  try {
    localStorage.setItem(key(code), JSON.stringify({ ...readSaved(code), ...patch }));
  } catch {
    /* private mode */
  }
}
const errorOf = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  return typeof m === 'string' ? m : fallback;
};

// On a branch's order-ahead menu: start a group order and share the link.
export function StartGroup({ branchId }: { branchId: string }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/group-orders', { branch_id: branchId, host_name: name.trim(), host_phone: phone.trim() });
      save(data.code, { host_key: data.host_key, member_key: data.member_key, name: name.trim() });
      nav(`/group/${data.code}?new=1`);
    } catch (err) {
      setError(errorOf(err, 'Could not start the group order. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-2 w-full rounded-xl border border-dashed border-brand-200 px-3 py-2 text-left text-sm font-medium text-brand-800 hover:bg-brand-50">
        👥 Ordering for colleagues or friends? <span className="font-semibold underline">Start a group order</span>
      </button>
    );
  return (
    <form onSubmit={start} className="mb-2 rounded-xl bg-cream p-3">
      <p className="text-sm font-semibold text-brand-900">Start a group order</p>
      <p className="text-xs text-slate-600">Share the link; everyone adds their own drinks; you send one order and collect it together.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input required value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={input} />
        <input required value={phone} maxLength={20} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="Mobile" aria-label="Mobile" className={input} />
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Starting…' : 'Start and get the link'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 text-sm font-semibold text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  );
}

// On the menu opened from a group link: the cart becomes "my items in the group".
export function GroupCartBar({ code, cart }: { code: string; cart: Cart }) {
  const nav = useNavigate();
  const [group, setGroup] = useState<GroupView | null>(null);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState(() => readSaved(code).name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<GroupView>(`/api/group-orders/${code}`)
      .then((r) => !cancelled && setGroup(r.data))
      .catch(() => !cancelled && setError('This group order link is not valid.'));
    // Editing: put this person's saved items back in the cart once.
    const mine = readSaved(code).lines;
    if (mine?.length && !cart.lines.length) mine.forEach((l) => cart.add(l));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function saveItems() {
    if (!name.trim()) {
      setError('Please enter your name so the barista knows whose drink is whose.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const lines = cart.lines.map(({ key: _k, ...l }) => l);
      const { data } = await axios.put(`/api/group-orders/${code}/items`, { name: name.trim(), member_key: readSaved(code).member_key, lines });
      save(code, { member_key: data.member_key, name: name.trim(), lines });
      cart.clear();
      nav(`/group/${code}`);
    } catch (err) {
      setError(errorOf(err, 'Could not save your items. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  const closed = group && group.status !== 'open';
  return (
    <>
      <p className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
        👥 {group ? (closed ? `${group.host}'s group order is closed.` : `Adding to ${group.host}'s group order.`) : 'Group order'}{' '}
        <Link to={`/group/${code}`} className="font-semibold underline">
          See the group
        </Link>
      </p>
      {error && !sheet && <p className="mb-2 text-xs text-red-700">{error}</p>}
      {cart.count > 0 && !closed && (
        <button type="button" onClick={() => setSheet(true)} className="mb-2 flex w-full items-center justify-between rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white">
          <span>
            My items · {cart.count}
          </span>
          <span>{money(cart.total)} →</span>
        </button>
      )}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/60 sm:items-center" onClick={() => setSheet(false)}>
          <div role="dialog" aria-modal="true" aria-label="My items" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 sm:rounded-[28px]">
            <h2 className="font-display text-2xl text-brand-900">My items</h2>
            <p className="text-sm text-slate-600">For {group?.host}'s group order at {group?.branch.name}</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800">{l.name}</span>
                    <span className="block truncate text-xs text-slate-500">{[...l.labels, l.note && `“${l.note}”`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button type="button" aria-label={`One less ${l.name}`} onClick={() => cart.setQty(l.key, l.qty - 1)} className="h-8 w-8 rounded-full border">
                      −
                    </button>
                    <span className="w-4 text-center">{l.qty}</span>
                    <button type="button" aria-label={`One more ${l.name}`} onClick={() => cart.setQty(l.key, l.qty + 1)} className="h-8 w-8 rounded-full border">
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={`${input} mt-3`} />
            {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <button type="button" disabled={busy || !cart.count} onClick={saveItems} className="mt-3 w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white disabled:opacity-60">
              {busy ? 'Saving…' : `Add to the group · ${money(cart.total)}`}
            </button>
            <button type="button" onClick={() => setSheet(false)} className="mt-2 w-full py-2 text-sm font-semibold text-slate-500">
              Keep choosing
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_TEXT: Record<string, string> = {
  placed: 'Received by the branch',
  paid: 'Received by the branch',
  preparing: 'Being prepared',
  ready: 'Ready to collect!',
  completed: 'Collected',
  cancelled: 'Cancelled by the branch',
};

// /group/:code — everyone's items, the share link and, for the host, sending the order.
export default function GroupOrderPage() {
  const { code: raw = '' } = useParams();
  const code = raw.toUpperCase();
  const [saved, setSaved] = useState<Saved>(() => readSaved(code));
  const [group, setGroup] = useState<GroupView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState<{ operating_hours?: Record<string, { open: string; close: string }> | null; timezone?: string } | null>(null);
  const [pickupAt, setPickupAt] = useState('');
  const business = readBusiness();
  const [onAccount, setOnAccount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const isNew = new URLSearchParams(window.location.search).get('new') === '1';
  const isHost = !!saved.host_key;

  useEffect(() => {
    let cancelled = false;
    setPageTitle('Group order');
    const load = () =>
      axios
        .get<GroupView>(`/api/group-orders/${code}`, { params: saved.member_key ? { key: saved.member_key } : {} })
        .then((r) => {
          if (cancelled) return;
          setGroup(r.data);
          setError(null);
        })
        .catch(() => !cancelled && setError('We could not find this group order. Check the link.'));
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, saved.member_key]);

  useEffect(() => {
    if (!group?.branch.id || !isHost) return;
    axios
      .get(`/api/branches/${group.branch.id}`)
      .then((r) => setBranch(r.data))
      .catch(() => undefined);
  }, [group?.branch.id, isHost]);

  if (error && !group)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>
      </div>
    );
  if (!group) return <div className="mx-auto h-64 max-w-xl animate-pulse rounded-[28px] bg-slate-100" aria-label="Loading group order" />;

  const link = `${window.location.origin}/group/${group.code}`;
  const share = `Join our Milestones coffee order at ${group.branch.name}: add your drink here ${link}`;
  const slots = isHost && group.status === 'open' ? pickupSlots(branch?.operating_hours ?? null, branch?.timezone || 'Asia/Dubai', new Date(), 15) : [];
  const slot = slots.find((s) => s.at === pickupAt) ?? slots[0];
  const mine = group.members.find((m) => m.mine);
  const closesIn = Math.max(0, Math.round((Date.parse(group.closes_at) - Date.now()) / 60000));

  async function send() {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      let loyalty: string | undefined;
      try {
        loyalty = localStorage.getItem('milestones_loyalty_token') || undefined;
      } catch {
        loyalty = undefined;
      }
      const { data } = await axios.post(`/api/group-orders/${code}/submit`, {
        host_key: saved.host_key,
        pickup_at: slot.at,
        account_token: business && onAccount ? business.token : undefined,
        loyalty_token: loyalty,
      });
      setGroup(data.group);
    } catch (err) {
      setError(errorOf(err, 'Could not send the order. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm('Cancel this group order for everyone?')) return;
    try {
      await axios.post(`/api/group-orders/${code}/cancel`, { host_key: saved.host_key });
      setGroup({ ...group!, status: 'cancelled' });
    } catch (err) {
      setError(errorOf(err, 'Could not cancel. Please try again.'));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper-300">Group order · {group.branch.name}</p>
        <h1 className="mt-1 font-display text-3xl">{isHost ? 'Your group order' : `${group.host}'s group order`}</h1>
        <p className="mt-2 text-brand-100">
          {group.status === 'open'
            ? `${group.members.length} ${group.members.length === 1 ? 'person has' : 'people have'} added items · open for ${closesIn >= 60 ? `${Math.floor(closesIn / 60)} h ${closesIn % 60} min` : `${closesIn} min`}`
            : group.status === 'sent'
              ? 'Sent to the branch'
              : group.status === 'cancelled'
                ? 'This group order was cancelled'
                : 'This group order closed before it was sent'}
        </p>
        {group.order && (
          <p role="status" className={`mt-3 rounded-xl p-3 font-semibold ${group.order.status === 'ready' ? 'bg-green-500 text-white' : 'bg-white/10'}`}>
            Order #{group.order.order_no}
            {group.order.pickup_at ? ` · pickup ${new Date(group.order.pickup_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' })}` : ''} · {STATUS_TEXT[group.order.status] ?? group.order.status}
          </p>
        )}
      </section>

      {group.status === 'open' && (
        <section className="rounded-[22px] border border-brand-100 bg-white p-5">
          {isNew && isHost && <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your group is ready. Share the link, then add your own items too.</p>}
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-600 px-4 py-3 text-center font-semibold text-white hover:bg-green-700">
              Share on WhatsApp
            </a>
            <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined)} className="rounded-full border border-brand-200 px-4 py-3 font-semibold text-brand-800">
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          <Link
            to={`/menu/${group.branch.id}?group=${group.code}`}
            onClick={() => setSaved(readSaved(code))}
            className="mt-3 block rounded-full bg-copper-700 px-4 py-3 text-center font-semibold text-white hover:bg-copper-500"
          >
            {mine ? 'Change my items' : 'Add my items'}
          </Link>
        </section>
      )}

      <section className="rounded-[22px] border border-brand-100 bg-white p-5">
        <h2 className="font-display text-xl text-brand-900">Who's having what</h2>
        {!group.members.length && <p className="mt-2 text-sm text-slate-500">Nobody has added anything yet.</p>}
        <ul className="mt-2 divide-y divide-brand-50">
          {group.members.map((m, i) => (
            <li key={i} className="py-3">
              <p className="flex justify-between font-semibold text-brand-900">
                <span>
                  {m.name}
                  {m.mine && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                </span>
                <span className="tabular-nums">{money(m.total)}</span>
              </p>
              <ul className="text-sm text-slate-600">
                {m.lines.map((l, j) => (
                  <li key={j}>
                    {l.qty}× {l.name}
                    {(l.labels.length || l.note) && <span className="text-slate-400"> · {[...l.labels, l.note && `“${l.note}”`].filter(Boolean).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-slate-100 pt-3 font-semibold text-brand-900">
          <span>Estimated total</span>
          <span className="tabular-nums">{money(group.order?.total ?? group.total)}</span>
        </p>
        {!group.order && <p className="text-xs text-slate-500">The branch confirms the final price, including any happy hour or combo deals, when the order is sent.</p>}
      </section>

      {isHost && group.status === 'open' && (
        <section className="rounded-[22px] border border-brand-100 bg-white p-5">
          <h2 className="font-display text-xl text-brand-900">Send the order</h2>
          <label className="mt-2 block text-sm font-semibold text-slate-700">
            Pickup time
            {slots.length ? (
              <select value={slot?.at ?? ''} onChange={(e) => setPickupAt(e.target.value)} className={`${input} mt-1 bg-white`}>
                {slots.map((s, i) => (
                  <option key={s.at} value={s.at}>
                    {i === 0 ? `Earliest: ${s.label}` : s.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-normal text-slate-600">Order ahead is closed right now at this branch.</p>
            )}
          </label>
          {business && (
            <label className="mt-3 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              <input type="checkbox" checked={onAccount} onChange={(e) => setOnAccount(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="font-semibold">Charge to the {business.company} account</span>
                <span className="block text-xs text-slate-600">{onAccount ? 'Paid on your company’s monthly invoice.' : 'Pay at the counter when you collect.'}</span>
              </span>
            </label>
          )}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
          <button type="button" disabled={busy || !slot || !group.members.length} onClick={send} className="mt-3 w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white hover:bg-brand-900 disabled:opacity-60">
            {busy ? 'Sending…' : `Send one order for everyone · ${money(group.total)}`}
          </button>
          <button type="button" onClick={cancel} className="mt-2 w-full py-2 text-sm font-semibold text-red-700">
            Cancel group order
          </button>
        </section>
      )}
      {!isHost && group.status === 'open' && <p className="text-center text-sm text-slate-500">{group.host} sends the order and collects it for everyone.</p>}
    </div>
  );
}
