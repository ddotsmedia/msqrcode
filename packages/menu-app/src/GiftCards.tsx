import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';

export interface Gift {
  code: string;
  amount: number;
  balance: number;
  status: 'pending' | 'active' | 'used' | 'cancelled' | 'expired';
  design: string;
  from: string;
  to: string | null;
  message: string | null;
  expires_on: string | null;
}

export const DESIGNS: { id: string; label: string; mark: string; card: string }[] = [
  { id: 'classic', label: 'Classic', mark: '☕', card: 'from-brand-700 via-brand-800 to-brand-900' },
  { id: 'birthday', label: 'Birthday', mark: '🎂', card: 'from-rose-500 via-pink-500 to-orange-400' },
  { id: 'eid', label: 'Eid', mark: '🌙', card: 'from-emerald-700 via-emerald-800 to-teal-900' },
  { id: 'thanks', label: 'Thank you', mark: '💛', card: 'from-copper-500 via-copper-700 to-brand-900' },
];
const AMOUNTS = [50, 100, 200, 300];
const MINE = 'msq_gift_codes';
const input = 'w-full rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none';
export const showCode = (c: string) => `GIFT-${c.slice(0, 4)}-${c.slice(4)}`;
const aed = (n: number) => `AED ${n % 1 ? n.toFixed(2) : n}`;
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function readMine(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(MINE) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : [];
  } catch {
    return [];
  }
}
function remember(code: string) {
  try {
    localStorage.setItem(MINE, JSON.stringify([code, ...readMine().filter((c) => c !== code)].slice(0, 10)));
  } catch {
    /* private mode */
  }
}

// The card itself: used for the live preview and on the card's own page.
export function GiftCardArt({ design, amount, to, from, message, balance }: { design: string; amount: number; to?: string | null; from?: string | null; message?: string | null; balance?: number }) {
  const d = DESIGNS.find((x) => x.id === design) ?? DESIGNS[0];
  return (
    <div className={`relative aspect-[1.6] w-full overflow-hidden rounded-[22px] bg-gradient-to-br ${d.card} p-5 text-white shadow-xl sm:p-6`}>
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden="true" className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-white/5" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-lg leading-none">Milestones</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Gift card</p>
          </div>
          <span className="text-3xl" aria-hidden="true">
            {d.mark}
          </span>
        </div>
        <div className="mt-auto">
          {message && <p className="mb-2 line-clamp-2 text-sm italic text-white/85">“{message}”</p>}
          <p className="font-display text-4xl leading-none sm:text-5xl">{aed(balance ?? amount)}</p>
          {balance !== undefined && balance !== amount && <p className="text-xs text-white/70">of {aed(amount)}</p>}
          <p className="mt-2 text-sm text-white/85">
            {to ? <>For {to}</> : 'For you'}
            {from ? <> · from {from}</> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

// Public page: buy a gift card (pay at any branch to activate) and check a balance.
export default function GiftCardsPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({ design: 'classic', amount: '100', recipient_name: '', buyer_name: '', buyer_phone: '', message: '' });
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState('');
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    setPageTitle('Gift cards');
    setMetaDescription('Milestones Coffee gift cards from AED 25. Send one on WhatsApp for birthdays, Eid or to say thank you, and spend it at any branch.');
    setMine(readMine());
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const amount = Number(form.amount) || 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await axios.post<Gift>('/api/gift-cards/request', { ...form, amount });
      remember(data.code);
      nav(`/gift/${data.code}?new=1`);
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : 'Could not create the gift card. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper-700">Gift cards</p>
          <h1 className="mt-2 font-display text-4xl text-brand-900 sm:text-5xl">Give someone their next coffee</h1>
          <p className="mt-3 max-w-lg text-lg text-slate-600">Pick a design and an amount, then send it on WhatsApp. It works at every Milestones branch and can be spent bit by bit.</p>
          <ul className="mt-5 space-y-2 text-slate-700">
            {['Any amount from AED 25 to AED 2,000', 'Valid for 12 months from when it is paid', 'Spend it in parts — the balance stays on the card'].map((t) => (
              <li key={t} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md">
          <GiftCardArt design={form.design} amount={amount} to={form.recipient_name || null} from={form.buyer_name || null} message={form.message || null} />
        </div>
      </section>

      <form onSubmit={submit} className="grid gap-6 rounded-[28px] border border-brand-100 bg-white p-5 sm:p-8 lg:grid-cols-2">
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 font-semibold text-brand-900">Design</legend>
            <div className="grid grid-cols-4 gap-2">
              {DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => set('design', d.id)}
                  aria-pressed={form.design === d.id}
                  className={`rounded-2xl border p-2 text-center text-xs font-semibold ${form.design === d.id ? 'border-brand-700 ring-2 ring-brand-700' : 'border-brand-100'}`}
                >
                  <span className={`mb-1 grid aspect-[1.6] place-items-center rounded-xl bg-gradient-to-br ${d.card} text-xl`}>{d.mark}</span>
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold text-brand-900">Amount</legend>
            <div className="flex flex-wrap gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setCustom(false);
                    set('amount', String(a));
                  }}
                  aria-pressed={!custom && amount === a}
                  className={`rounded-full px-5 py-2.5 font-semibold ${!custom && amount === a ? 'bg-brand-700 text-white' : 'bg-cream text-brand-800'}`}
                >
                  AED {a}
                </button>
              ))}
              <button type="button" onClick={() => setCustom(true)} aria-pressed={custom} className={`rounded-full px-5 py-2.5 font-semibold ${custom ? 'bg-brand-700 text-white' : 'bg-cream text-brand-800'}`}>
                Other
              </button>
            </div>
            {custom && (
              <label className="mt-3 block text-sm text-slate-600">
                Amount in AED (25 – 2,000)
                <input type="number" min={25} max={2000} step={5} required value={form.amount} onChange={(e) => set('amount', e.target.value)} className={`${input} mt-1`} />
              </label>
            )}
          </fieldset>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            For (their name)
            <input value={form.recipient_name} maxLength={60} onChange={(e) => set('recipient_name', e.target.value)} className={`${input} mt-1`} placeholder="Omar" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Your name
            <input required value={form.buyer_name} maxLength={60} onChange={(e) => set('buyer_name', e.target.value)} className={`${input} mt-1`} placeholder="Sara" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Your mobile
            <input required type="tel" inputMode="tel" value={form.buyer_phone} maxLength={20} onChange={(e) => set('buyer_phone', e.target.value)} className={`${input} mt-1`} placeholder="050 123 4567" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Message <span className="font-normal text-slate-400">({200 - form.message.length} left)</span>
            <textarea value={form.message} maxLength={200} rows={2} onChange={(e) => set('message', e.target.value)} className={`${input} mt-1`} placeholder="Eid Mubarak! Coffee is on me." />
          </label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <button type="submit" disabled={busy || amount < 25 || amount > 2000} className="w-full rounded-full bg-copper-700 px-6 py-3.5 font-semibold text-white hover:bg-copper-500 disabled:opacity-50">
            {busy ? 'Creating…' : `Create gift card · ${aed(amount)}`}
          </button>
          <p className="text-center text-xs text-slate-500">You pay at any branch: show the card's QR to the barista and it becomes active straight away.</p>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = lookup.toUpperCase().replace(/^GIFT/, '').replace(/[^A-Z0-9]/g, '');
            if (c.length === 8) nav(`/gift/${c}`);
          }}
          className="rounded-[22px] bg-cream p-5"
        >
          <h2 className="font-display text-xl text-brand-900">Check a balance</h2>
          <p className="text-sm text-slate-600">Type the code printed on the card.</p>
          <div className="mt-3 flex gap-2">
            <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="GIFT-ABCD-2345" aria-label="Gift card code" className={`${input} font-mono uppercase`} />
            <button type="submit" className="rounded-xl bg-brand-700 px-4 font-semibold text-white">
              Check
            </button>
          </div>
        </form>
        {mine.length > 0 && (
          <div className="rounded-[22px] bg-cream p-5">
            <h2 className="font-display text-xl text-brand-900">Cards from this phone</h2>
            <ul className="mt-2 space-y-1">
              {mine.map((c) => (
                <li key={c}>
                  <Link to={`/gift/${c}`} className="font-mono font-semibold text-brand-700 underline">
                    {showCode(c)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

// /gift/:code — the card's own page, which the buyer shares on WhatsApp. Staff scan its QR to activate or spend it.
export function GiftCardPage() {
  const { code = '' } = useParams();
  const isNew = new URLSearchParams(window.location.search).get('new') === '1';
  const [gift, setGift] = useState<Gift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPageTitle('Your gift card');
    axios
      .get<Gift>(`/api/gift-cards/${encodeURIComponent(code)}`)
      .then((r) => !cancelled && setGift(r.data))
      .catch(() => !cancelled && setError('We could not find this gift card. Check the code and try again.'));
    QRCode.toDataURL(`MSQ-GIFT:${code}`, { margin: 1, width: 240, color: { dark: '#0b1a33', light: '#ffffff' } })
      .then((d) => !cancelled && setQr(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>
        <Link to="/gift-cards" className="mt-4 inline-block font-semibold text-brand-700 underline">
          Back to gift cards
        </Link>
      </div>
    );
  if (!gift) return <div className="mx-auto aspect-[1.6] max-w-md animate-pulse rounded-[22px] bg-slate-100" aria-label="Loading gift card" />;

  const link = `${window.location.origin}/gift/${gift.code}`;
  const share = `${gift.to ? `${gift.to}, ` : ''}here is a Milestones Coffee gift card for you (${aed(gift.amount)})${gift.message ? `: "${gift.message}"` : ''} ${link}`;
  const status: Record<Gift['status'], [string, string]> = {
    pending: ['Not paid yet', 'Show this QR at any Milestones branch and pay to activate the card.'],
    active: ['Ready to use', `Show this QR at the counter.${gift.expires_on ? ` Valid until ${nice(gift.expires_on)}.` : ''}`],
    used: ['Fully used', 'The whole balance has been spent. Thank you!'],
    expired: ['Expired', gift.expires_on ? `This card expired on ${nice(gift.expires_on)}.` : 'This card has expired.'],
    cancelled: ['Cancelled', 'This card can no longer be used. Please contact us if this is a mistake.'],
  };
  const [title, text] = status[gift.status];
  const usable = gift.status === 'pending' || gift.status === 'active';

  return (
    <div className="mx-auto max-w-md space-y-5">
      {isNew && gift.status === 'pending' && (
        <p role="status" className="rounded-2xl bg-green-50 p-4 text-green-800">
          <span className="block font-semibold">Your gift card is ready.</span>
          Pay at any branch to activate it, then send it on WhatsApp.
        </p>
      )}
      <GiftCardArt design={gift.design} amount={gift.amount} balance={gift.balance} to={gift.to} from={gift.from} message={gift.message} />
      <div className="rounded-[22px] border border-brand-100 bg-white p-5 text-center">
        <p className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${gift.status === 'active' ? 'bg-green-100 text-green-800' : gift.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{title}</p>
        <p className="mt-2 text-slate-600">{text}</p>
        {usable && (qr ? <img src={qr} alt={`Gift card QR code ${showCode(gift.code)}`} className="mx-auto mt-4 h-[220px] w-[220px]" /> : <div className="mx-auto mt-4 h-[220px] w-[220px] rounded-2xl bg-slate-100" />)}
        <p className="mt-3 font-mono text-xl font-bold tracking-[0.2em] text-brand-900">{showCode(gift.code)}</p>
      </div>
      {usable && (
        <div className="grid grid-cols-2 gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-600 px-4 py-3 text-center font-semibold text-white hover:bg-green-700">
            Send on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined);
            }}
            className="rounded-full border border-brand-200 px-4 py-3 font-semibold text-brand-800"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      )}
      <p className="text-center text-sm">
        <Link to="/gift-cards" className="font-semibold text-brand-700 underline">
          Make another gift card
        </Link>
      </p>
    </div>
  );
}
