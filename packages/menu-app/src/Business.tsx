import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';

// The company account this phone orders with (set when the portal link is opened).
export const BUSINESS_KEY = 'msq_business';
export function readBusiness(): { token: string; company: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(BUSINESS_KEY) || 'null');
    return v && typeof v.token === 'string' && typeof v.company === 'string' ? v : null;
  } catch {
    return null;
  }
}
function saveBusiness(v: { token: string; company: string } | null) {
  try {
    if (v) localStorage.setItem(BUSINESS_KEY, JSON.stringify(v));
    else localStorage.removeItem(BUSINESS_KEY);
  } catch {
    /* private mode */
  }
}

const input = 'w-full rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none';
const aed = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const PERKS = [
  { icon: 'clock', title: 'Order ahead, skip the queue', text: 'Your team orders on the website for pickup at any branch. Nothing to pay at the counter.' },
  { icon: 'book', title: 'One tax invoice a month', text: 'Every order on one VAT invoice with your TRN, ready for your accounts team.' },
  { icon: 'check', title: 'Credit limit you control', text: 'Set a monthly limit. Your own page shows every order and invoice as it happens.' },
] as const;

// /business — coffee accounts for offices.
export default function BusinessPage() {
  const [form, setForm] = useState({ company: '', trn: '', contact_name: '', email: '', phone: '', address: '', team_size: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const saved = readBusiness();

  useEffect(() => {
    setPageTitle('Business accounts');
    setMetaDescription('Milestones Coffee business accounts: your team orders ahead, you pay one monthly UAE VAT invoice.');
  }, []);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await axios.post('/api/corporate/apply', { ...form, team_size: Number(form.team_size) || undefined });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : 'Could not send your application. Please try again or call us.');
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-50 text-green-700">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-3xl text-brand-900">Thank you, {form.contact_name.split(' ')[0]}!</h1>
        <p className="mt-2 text-slate-600">We will review the account for {form.company} and email {form.email} within one working day with your team's ordering link.</p>
      </div>
    );

  return (
    <div className="space-y-10">
      {saved && (
        <Link to={`/business/${saved.token}`} className="flex items-center justify-between rounded-2xl bg-brand-50 p-4 font-semibold text-brand-800">
          <span>Your company account: {saved.company}</span>
          <Icon name="arrow" className="h-5 w-5" />
        </Link>
      )}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper-300">For business</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl sm:text-5xl">Coffee for your office, on one monthly invoice</h1>
        <p className="mt-3 max-w-xl text-lg text-brand-100">Open a company account and your team orders ahead at any Milestones branch. We send one UAE VAT invoice at the end of the month.</p>
        <a href="#apply" className="mt-6 inline-flex rounded-full bg-copper-500 px-6 py-3 font-semibold text-white hover:bg-copper-700">
          Open an account
        </a>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="rounded-[22px] border border-brand-100 bg-white p-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-cream text-copper-700">
              <Icon name={p.icon} className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-semibold text-brand-900">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.text}</p>
          </div>
        ))}
      </section>

      <form id="apply" onSubmit={submit} className="grid gap-3 rounded-[28px] border border-brand-100 bg-white p-5 sm:grid-cols-2 sm:p-8">
        <h2 className="font-display text-2xl text-brand-900 sm:col-span-2">Apply for a business account</h2>
        <label className="block text-sm font-medium text-slate-700">
          Company name
          <input required maxLength={120} value={form.company} onChange={(e) => set('company', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          TRN <span className="font-normal text-slate-400">(optional, 15 digits)</span>
          <input inputMode="numeric" maxLength={20} value={form.trn} onChange={(e) => set('trn', e.target.value)} className={`${input} mt-1`} placeholder="100123456789003" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Your name
          <input required maxLength={60} value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Work email
          <input required type="email" maxLength={120} value={form.email} onChange={(e) => set('email', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mobile
          <input required type="tel" maxLength={20} value={form.phone} onChange={(e) => set('phone', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Team size
          <input type="number" min={1} value={form.team_size} onChange={(e) => set('team_size', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Office address <span className="font-normal text-slate-400">(for the invoice)</span>
          <input maxLength={200} value={form.address} onChange={(e) => set('address', e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Anything else?
          <textarea maxLength={500} rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} className={`${input} mt-1`} placeholder="Which branch is closest, how often your team orders, monthly budget…" />
        </label>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-full bg-copper-700 px-6 py-3.5 font-semibold text-white hover:bg-copper-500 disabled:opacity-50 sm:col-span-2">
          {busy ? 'Sending…' : 'Send application'}
        </button>
      </form>
    </div>
  );
}

interface Portal {
  company: string;
  contact_name: string;
  status: string;
  credit_limit: number;
  unbilled: number;
  orders: { id: string; order_no: string; at: string; branch: string; person: string; status: string; total: number; items: string[] }[];
  invoices: { id: string; number: string; month: string; order_count: number; total: number; status: string; issued_at: string }[];
}

// /business/:token — the company's own page. Opening it also makes this phone order on the account.
export function BusinessPortal() {
  const { token = '' } = useParams();
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; pickup_enabled?: boolean }[]>([]);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPageTitle('Company account');
    axios
      .get<Portal>(`/api/corporate/portal/${encodeURIComponent(token)}`)
      .then((r) => {
        if (cancelled) return;
        setData(r.data);
        if (r.data.status === 'active') {
          saveBusiness({ token, company: r.data.company });
          setLinked(true);
        }
      })
      .catch(() => !cancelled && setError('This company link is not valid. Ask your office manager for the current link.'));
    axios
      .get('/api/branches')
      .then((r) => !cancelled && setBranches(Array.isArray(r.data) ? r.data : []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p className="mx-auto max-w-md rounded-xl bg-red-50 p-4 text-center font-semibold text-red-700">{error}</p>;
  if (!data) return <div className="h-64 animate-pulse rounded-[28px] bg-slate-100" aria-label="Loading" />;
  const left = Math.max(0, data.credit_limit - data.unbilled);
  const pct = data.credit_limit ? Math.min(100, (data.unbilled / data.credit_limit) * 100) : 100;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper-300">Company account</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">{data.company}</h1>
        {data.status !== 'active' ? (
          <p className="mt-3 rounded-xl bg-white/10 p-3">{data.status === 'pending' ? 'Your application is being reviewed. We will email you when ordering is ready.' : 'Ordering on this account is paused. Please contact us.'}</p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-brand-100">Not yet invoiced</p>
                <p className="font-display text-3xl">{aed(data.unbilled)}</p>
              </div>
              <p className="text-sm text-brand-100">
                {aed(left)} left of {aed(data.credit_limit)}
              </p>
            </div>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <span className={`block h-full ${pct > 85 ? 'bg-amber-400' : 'bg-copper-300'}`} style={{ width: `${pct}%` }} />
            </span>
          </>
        )}
      </section>

      {data.status === 'active' && (
        <section className="rounded-[22px] border border-brand-100 bg-white p-5">
          <h2 className="font-display text-xl text-brand-900">Order for pickup</h2>
          <p className="text-sm text-slate-600">
            {linked ? 'This phone now orders on the company account. ' : ''}Share this page's link with your team so they can order too. At checkout, orders go on the account — nothing to pay at the counter.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {branches
              .filter((b) => b.pickup_enabled !== false)
              .map((b) => (
                <Link key={b.id} to={`/menu/${b.id}`} className="rounded-full bg-cream px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                  {b.name} →
                </Link>
              ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[22px] border border-brand-100 bg-white p-5">
          <h2 className="font-display text-xl text-brand-900">Invoices</h2>
          {!data.invoices.length && <p className="mt-2 text-sm text-slate-500">Your first invoice comes at the end of the month.</p>}
          <ul className="mt-2 divide-y divide-brand-50">
            {data.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <Link to={`/business/${token}/invoice/${i.id}`} className="font-semibold text-brand-700 underline">
                    {i.number}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {monthName(i.month)} · {i.order_count} {i.order_count === 1 ? 'order' : 'orders'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-brand-900">{aed(i.total)}</p>
                  <span className={`text-xs font-bold uppercase ${i.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>{i.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[22px] border border-brand-100 bg-white p-5">
          <h2 className="font-display text-xl text-brand-900">Recent orders</h2>
          {!data.orders.length && <p className="mt-2 text-sm text-slate-500">No orders yet.</p>}
          <ul className="mt-2 divide-y divide-brand-50">
            {data.orders.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-900">
                    {o.person} · #{o.order_no}
                  </p>
                  <p className="truncate text-slate-500">{o.items.join(', ')}</p>
                  <p className="text-xs text-slate-400">
                    {day(o.at)} · {o.branch}
                    {o.status === 'cancelled' ? ' · cancelled' : ''}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${o.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-brand-900'}`}>{aed(o.total)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {linked && (
        <button
          type="button"
          onClick={() => {
            saveBusiness(null);
            setLinked(false);
          }}
          className="text-sm font-semibold text-slate-500 underline"
        >
          Stop ordering on this account from this phone
        </button>
      )}
    </div>
  );
}

interface Invoice {
  number: string;
  month: string;
  issued_at: string;
  status: string;
  total: number;
  vat: number;
  net: number;
  vat_rate: number;
  seller: { name: string; trn: string | null; address: string };
  buyer: { company: string; trn: string | null; address: string | null; contact_name: string; email: string };
  lines: { id: string; order_no: string; at: string; branch: string; person: string; total: number; items: string[] }[];
}

// /business/:token/invoice/:id — a printable UAE tax invoice.
export function BusinessInvoice() {
  const { token = '', id = '' } = useParams();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPageTitle('Tax invoice');
    axios
      .get<Invoice>(`/api/corporate/portal/${encodeURIComponent(token)}/invoices/${encodeURIComponent(id)}`)
      .then((r) => setInv(r.data))
      .catch(() => setError('Invoice not found.'));
  }, [token, id]);
  if (error) return <p className="mx-auto max-w-md rounded-xl bg-red-50 p-4 text-center font-semibold text-red-700">{error}</p>;
  if (!inv) return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" aria-label="Loading" />;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link to={`/business/${token}`} className="font-semibold text-brand-700 underline">
          ← Company account
        </Link>
        <button type="button" onClick={() => window.print()} className="rounded-full bg-brand-700 px-5 py-2 font-semibold text-white">
          Print / save PDF
        </button>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-800 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="font-display text-2xl text-brand-900">{inv.seller.name}</p>
            <p>{inv.seller.address}</p>
            <p>TRN: {inv.seller.trn ?? '—'}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-brand-900">Tax invoice</h1>
            <p>
              No. <strong>{inv.number}</strong>
            </p>
            <p>Date: {day(inv.issued_at)}</p>
            <p>Period: {monthName(inv.month)}</p>
            <p className={`mt-1 font-bold uppercase ${inv.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>{inv.status}</p>
          </div>
        </header>
        <section className="border-b border-slate-200 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</p>
          <p className="font-semibold">{inv.buyer.company}</p>
          {inv.buyer.address && <p>{inv.buyer.address}</p>}
          {inv.buyer.trn && <p>TRN: {inv.buyer.trn}</p>}
          <p>
            {inv.buyer.contact_name} · {inv.buyer.email}
          </p>
        </section>
        <table className="mt-5 w-full text-left">
          <thead className="border-b border-slate-300 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2">Date</th>
              <th className="pr-2">Order</th>
              <th className="pr-2">Items</th>
              <th className="text-right">Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-2 pr-2">{day(l.at)}</td>
                <td className="pr-2">
                  #{l.order_no} · {l.person}
                  <span className="block text-xs text-slate-500">{l.branch}</span>
                </td>
                <td className="pr-2">{l.items.join(', ')}</td>
                <td className="text-right tabular-nums">{l.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-5 w-full max-w-xs space-y-1">
          <div className="flex justify-between">
            <dt>Amount excluding VAT</dt>
            <dd className="tabular-nums">{aed(inv.net)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>VAT {inv.vat_rate}%</dt>
            <dd className="tabular-nums">{aed(inv.vat)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold text-brand-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{aed(inv.total)}</dd>
          </div>
        </dl>
        <p className="mt-8 text-xs text-slate-500">Prices include VAT. {inv.lines.length} {inv.lines.length === 1 ? 'order' : 'orders'} collected in this period.</p>
      </article>
    </div>
  );
}
