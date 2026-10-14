import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { animate, motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FeedbackForm, LoyaltyCard, MenuPage, QRScannerPage } from './App';
import { ContactButtons } from './lib/ContactButtons';
import { getTodayHours, getWeekHours, isOpenNow } from './lib/hours';
import { buildJsonLd, setMetaDescription, setPageTitle } from './lib/seo';
import BranchMapPage from './BranchMapPage';
import OffersPage from './OffersPage';
import GalleryPage from './GalleryPage';
import { BlogListPage, BlogPostPage } from './BlogPages';
import FaqPage from './FaqPage';

const API = '/api';
const TZ = 'Asia/Dubai';

export interface SiteBranch {
  id: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  status: string;
  latitude?: number;
  longitude?: number;
  operating_hours?: Record<string, any>;
  whatsapp_number?: string | null;
  google_maps_url?: string | null;
  google_review_url?: string | null;
  delivery_links?: Record<string, string> | null;
}

function useBranches() {
  const [branches, setBranches] = useState<SiteBranch[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    axios
      .get<SiteBranch[]>(`${API}/branches`)
      .then((r) => setBranches((Array.isArray(r.data) ? r.data : []).filter((b) => b.status === 'active')))
      .catch(() => setError(true));
  }, []);
  return { branches, error };
}

// Programme rules set by admins; falls back to the defaults if the API is unreachable.
function useLoyaltyRules() {
  const [rules, setRules] = useState({ stamps_target: 10, reward_name: 'Free drink' });
  useEffect(() => {
    axios
      .get(`${API}/loyalty/settings`)
      .then((r) => {
        if (r.data && typeof r.data.stamps_target === 'number' && typeof r.data.reward_name === 'string') setRules(r.data);
      })
      .catch(() => {});
  }, []);
  return rules;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function HoursLine({ branch }: { branch: SiteBranch }) {
  const now = new Date();
  const open = isOpenNow(branch.operating_hours, branch.timezone || TZ, now);
  const today = getTodayHours(branch.operating_hours, branch.timezone || TZ, now);
  if (open === null) return <span className="text-gray-500 text-sm">Hours unavailable</span>;
  return (
    <span className="text-sm">
      <span className={open ? 'font-semibold text-green-700' : 'font-semibold text-gray-600'}>
        {open ? 'Open now' : 'Closed'}
      </span>
      {today && <span className="text-gray-600"> · Today {today.open}–{today.close}</span>}
    </span>
  );
}

const NAV: [string, string][] = [
  ['/menu', 'Menu'],
  ['/branches', 'Find a Branch'],
  ['/loyalty', 'Rewards'],
  ['/news', "What's New"],
];
const MORE: [string, string][] = [
  ['/about', 'About'],
  ['/gallery', 'Gallery'],
  ['/faq', 'FAQ'],
  ['/feedback', 'Feedback'],
  ['/contact', 'Contact'],
];
// Social links shown in the footer. Add the owner's, e.g. ['Instagram', 'https://instagram.com/...'].
const SOCIAL: [string, string][] = [];

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-white font-semibold mb-3">{title}</p>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-brand-900 text-white/75 text-sm pb-16 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 grid-cols-2 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-white font-display text-lg">
            <img src="/logo/logo-512.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
            Milestones Coffee
          </div>
          <p className="mt-3">Branches across Abu Dhabi.</p>
          {SOCIAL.length > 0 && (
            <div className="mt-3 flex gap-3">
              {SOCIAL.map(([label, href]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Explore" links={[['/menu', 'Menu'], ['/news', "What's New"], ['/loyalty', 'Rewards'], ['/gallery', 'Gallery']]} />
        <FooterCol title="Visit" links={[['/branches', 'Find a Branch'], ['/scan', 'Scan a QR'], ['/contact', 'Contact']]} />
        <FooterCol title="Help" links={[['/faq', 'FAQ'], ['/feedback', 'Feedback'], ['/about', 'About']]} />
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} Milestones Coffee</div>
    </footer>
  );
}

function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMoreOpen(false), [pathname]);
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));
  const tabClass = (on: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium ${on ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'}`;
  const barItems: [string, string][] = [
    ['/', 'Home'],
    ['/menu', 'Menu'],
    ['/branches', 'Branches'],
    ['/loyalty', 'Rewards'],
  ];

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-brand-700 text-white sticky top-0 z-40 shadow">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
            <img src="/logo/logo-512.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full ring-2 ring-copper-500" />
            Milestones Coffee
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={tabClass(active(to))}>
                {label}
              </Link>
            ))}
            <div className="relative">
              <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className={tabClass(moreOpen)}>
                More ▾
              </button>
              {moreOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white text-brand-800 shadow-lg py-2">
                  {MORE.map(([to, label]) => (
                    <Link key={to} to={to} className="block px-4 py-2 text-sm hover:bg-cream">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/scan" className="ml-2 px-4 py-2 rounded-lg bg-copper-700 hover:bg-copper-500 text-white text-sm font-semibold">
              Scan QR
            </Link>
          </nav>
          <Link to="/scan" className="md:hidden px-3 py-2 rounded-lg bg-copper-700 text-white text-sm font-semibold">
            Scan QR
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>

      <SiteFooter />

      {moreOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-16 z-40 bg-white border-t shadow-lg p-2">
          {MORE.map(([to, label]) => (
            <Link key={to} to={to} className="block px-4 py-3 text-brand-800 font-medium rounded-lg hover:bg-cream">
              {label}
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t grid grid-cols-5">
        {barItems.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center justify-center text-xs font-semibold ${
              active(to) ? 'text-brand-700 border-t-2 border-copper-500' : 'text-slate-500'
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`text-xs font-semibold ${moreOpen ? 'text-brand-700' : 'text-slate-500'}`}
        >
          More
        </button>
      </nav>
    </div>
  );
}

function ScanPage() {
  const navigate = useNavigate();
  useEffect(() => setPageTitle('Scan a branch QR'), []);
  return (
    <section className="max-w-md mx-auto space-y-4">
      <h1 className="text-3xl font-semibold text-brand-800">Scan a branch QR</h1>
      <p className="text-slate-600">Point your camera at the QR code on your table to open that branch's menu.</p>
      <QRScannerPage onBranchDetected={(id, table) => navigate(`/menu/${id}${table ? `?table=${table}` : ''}`)} />
    </section>
  );
}

// Counts from 0 up to `to` once, then stays. Shows the final number straight away if reduced motion is on.
function CountUp({ to }: { to: number }) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? to : 0);

  useEffect(() => {
    if (reduceMotion) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, reduceMotion]);

  return <>{value}</>;
}

interface FeaturedProduct {
  id: string;
  name: string;
  description?: string;
  base_price: number | string;
  image_url?: string;
  status: string;
  is_popular?: boolean;
  display_order?: number;
}

function FeaturedMenu() {
  const [items, setItems] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/products`)
      .then((res) => {
        if (cancelled || !Array.isArray(res.data)) return;
        const popular = (res.data as FeaturedProduct[])
          .filter((p) => p.is_popular && p.status === 'active')
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .slice(0, 6);
        setItems(popular);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const reduceMotion = useReducedMotion();
  if (items.length === 0) return null;

  return (
    <motion.section
      className=""
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl md:text-3xl text-brand-800">Our favourites</h2>
        <Link to="/menu" className="text-sm font-semibold text-brand-700">View full menu →</Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {items.map((p, i) => (
          <motion.li
            key={p.id}
            className="rounded-2xl bg-white p-5 shadow-sm"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
          >
            <p className="font-semibold text-gray-800">{p.name}</p>
            {p.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</p>}
            <p className="mt-2 font-bold text-copper-700">{Number(p.base_price).toFixed(2)} AED</p>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}

// Set to '/hero/hero.webp' once the owner's photo is added to packages/menu-app/public/hero/.
const HERO_IMAGE = '';

function OfferBand() {
  const [offer, setOffer] = useState<{ id: string; title: string; body: string | null; ends_on: string | null } | null>(null);
  useEffect(() => {
    axios
      .get(`${API}/promotions`)
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length) setOffer(r.data[0]);
      })
      .catch(() => {});
  }, []);
  if (!offer) return null;
  return (
    <section className="rounded-3xl bg-brand-800 text-white p-8 md:flex md:items-center md:justify-between gap-6">
      <div>
        <p className="text-copper-300 text-sm font-semibold uppercase tracking-wide">Offer</p>
        <h2 className="text-2xl md:text-3xl mt-1">{offer.title}</h2>
        {offer.body && <p className="mt-2 text-white/80">{offer.body}</p>}
        {offer.ends_on && <p className="mt-2 text-sm text-white/60">Until {offer.ends_on}</p>}
      </div>
      <Link to="/news" className="mt-4 md:mt-0 inline-block px-5 py-3 rounded-xl bg-copper-700 hover:bg-copper-500 font-semibold">
        All offers
      </Link>
    </section>
  );
}

function LoyaltyBand() {
  const { stamps_target, reward_name } = useLoyaltyRules();
  return (
    <section className="rounded-3xl bg-white p-8 shadow-sm md:flex md:items-center md:justify-between gap-6">
      <div>
        <h2 className="text-2xl md:text-3xl text-brand-800">Collect {stamps_target} stamps, earn a reward</h2>
        <p className="mt-2 text-slate-600">Reward: {reward_name}. Join free with your phone number. Staff add stamps at the counter.</p>
        <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.min(stamps_target, 15) }, (_, i) => (
            <span key={i} className={`h-6 w-6 rounded-full ${i < 3 ? 'bg-copper-500' : 'border-2 border-copper-300'}`} />
          ))}
        </div>
      </div>
      <Link
        to="/loyalty"
        className="mt-6 md:mt-0 inline-block px-5 py-3 rounded-xl bg-brand-700 hover:bg-brand-600 text-white font-semibold"
      >
        Join free
      </Link>
    </section>
  );
}

function HomePage() {
  const [params] = useSearchParams();
  const { branches } = useBranches();
  const reduceMotion = useReducedMotion();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const rules = useLoyaltyRules();

  const openCount = useMemo(
    () => (branches ?? []).filter((b) => isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) === true).length,
    [branches],
  );
  const nearest = useMemo(() => {
    const list = branches ?? [];
    if (coords) {
      return list
        .filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number')
        .map((b) => ({ b, km: distanceKm(coords.lat, coords.lng, b.latitude as number, b.longitude as number) as number | null }))
        .sort((a, c) => (a.km ?? 0) - (c.km ?? 0))
        .slice(0, 3);
    }
    return list.slice(0, 3).map((b) => ({ b, km: null as number | null }));
  }, [branches, coords]);

  useEffect(() => {
    setPageTitle('Milestones Coffee');
    setMetaDescription('Milestones Coffee menus, branches, opening hours, offers and rewards.');
  }, []);

  // Old QR codes point to /?branch=<id>&table=<n>: send them to the branch menu.
  const legacyBranch = params.get('branch');
  if (legacyBranch && /^[a-f0-9-]{8,}$/i.test(legacyBranch)) {
    const table = params.get('table');
    const safeTable = table && /^[\w-]{1,20}$/.test(table) ? `?table=${table}` : '';
    return <Navigate to={`/menu/${legacyBranch}${safeTable}`} replace />;
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    );
  }

  const fade = (delay: number) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: 'easeOut' as const } };
  const quick: [string, string, string][] = [
    ['/menu', 'Menu', 'Browse drinks and food'],
    ['/branches', 'Find a branch', 'Open now near you'],
    ['/scan', 'Scan QR', 'Open your table menu'],
    ['/loyalty', 'Rewards', `${rules.stamps_target} stamps: ${rules.reward_name}`],
  ];

  return (
    <div className="space-y-12">
      <section
        className="relative overflow-hidden rounded-3xl text-white"
        style={
          HERO_IMAGE
            ? {
                backgroundImage: `linear-gradient(rgba(11,26,51,.6),rgba(11,26,51,.85)), url(${HERO_IMAGE})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {!HERO_IMAGE && <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600" aria-hidden="true" />}
        <div className="relative px-6 py-16 md:py-24 text-center">
          <motion.img
            src="/logo/logo-512.png"
            alt=""
            width={112}
            height={112}
            className="mx-auto h-28 w-28 rounded-full ring-4 ring-copper-500/60"
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'backOut' }}
          />
          <motion.h1 className="mt-6 text-4xl md:text-6xl font-semibold" {...fade(0.15)}>
            Milestones Coffee
          </motion.h1>
          <motion.p className="mt-4 text-lg text-copper-300" {...fade(0.25)}>
            {branches ? (
              <>
                <CountUp to={openCount} /> of {branches.length} branches open now
              </>
            ) : (
              'Loading branches…'
            )}
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap justify-center gap-3" {...fade(0.35)}>
            <Link to="/menu" className="px-6 py-3 rounded-xl bg-copper-700 hover:bg-copper-500 font-semibold">
              View menu
            </Link>
            <Link to="/branches" className="px-6 py-3 rounded-xl border border-white/60 hover:bg-white/10 font-semibold">
              Find a branch
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quick.map(([to, title, sub]) => (
          <Link key={to} to={to} className="rounded-2xl bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
            <p className="font-semibold text-brand-800">{title}</p>
            <p className="text-sm text-slate-600 mt-1">{sub}</p>
          </Link>
        ))}
      </section>

      <FeaturedMenu />
      <OfferBand />
      <LoyaltyBand />

      {nearest.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4 gap-3">
            <h2 className="text-2xl md:text-3xl text-brand-800">{coords ? 'Nearest to you' : 'Our branches'}</h2>
            <div className="flex gap-4 text-sm font-semibold">
              {!coords && (
                <button type="button" onClick={locate} className="text-copper-700">
                  Use my location
                </button>
              )}
              <Link to="/branches" className="text-brand-700">
                See all →
              </Link>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {nearest.map(({ b, km }) => (
              <Link key={b.id} to={`/branches/${b.id}`} className="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition">
                <p className="font-semibold text-brand-800">{b.name}</p>
                <p className="text-sm text-slate-600 mt-1">{b.address}</p>
                <div className="mt-2">
                  <HoursLine branch={b} />
                </div>
                {km !== null && <p className="mt-1 text-xs text-slate-500">{km.toFixed(1)} km away</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WhatsNewPage() {
  useEffect(() => setPageTitle("What's New"), []);
  return (
    <div className="space-y-12">
      <h1 className="text-3xl md:text-4xl font-semibold text-brand-800">What's New</h1>
      <OffersPage />
      <BlogListPage />
    </div>
  );
}

function BranchesPage() {
  const { branches, error } = useBranches();
  const [query, setQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'list';
  setPageTitle('Find a Branch');

  const list = (branches ?? []).filter((b) => {
    if (query && !`${b.name} ${b.address}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (onlyOpen && isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) !== true) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl md:text-4xl font-semibold text-brand-800">Find a Branch</h1>
        <div className="inline-flex rounded-lg bg-white p-1 shadow-sm" role="group" aria-label="View">
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setParams(v === 'map' ? { view: 'map' } : {})}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${view === v ? 'bg-brand-700 text-white' : 'text-brand-800'}`}
            >
              {v === 'map' ? 'Map' : 'List'}
            </button>
          ))}
        </div>
      </div>
      {view === 'map' ? (
        <BranchMapPage branches={branches} />
      ) : (
        <>
      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or area"
          className="flex-1 min-w-[12rem] border rounded px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Open now
        </label>
      </div>
      {error && <p className="text-red-600">Could not load branches. Try again later.</p>}
      {!branches && !error && <p className="text-gray-500">Loading…</p>}
      <ul className="grid md:grid-cols-2 gap-4">
        {list.map((b) => (
          <li key={b.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            <Link to={`/branches/${b.id}`} className="text-lg font-bold text-brand-800">{b.name}</Link>
            <p className="text-sm text-gray-600">{b.address}</p>
            <HoursLine branch={b} />
            <ContactButtons branch={b as any} />
            <Link to={`/menu/${b.id}`} className="inline-block text-sm font-semibold text-brand-700">View menu →</Link>
          </li>
        ))}
      </ul>
      {branches && list.length === 0 && <p className="text-gray-500">No branches match.</p>}
        </>
      )}
    </div>
  );
}

function BranchDetailPage() {
  const { id = '' } = useParams();
  const [branch, setBranch] = useState<SiteBranch | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    axios
      .get<SiteBranch>(`${API}/branches/${id}`)
      .then((r) => {
        setBranch(r.data);
        setPageTitle(r.data.name);
        setMetaDescription(`${r.data.name}, ${r.data.address}`);
        const tag = document.createElement('script');
        tag.type = 'application/ld+json';
        tag.id = 'branch-jsonld';
        tag.textContent = JSON.stringify(buildJsonLd(r.data as any));
        document.getElementById('branch-jsonld')?.remove();
        document.head.appendChild(tag);
      })
      .catch(() => setMissing(true));
    return () => document.getElementById('branch-jsonld')?.remove();
  }, [id]);

  if (missing) return <p className="text-red-600">Branch not found. <Link to="/branches" className="underline">See all branches</Link></p>;
  if (!branch) return <p className="text-gray-500">Loading…</p>;
  const week = getWeekHours(branch.operating_hours);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <h1 className="text-2xl font-bold text-brand-800">{branch.name}</h1>
        <p className="text-gray-600">{branch.address}</p>
        <HoursLine branch={branch} />
        <ContactButtons branch={branch as any} />
        <Link to={`/menu/${branch.id}`} className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">View this branch menu</Link>
      </div>
      {week && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Opening hours</h2>
          <ul className="text-sm space-y-1">
            {week.map((d) => (
              <li key={d.day} className="flex justify-between"><span className="capitalize">{d.day}</span><span>{d.open}–{d.close}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AllMenuPage() {
  return <MenuPage branchId={null} table={null} onBack={() => undefined} />;
}

function BranchMenuPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const table = params.get('table') && /^[\w-]{1,20}$/.test(params.get('table') as string) ? params.get('table') : null;
  return <MenuPage branchId={id} table={table} onBack={() => navigate('/branches')} />;
}

function FeedbackPage() {
  const { branches } = useBranches();
  const [branchId, setBranchId] = useState('');
  setPageTitle('Feedback');
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Share your feedback</h1>
      <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
        <option value="">Choose a branch</option>
        {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      {branchId ? <FeedbackForm branchId={branchId} /> : <p className="text-sm text-gray-500">Pick the branch you visited to leave a rating.</p>}
    </div>
  );
}

function LoyaltyPage() {
  const { stamps_target, reward_name } = useLoyaltyRules();
  setPageTitle('Rewards');
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-3xl md:text-4xl font-semibold text-brand-800">Rewards</h1>
      <p className="text-sm text-gray-600">
        Collect {stamps_target} stamps to earn: {reward_name}. Staff add a stamp when you order.
      </p>
      <LoyaltyCard />
    </div>
  );
}

function AboutPage() {
  setPageTitle('About');
  return (
    <div className="space-y-4 max-w-2xl bg-white rounded-xl p-6 shadow-sm">
      <h1 className="text-2xl font-bold">About Milestones Coffee</h1>
      <p className="text-gray-700">TODO: write the brand story for the owner to approve.</p>
      <p className="text-gray-700">TODO: values and what makes each branch special.</p>
    </div>
  );
}

function ContactPage() {
  const { branches } = useBranches();
  setPageTitle('Contact');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contact us</h1>
      <p className="text-sm text-gray-600">General email: TODO (owner to confirm)</p>
      <ul className="grid md:grid-cols-2 gap-4">
        {(branches ?? []).map((b) => (
          <li key={b.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            <p className="font-semibold">{b.name}</p>
            <p className="text-sm text-gray-600">{b.address}</p>
            <ContactButtons branch={b as any} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="branches/:id" element={<BranchDetailPage />} />
        <Route path="map" element={<Navigate to="/branches?view=map" replace />} />
        <Route path="offers" element={<Navigate to="/news" replace />} />
        <Route path="news" element={<WhatsNewPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="blog" element={<Navigate to="/news" replace />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="menu" element={<AllMenuPage />} />
        <Route path="menu/:id" element={<BranchMenuPage />} />
        <Route path="loyalty" element={<LoyaltyPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="rewards" element={<Navigate to="/loyalty" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
