import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';
import { readFavs } from './lib/favorites';
import { bestDiscount } from './lib/happyHour';
import { countdown, DAY_NAMES, daysLeft, dubaiDate, icsFor, isTimed, liveNow, timing, weekGrid, whenLabel, type Offer } from './lib/offers';

interface Branch {
  id: string;
  name: string;
  status?: string;
  pickup_enabled?: boolean;
}
interface Category {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  category_id: string;
  base_price: number | string;
  status?: string;
  image_url?: string | null;
}
interface Rules {
  stamps_target: number;
  reward_name: string;
  birthday_bonus: number;
  referral_bonus: number;
  double_days: number[];
  double_from: string;
  double_to: string;
  double_now?: boolean;
  challenge_visits: number;
  challenge_bonus: number;
}

interface Card {
  name: string | null;
  stamps: number;
  target: number;
  reward_name: string;
  has_birthday?: boolean;
  birthday_week?: boolean;
  double_now?: boolean;
  tier?: 'bronze' | 'silver' | 'gold';
  tier_perk?: string;
  visits_year?: number;
  next_tier?: string | null;
  next_tier_at?: number | null;
  challenge?: { target: number; bonus: number; visits: number; done: boolean } | null;
}

type Tab = 'all' | 'live' | 'happy' | 'combo' | 'limited';
type Sort = 'smart' | 'discount' | 'ending';

const GRADIENTS = [
  'from-brand-700 via-brand-900 to-[#0b1a33]',
  'from-copper-500 via-copper-700 to-brand-900',
  'from-[#1f4a7a] via-brand-700 to-brand-900',
  'from-copper-700 via-brand-700 to-[#0b1a33]',
];
// Occasion looks set in admin → Offers.
const THEMES: Record<string, { label: string; icon: string; gradient: string; marks: string[]; ribbon: string }> = {
  national_day: { label: 'UAE National Day', icon: '🇦🇪', gradient: 'from-[#00732f] via-[#0b1a33] to-[#1f1f1f]', marks: ['🇦🇪', '✨', '🎉'], ribbon: 'Happy National Day! 🇦🇪' },
  ramadan: { label: 'Ramadan', icon: '🌙', gradient: 'from-[#0b1a33] via-[#1d2f5c] to-[#3a2a5c]', marks: ['🌙', '✨', '⭐', '🏮'], ribbon: 'Ramadan Kareem 🌙' },
  eid: { label: 'Eid', icon: '✨', gradient: 'from-[#7a5230] via-[#a87a50] to-[#d9b88f]', marks: ['✨', '🌙', '🎉'], ribbon: 'Eid Mubarak ✨' },
  new_year: { label: 'New Year', icon: '🎆', gradient: 'from-[#0b1a33] via-[#3b1d5c] to-[#7a1f5c]', marks: ['🎆', '🎇', '✨'], ribbon: 'Happy New Year 🎆' },
};
const themeOf = (o: Offer) => (o.theme ? THEMES[o.theme] : undefined);

const gradientFor = (id: string) => GRADIENTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % GRADIENTS.length];
const money = (n: number) => `AED ${n.toFixed(2)}`;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (s?: string | null, fallback = 0) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : fallback);
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // schedule rows Monday first
const SITE = 'https://coffeesales.ae/offers';
const isCombo = (o: Offer) => !!o.combo_price && (o.combo_product_ids ?? []).filter(Boolean).length >= 2;
// Order now: the branch menu (or the full menu), narrowed to a happy hour's items.
const orderLink = (o: Offer) => `${o.branch_id ? `/menu/${o.branch_id}` : '/menu'}${isTimed(o) ? `?deal=${o.id}` : ''}`;

function readToken() {
  try {
    return localStorage.getItem('milestones_loyalty_token') ?? '';
  } catch {
    return '';
  }
}

// Public Offers page: featured slider, live countdowns, filters, weekly happy-hour schedule, savings calculator and rewards.
export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('all');
  const [branch, setBranch] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('smart');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Offers');
    setMetaDescription('Milestones Coffee offers in Abu Dhabi: happy hours, limited-time deals and rewards, with live countdowns and a weekly schedule.');
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    // Offers for all branches plus each branch's own, merged.
    axios
      .get<Branch[]>('/api/branches')
      .then(async (r) => {
        const list = (Array.isArray(r.data) ? r.data : []).filter((b) => (b.status ?? 'active') === 'active');
        setBranches(list);
        const lists = await Promise.all([undefined, ...list.map((b) => b.id)].map((id) => axios.get<Offer[]>('/api/promotions', { params: id ? { branch_id: id } : {} }).then((x) => x.data)));
        setOffers([...new Map(lists.flat().map((o) => [o.id, o])).values()]);
      })
      .catch(() => setError(true));
    axios.get<Category[]>('/api/categories').then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
    axios.get<Product[]>('/api/products').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
    axios.get<Rules>('/api/loyalty/settings').then((r) => setRules(r.data)).catch(() => undefined);
    const token = readToken();
    if (token) axios.get(`/api/loyalty/card/${token}`).then((r) => setCard(r.data)).catch(() => undefined);
    return () => window.clearInterval(timer);
  }, []);

  // Structured data so search engines can list the offers.
  useEffect(() => {
    if (!offers?.length) return;
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Milestones Coffee offers',
      itemListElement: offers.map((o) => ({
        '@type': 'Offer',
        name: o.title,
        description: o.body ?? undefined,
        validFrom: o.starts_on ?? undefined,
        validThrough: o.ends_on ?? undefined,
        url: SITE,
      })),
    });
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [offers]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
  const branchName = (id?: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? 'One branch') : 'All branches');
  const all = offers ?? [];
  const offerCats = [...new Set(all.flatMap((o) => (o.category_ids ?? []).filter(Boolean)))].filter(catName);

  const shown = useMemo(() => {
    const list = all.filter((o) => {
      if (branch && o.branch_id && o.branch_id !== branch) return false;
      if (cat && (o.category_ids ?? []).filter(Boolean).length && !(o.category_ids ?? []).includes(cat)) return false;
      if (tab === 'live') return liveNow(o, now);
      if (tab === 'happy') return isTimed(o);
      if (tab === 'combo') return isCombo(o);
      if (tab === 'limited') return !!o.ends_on;
      return true;
    });
    const rank = (o: Offer) => {
      const t = timing(o, now);
      if (liveNow(o, now)) return 0;
      return t.next ? 1 + (t.next.getTime() - now.getTime()) / 1e10 : 2;
    };
    return list.sort((a, b) => {
      if (sort === 'discount') return (b.discount_percent ?? 0) - (a.discount_percent ?? 0);
      if (sort === 'ending') return (daysLeft(a, now) ?? 9999) - (daysLeft(b, now) ?? 9999);
      return rank(a) - rank(b) || (b.discount_percent ?? 0) - (a.discount_percent ?? 0);
    });
    // `now` changes every second; re-sorting that often is cheap for a handful of offers.
  }, [all, branch, cat, tab, sort, now]);

  const liveCount = all.filter((o) => liveNow(o, now)).length;
  const slides = useMemo(() => {
    // Featured first, then offers with pictures, then the biggest discounts.
    return [...all]
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(!!b.theme) - Number(!!a.theme) || Number(!!b.image_url) - Number(!!a.image_url) || (b.discount_percent ?? 0) - (a.discount_percent ?? 0))
      .slice(0, 5);
  }, [offers]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setToast(`Code ${code} copied`);
    } catch {
      setToast(`Your code: ${code}`);
    }
  }
  async function share(o: Offer) {
    const text = `${o.title}${o.discount_percent ? ` (${o.discount_percent}% off)` : ''} at Milestones Coffee`;
    if (navigator.share) {
      try {
        await navigator.share({ title: o.title, text, url: SITE });
        return;
      } catch {
        return; // the customer closed the share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${SITE}`)}`, '_blank', 'noopener');
  }
  function calendar(o: Offer) {
    const url = URL.createObjectURL(new Blob([icsFor(o, SITE)], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `milestones-${o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setToast('Added to your calendar file');
  }

  return (
    <div className="space-y-10 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">Deals & rewards</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-brand-900 md:text-5xl">Offers</h1>
        </div>
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            {liveCount} live now
          </span>
        )}
      </header>

      {(() => {
        // Festive ribbon while an occasion offer is on.
        const o = [...all].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).find((x) => themeOf(x) && liveNow(x, now));
        const look = o && themeOf(o);
        return look ? (
          <p className={`-mt-4 rounded-2xl bg-gradient-to-r ${look.gradient} px-5 py-3 text-center font-display text-xl text-white`}>{look.ribbon}</p>
        ) : null;
      })()}

      {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">Could not load offers. Please try again.</p>}
      {!error && offers === null && <div className="h-64 animate-pulse rounded-[28px] bg-brand-100/60" aria-label="Loading offers" />}

      {slides.length > 0 && <Slider slides={slides} now={now} />}

      {card && rules && <ForYou card={card} rules={rules} offers={all} products={products} now={now} />}

      {offers && offers.length > 0 && (
        <section aria-label="All offers" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Show" className="flex max-w-full overflow-x-auto rounded-full bg-white p-1 shadow-sm">
              {(
                [
                  ['all', 'All'],
                  ['live', 'Live now'],
                  ['happy', 'Happy hours'],
                  ['combo', 'Combos'],
                  ['limited', 'Limited time'],
                ] as const
              )
                .filter(([id]) => id !== 'combo' || all.some(isCombo))
                .map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === id ? 'bg-brand-700 text-white' : 'text-brand-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {branches.length > 1 && (
              <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch" className="rounded-full border border-brand-100 bg-white px-3.5 py-2 text-sm">
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="rounded-full border border-brand-100 bg-white px-3.5 py-2 text-sm">
              <option value="smart">Live & soonest first</option>
              <option value="discount">Biggest discount</option>
              <option value="ending">Ending soon</option>
            </select>
          </div>
          {offerCats.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {['', ...offerCats].map((c) => (
                <button
                  key={c || 'all'}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${cat === c ? 'bg-copper-500 text-white' : 'border border-brand-100 bg-white text-brand-800'}`}
                >
                  {c ? catName(c) : 'Everything'}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-500">
            {shown.length} {shown.length === 1 ? 'offer' : 'offers'}
          </p>
          {shown.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-slate-600">No offers match. Try another filter.</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((o) => (
                <li key={o.id}>
                  <OfferCard o={o} now={now} catName={catName} branchName={branchName} onCopy={copy} onShare={share} onCalendar={calendar} products={products} branches={branches} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {offers && offers.length === 0 && (
        <section className="rounded-[28px] bg-white p-8 text-center">
          <p className="text-4xl" aria-hidden="true">
            ☕
          </p>
          <h2 className="mt-2 font-display text-2xl text-brand-900">No offers right now</h2>
          <p className="mt-1 text-slate-600">New deals appear here first. Join our rewards to hear about them and earn a free drink.</p>
        </section>
      )}

      {all.some(isTimed) && <Schedule offers={all.filter((o) => !branch || !o.branch_id || o.branch_id === branch)} now={now} />}
      {all.some((o) => isTimed(o)) && products.length > 0 && <Savings offers={all} products={products} categories={categories} />}
      {rules && <Rewards rules={rules} card={card} />}

      {toast && (
        <p role="status" className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg md:bottom-8">
          {toast}
        </p>
      )}
    </div>
  );
}

function DiscountBadge({ o, big }: { o: Offer; big?: boolean }) {
  if (!o.discount_percent) return null;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-white text-center font-bold leading-none text-brand-900 shadow-lg ring-4 ring-copper-300/60 ${big ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-xl'}`}
      aria-label={`${o.discount_percent}% off`}
    >
      <span>
        {o.discount_percent}%<span className={`block font-semibold uppercase tracking-wider text-copper-700 ${big ? 'text-xs' : 'text-[10px]'}`}>off</span>
      </span>
    </span>
  );
}

function Status({ o, now, light }: { o: Offer; now: Date; light?: boolean }) {
  const t = timing(o, now);
  const left = daysLeft(o, now);
  if (t.live && t.until)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Live · ends in <span className="tabular-nums">{countdown(t.until.getTime() - now.getTime())}</span>
      </span>
    );
  if (t.next) {
    const soon = t.next.getTime() - now.getTime() < 3 * 3600_000;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${light ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-800'}`}>
        <Icon name="clock" className="h-3.5 w-3.5" />
        {soon ? (
          <>
            Starts in <span className="tabular-nums">{countdown(t.next.getTime() - now.getTime())}</span>
          </>
        ) : (
          `Next: ${whenLabel(t.next, now)}`
        )}
      </span>
    );
  }
  if (left !== null && left <= 3)
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{left <= 0 ? 'Last day!' : `Ends in ${left} day${left === 1 ? '' : 's'}`}</span>
    );
  return null;
}

function DayDots({ o, now }: { o: Offer; now: Date }) {
  const days = (o.days ?? []).filter(Boolean);
  const today = new Date(now.getTime() + 4 * 3600_000).getUTCDay();
  return (
    <div className="flex gap-1" aria-label={days.length ? `On ${days.map((d) => DAY_NAMES[Number(d)]).join(', ')}` : 'Every day'}>
      {ORDER.map((d) => {
        const on = !days.length || days.includes(String(d));
        return (
          <span
            key={d}
            aria-hidden="true"
            className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'} ${d === today ? 'ring-2 ring-copper-500 ring-offset-1' : ''}`}
          >
            {DAY_NAMES[d][0]}
          </span>
        );
      })}
    </div>
  );
}

function TimeBar({ o, now }: { o: Offer; now: Date }) {
  const start = toMin(o.start_time, 0);
  let end = toMin(o.end_time, 1440);
  if (end <= start) end += 1440;
  const parts = end > 1440 ? [[start, 1440], [0, end - 1440]] : [[start, end]];
  const local = new Date(now.getTime() + 4 * 3600_000);
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-slate-100" aria-hidden="true">
        {parts.map(([a, b]) => (
          <span key={a} className="absolute inset-y-0 rounded-full bg-gradient-to-r from-copper-300 to-copper-500" style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />
        ))}
        <span className="absolute -top-1 w-0.5 rounded bg-brand-900" style={{ left: `${(nowMin / 1440) * 100}%`, height: '18px' }} />
      </div>
      <p className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{o.start_time || o.end_time ? `${hhmm(start)}–${hhmm(end)}` : 'All day'}</span>
        <span>Dubai time</span>
      </p>
    </div>
  );
}

function Visual({ o, className, children }: { o: Offer; className: string; children?: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  const look = themeOf(o);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${look?.gradient ?? gradientFor(o.id)} ${className}`}>
      {o.theme === 'national_day' && (
        // UAE flag colours along the bottom edge.
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 flex h-1.5">
          <span className="w-1/4 bg-[#c8102e]" />
          <span className="flex-1 bg-[#00732f]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-black" />
        </span>
      )}
      {o.image_url && !broken ? (
        <img src={o.image_url} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : look ? (
        <span aria-hidden="true" className="absolute inset-0 select-none">
          {look.marks.concat(look.marks).map((m, k) => (
            <span key={k} className="absolute text-3xl opacity-40" style={{ left: `${(k * 37 + 8) % 92}%`, top: `${(k * 53 + 6) % 80}%`, transform: `rotate(${(k * 29) % 40 - 20}deg)` }}>
              {m}
            </span>
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="absolute -right-6 -top-8 select-none text-[9rem] leading-none opacity-15">
          ☕
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {children}
    </div>
  );
}

function OfferCard({
  o,
  now,
  catName,
  branchName,
  onCopy,
  onShare,
  onCalendar,
  products,
  branches,
}: {
  o: Offer;
  now: Date;
  catName: (id: string) => string;
  branchName: (id?: string | null) => string;
  onCopy: (code: string) => void;
  onShare: (o: Offer) => void;
  onCalendar: (o: Offer) => void;
  products: Product[];
  branches: Branch[];
}) {
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const comboItems = isCombo(o) ? (o.combo_product_ids ?? []).map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p) : [];
  const normal = comboItems.reduce((s, p) => s + Number(p.base_price), 0);
  // Combo: order from the offer's branch, the only branch taking orders, or let the visitor pick one.
  const orderBranches = o.branch_id ? branches.filter((b) => b.id === o.branch_id) : branches.filter((b) => b.pickup_enabled);
  const addCombo = (branchId: string) => navigate(`/menu/${branchId}?combo=${o.id}`);
  const cats = (o.category_ids ?? []).filter(Boolean).map(catName).filter(Boolean);
  const isNew = o.created_at && Date.now() - Date.parse(o.created_at) < 7 * 864e5;
  const live = liveNow(o, now);
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-[22px] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(10,26,51,0.12)] ${live ? 'ring-2 ring-green-600' : 'border border-brand-100'}`}>
      <Visual o={o} className="h-36">
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {isNew && <span className="rounded-full bg-yellow-300 px-2.5 py-0.5 text-[11px] font-bold text-yellow-950">NEW</span>}
            {o.featured && <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-brand-900">★ Featured</span>}
            {themeOf(o) && (
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-brand-900">
                {themeOf(o)!.icon} {themeOf(o)!.label}
              </span>
            )}
          </div>
          <DiscountBadge o={o} />
        </div>
        <p className="absolute bottom-3 left-3 text-xs font-semibold text-white/90">{branchName(o.branch_id)}</p>
      </Visual>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-xl leading-tight text-brand-900">{o.title}</h3>
          {o.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{o.body}</p>}
        </div>
        <Status o={o} now={now} />
        {isTimed(o) && (
          <div className="space-y-2">
            <DayDots o={o} now={now} />
            <TimeBar o={o} now={now} />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(cats.length ? cats : isTimed(o) ? ['Whole menu'] : []).map((c) => (
            <span key={c} className="rounded-full bg-cream px-2.5 py-1 font-medium text-brand-900">
              {c}
            </span>
          ))}
          {(o.starts_on || o.ends_on) && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              {o.starts_on && o.starts_on > dubaiDate(now) ? `From ${o.starts_on}` : ''}
              {o.ends_on ? `Until ${new Date(`${o.ends_on}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          )}
        </div>
        {comboItems.length >= 2 && (
          <div className="rounded-2xl bg-cream p-3">
            <ul className="flex flex-wrap items-center gap-2">
              {comboItems.map((p, k) => (
                <li key={p.id} className="flex items-center gap-2">
                  {k > 0 && (
                    <span className="font-bold text-copper-700" aria-hidden="true">
                      +
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-medium text-brand-900">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} className="h-7 w-7 rounded-full bg-brand-50 object-cover" />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs" aria-hidden="true">
                        ☕
                      </span>
                    )}
                    {p.name}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold text-brand-900">{money(Number(o.combo_price))}</span>
              {normal > Number(o.combo_price) && (
                <>
                  <s className="text-sm text-slate-500">{money(normal)}</s>
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">Save {money(normal - Number(o.combo_price))}</span>
                </>
              )}
            </p>
          </div>
        )}
        {o.promo_code && (
          <button
            type="button"
            onClick={() => onCopy(o.promo_code!)}
            className="flex items-center justify-between rounded-xl border-2 border-dashed border-copper-500 bg-cream px-3 py-2 text-left"
            aria-label={`Copy code ${o.promo_code}`}
          >
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-copper-700">Show this code</span>
              <span className="font-mono text-lg font-bold tracking-widest text-brand-900">{o.promo_code}</span>
            </span>
            <span className="text-xs font-semibold text-copper-700">Copy</span>
          </button>
        )}
        {picking && (
          <div className="rounded-2xl border border-brand-100 p-3">
            <p className="mb-2 text-sm font-semibold text-brand-900">Pick up from</p>
            <div className="flex flex-wrap gap-2">
              {orderBranches.map((b) => (
                <button key={b.id} type="button" onClick={() => addCombo(b.id)} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-100">
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {comboItems.length >= 2 && orderBranches.length ? (
            <button
              type="button"
              onClick={() => (orderBranches.length === 1 ? addCombo(orderBranches[0].id) : setPicking((x) => !x))}
              className="flex-1 rounded-full bg-copper-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-copper-700"
            >
              Add combo to order
            </button>
          ) : (
            <Link to={orderLink(o)} className="flex-1 rounded-full bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-900">
              {comboItems.length >= 2 ? 'See on menu' : 'Order now'}
            </Link>
          )}
          <button type="button" onClick={() => onShare(o)} aria-label={`Share ${o.title}`} className="grid h-10 w-10 place-items-center rounded-full border border-brand-100 text-brand-700 hover:bg-brand-50">
            <Icon name="nav" className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onCalendar(o)} aria-label={`Add ${o.title} to calendar`} className="grid h-10 w-10 place-items-center rounded-full border border-brand-100 text-brand-700 hover:bg-brand-50">
            <Icon name="clock" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// Big featured slider: swipe, arrows, dots; auto-advances unless the visitor is interacting or prefers less motion.
function Slider({ slides, now }: { slides: Offer[]; now: Date }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const n = slides.length;
  useEffect(() => {
    if (paused || reduce || n < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => window.clearInterval(t);
  }, [paused, reduce, n]);
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const o = slides[Math.min(i, n - 1)];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      className="relative"
    >
      <Visual key={o.id} o={o} className="min-h-[300px] rounded-[28px] md:min-h-[360px]">
        <div className="relative flex h-full min-h-[300px] flex-col justify-end gap-4 p-6 text-white md:min-h-[360px] md:flex-row md:items-end md:justify-between md:p-10">
          <div className="max-w-xl animate-[fadein_.5s_ease]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{themeOf(o) ? `${themeOf(o)!.icon} ${themeOf(o)!.label}` : o.featured ? 'Featured offer' : 'Top offer'}</p>
            <h2 className="mt-2 font-display text-3xl leading-tight md:text-5xl">{o.title}</h2>
            {o.body && <p className="mt-2 line-clamp-2 text-white/85 md:text-lg">{o.body}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Status o={o} now={now} light />
              <Link to={orderLink(o)} className="rounded-full bg-copper-500 px-5 py-2.5 font-semibold hover:bg-copper-700">
                Order now
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <DiscountBadge o={o} big />
          </div>
        </div>
      </Visual>
      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous offer" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-900 shadow md:grid">
            <Icon name="arrow" className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next offer" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-900 shadow md:grid">
            <Icon name="arrow" className="h-4 w-4" />
          </button>
          <div className="mt-3 flex justify-center gap-2">
            {slides.map((s, k) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show offer ${k + 1}: ${s.title}`}
                aria-current={k === i}
                onClick={() => setI(k)}
                className={`h-2 rounded-full transition-all ${k === i ? 'w-8 bg-copper-500' : 'w-2 bg-brand-100'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Weekly happy-hour schedule: one row per weekday, a 24-hour track with each deal's window and a "now" line on today.
function Schedule({ offers, now }: { offers: Offer[]; now: Date }) {
  const grid = weekGrid(offers);
  const local = new Date(now.getTime() + 4 * 3600_000);
  const today = local.getUTCDay();
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const colors = ['bg-copper-500', 'bg-brand-700', 'bg-green-600', 'bg-rose-500', 'bg-sky-600'];
  const ids = [...new Set(offers.filter(isTimed).map((o) => o.id))];
  const color = (id: string) => colors[ids.indexOf(id) % colors.length];
  // Overlapping deals on the same day go on separate lanes so none hides another.
  const lanes = grid.map((row) => {
    const ends: number[] = [];
    const of = row.map((s) => {
      let lane = ends.findIndex((e) => e <= s.from);
      if (lane === -1) lane = ends.length;
      ends[lane] = s.to;
      return lane;
    });
    return { of, count: Math.max(1, ends.length) };
  });
  return (
    <section className="rounded-[28px] bg-white p-5 md:p-8">
      <h2 className="font-display text-2xl text-brand-900">Happy hour schedule</h2>
      <p className="mt-1 text-sm text-slate-600">When each deal runs this week (Dubai time).</p>
      <div className="mt-5 space-y-2.5">
        <div className="ml-12 flex justify-between text-[11px] text-slate-400" aria-hidden="true">
          {['00', '06', '12', '18', '24'].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
        {ORDER.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className={`w-9 shrink-0 text-sm font-semibold ${d === today ? 'text-copper-700' : 'text-slate-600'}`}>{DAY_NAMES[d]}</span>
            <div className={`relative flex-1 rounded-lg ${d === today ? 'bg-cream' : 'bg-slate-50'}`} style={{ height: `${lanes[d].count * 24 + 4}px` }}>
              {[25, 50, 75].map((p) => (
                <span key={p} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: `${p}%` }} aria-hidden="true" />
              ))}
              {grid[d].map((s, k) => (
                <span
                  key={k}
                  title={`${s.offer.title}: ${hhmm(s.from)}–${hhmm(s.to)}`}
                  className={`absolute h-5 overflow-hidden whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold leading-5 text-white ${color(s.offer.id)}`}
                  style={{ top: `${lanes[d].of[k] * 24 + 2}px`, left: `${(s.from / 1440) * 100}%`, width: `${Math.max(1.5, ((s.to - s.from) / 1440) * 100)}%` }}
                >
                  <span className="hidden sm:inline">
                    {s.offer.discount_percent}% {s.offer.title}
                  </span>
                </span>
              ))}
              {d === today && <span className="absolute -inset-y-1 w-0.5 rounded bg-brand-900" style={{ left: `${(nowMin / 1440) * 100}%` }} aria-label="Now" />}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
        {offers.filter(isTimed).map((o) => (
          <li key={o.id} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${color(o.id)}`} />
            {o.title} · {o.discount_percent}% off
          </li>
        ))}
      </ul>
    </section>
  );
}

// "How much could I save?" using the best happy-hour discount for the chosen drink's category.
function Savings({ offers, products, categories }: { offers: Offer[]; products: Product[]; categories: Category[] }) {
  const timed = offers.filter(isTimed);
  const eligible = products.filter((p) => (p.status ?? 'active') === 'active' && timed.some((o) => !(o.category_ids ?? []).filter(Boolean).length || (o.category_ids ?? []).includes(p.category_id)));
  const [id, setId] = useState('');
  const [qty, setQty] = useState(1);
  const [visits, setVisits] = useState(3);
  if (!eligible.length) return null;
  const p = eligible.find((x) => x.id === id) ?? eligible[0];
  const deal = timed
    .filter((o) => !(o.category_ids ?? []).filter(Boolean).length || (o.category_ids ?? []).includes(p.category_id))
    .sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0))[0];
  const price = Number(p.base_price) * qty;
  const save = Math.round(price * (deal.discount_percent ?? 0)) / 100;
  const month = save * visits * 4.33;
  return (
    <section className="grid gap-6 rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white md:grid-cols-2 md:p-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">Savings calculator</p>
        <h2 className="mt-2 font-display text-3xl">How much could you save?</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-brand-100">Your usual order</span>
            <select value={p.id} onChange={(e) => setId(e.target.value)} className="w-full rounded-xl border-0 bg-white/10 px-3 py-2.5 text-white [&>option]:text-brand-900">
              {eligible.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({categories.find((c) => c.id === x.category_id)?.name ?? ''})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-semibold text-brand-100">
              How many each visit <span className="tabular-nums text-white">{qty}</span>
            </span>
            <input type="range" min={1} max={6} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full accent-copper-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-semibold text-brand-100">
              Happy-hour visits a week <span className="tabular-nums text-white">{visits}</span>
            </span>
            <input type="range" min={1} max={7} value={visits} onChange={(e) => setVisits(Number(e.target.value))} className="w-full accent-copper-500" />
          </label>
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-2xl bg-white/10 p-6" aria-live="polite">
        <p className="text-sm text-brand-100">With {deal.title}</p>
        <p className="mt-1 text-lg">
          <s className="text-brand-100/80">{money(price)}</s> <span className="font-bold">{money(price - save)}</span> a visit
        </p>
        <p className="mt-4 text-sm text-brand-100">You save about</p>
        <p className="font-display text-5xl text-copper-300">{money(month)}</p>
        <p className="text-sm text-brand-100">a month</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <div className="h-full rounded-full bg-copper-500 transition-all" style={{ width: `${deal.discount_percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-brand-100">{deal.discount_percent}% off during happy hour. Branch prices can differ.</p>
      </div>
    </section>
  );
}

// Rewards perks from the live loyalty settings, with the visitor's own progress when they have a card on this phone.
function Rewards({ rules, card }: { rules: Rules; card: Card | null }) {
  const perks = [
    { icon: '☕', title: `Buy ${rules.stamps_target - 1}, get 1 free`, text: `Collect ${rules.stamps_target} stamps for a ${rules.reward_name.toLowerCase()}.` },
    rules.double_days?.length
      ? { icon: '✨', title: 'Double stamps', text: `${rules.double_days.map((d) => DAY_NAMES[d]).join(', ')} ${rules.double_from}–${rules.double_to}${rules.double_now ? ' (on right now!)' : ''}.` }
      : null,
    rules.birthday_bonus > 0 ? { icon: '🎂', title: 'Birthday treat', text: `${rules.birthday_bonus} bonus stamp${rules.birthday_bonus > 1 ? 's' : ''} in your birthday week.` } : null,
    rules.referral_bonus > 0 ? { icon: '🤝', title: 'Bring a friend', text: `You both get ${rules.referral_bonus} bonus stamp${rules.referral_bonus > 1 ? 's' : ''}.` } : null,
    rules.challenge_visits > 0 ? { icon: '🏆', title: 'Weekly challenge', text: `Visit ${rules.challenge_visits} times in a week for ${rules.challenge_bonus} extra stamp${rules.challenge_bonus > 1 ? 's' : ''}.` } : null,
  ].filter(Boolean) as { icon: string; title: string; text: string }[];
  return (
    <section className="rounded-[28px] border border-brand-100 bg-white p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">Every day</p>
          <h2 className="mt-1 font-display text-3xl text-brand-900">Rewards that add up</h2>
        </div>
        {card ? (
          <Link to="/loyalty" className="inline-flex items-center gap-2 rounded-full border border-brand-100 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50">
            <Icon name="gift" className="h-4 w-4" /> Open my card
          </Link>
        ) : (
          <Link to="/loyalty" className="inline-flex items-center gap-2 rounded-full bg-copper-500 px-5 py-2.5 font-semibold text-white hover:bg-copper-700">
            <Icon name="gift" className="h-4 w-4" /> Join free
          </Link>
        )}
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {perks.map((p) => (
          <li key={p.title} className="rounded-2xl bg-cream p-4">
            <span className="text-2xl" aria-hidden="true">
              {p.icon}
            </span>
            <p className="mt-2 font-semibold text-brand-900">{p.title}</p>
            <p className="text-sm text-slate-600">{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ring({ value, of }: { value: number; of: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, of)) * 100));
  return (
    <span className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#a87a50 ${pct * 3.6}deg, rgba(255,255,255,0.18) 0deg)` }} aria-label={`${value} of ${of} stamps`}>
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-900 text-center text-sm font-bold text-white">
        {value}/{of}
      </span>
    </span>
  );
}

function Bar({ value, of }: { value: number; of: number }) {
  return (
    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
      <span className="block h-full rounded-full bg-copper-500" style={{ width: `${Math.min(100, (value / Math.max(1, of)) * 100)}%` }} />
    </span>
  );
}

const TIER = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as Record<string, string>;
const TIER_ICON = { bronze: '🥉', silver: '🥈', gold: '🥇' } as Record<string, string>;

// "For you": what this visitor's rewards card and hearted drinks mean today.
function ForYou({ card, rules, offers, products, now }: { card: Card; rules: Rules; offers: Offer[]; products: Product[]; now: Date }) {
  const tiles: { key: string; icon: string; title: string; text?: string; to?: string; bar?: [number, number]; hot?: boolean }[] = [];
  if (card.stamps >= card.target) tiles.push({ key: 'reward', icon: '🎁', title: `Your ${card.reward_name.toLowerCase()} is ready`, text: 'Show your card at the counter.', to: '/loyalty', hot: true });
  if (card.birthday_week)
    tiles.push({ key: 'bday', icon: '🎂', title: `Happy birthday week${card.name ? `, ${card.name.split(' ')[0]}` : ''}!`, text: `${rules.birthday_bonus} bonus stamp${rules.birthday_bonus > 1 ? 's' : ''} on your next visit.`, hot: true });
  else if (!card.has_birthday && rules.birthday_bonus > 0) tiles.push({ key: 'bday-add', icon: '🎂', title: 'Add your birthday', text: 'Get a birthday treat every year.', to: '/loyalty' });
  if (card.double_now) tiles.push({ key: 'double', icon: '✨', title: 'Double stamps right now', text: `Until ${rules.double_to}.`, hot: true });
  // Hearted drinks that are on a deal now (or later today).
  const favs = readFavs();
  for (const p of products.filter((x) => favs.includes(x.id)).slice(0, 12)) {
    const live = bestDiscount(offers, p.category_id, now);
    if (live) {
      const o = offers.find((x) => x.title === live.title && isTimed(x));
      tiles.push({ key: `fav-${p.id}`, icon: '❤', title: `Your ${p.name} is ${live.percent}% off now`, text: live.until ? `Until ${live.until}.` : undefined, to: o ? `/menu?deal=${o.id}` : '/menu', hot: true });
      continue;
    }
    const later = offers
      .filter((o) => isTimed(o) && (!(o.category_ids ?? []).filter(Boolean).length || (o.category_ids ?? []).includes(p.category_id)))
      .map((o) => ({ o, t: timing(o, now) }))
      .filter((x) => x.t.next && x.t.next.getTime() - now.getTime() < 24 * 3600_000)
      .sort((a, b) => a.t.next!.getTime() - b.t.next!.getTime())[0];
    if (later) tiles.push({ key: `fav-${p.id}`, icon: '❤', title: `Your ${p.name}: ${later.o.discount_percent}% off from ${whenLabel(later.t.next!, now)}`, to: `/menu?deal=${later.o.id}` });
  }
  if (card.tier && card.tier_perk) tiles.push({ key: 'tier', icon: TIER_ICON[card.tier] ?? '⭐', title: `${TIER[card.tier]} member`, text: card.tier_perk });
  else if (card.next_tier && card.next_tier_at)
    tiles.push({
      key: 'tier',
      icon: TIER_ICON[card.next_tier] ?? '⭐',
      title: `${Math.max(0, card.next_tier_at - (card.visits_year ?? 0))} visits to ${TIER[card.next_tier] ?? card.next_tier}`,
      bar: [card.visits_year ?? 0, card.next_tier_at],
    });
  if (card.challenge && !card.challenge.done)
    tiles.push({ key: 'challenge', icon: '🏆', title: `Weekly challenge: ${card.challenge.visits}/${card.challenge.target} visits`, text: `+${card.challenge.bonus} stamp${card.challenge.bonus > 1 ? 's' : ''} when you finish.`, bar: [card.challenge.visits, card.challenge.target] });
  const left = Math.max(0, card.target - card.stamps);
  return (
    <section aria-label="For you" className="rounded-[28px] bg-gradient-to-br from-brand-900 to-brand-700 p-5 text-white md:p-8">
      <div className="flex items-center gap-4">
        <Ring value={Math.min(card.stamps, card.target)} of={card.target} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">For you</p>
          <h2 className="font-display text-2xl md:text-3xl">{card.name ? `Hi ${card.name.split(' ')[0]}` : 'Your rewards'}</h2>
          <p className="text-sm text-brand-100">{left ? `${left} more stamp${left > 1 ? 's' : ''} for a ${card.reward_name.toLowerCase()}` : `${card.reward_name} ready to collect`}</p>
        </div>
      </div>
      {tiles.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((x) => {
            const inner = (
              <>
                <span className="text-2xl" aria-hidden="true">
                  {x.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{x.title}</span>
                  {x.text && <span className="block text-sm text-brand-100">{x.text}</span>}
                  {x.bar && <Bar value={x.bar[0]} of={x.bar[1]} />}
                </span>
                {x.to && <Icon name="arrow" className="h-4 w-4 shrink-0 opacity-70" />}
              </>
            );
            const cls = `flex h-full items-start gap-3 rounded-2xl p-4 ${x.hot ? 'bg-copper-500/90' : 'bg-white/10'}`;
            return <li key={x.key}>{x.to ? <Link to={x.to} className={`${cls} hover:brightness-110`}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
