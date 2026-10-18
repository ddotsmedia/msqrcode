import { useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import { animate, motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FeedbackForm, LoyaltyCard, MenuPage, QRScannerPage } from './App';
import { ContactButtons } from './lib/ContactButtons';
import { Icon } from './lib/Icon';
import { getTodayHours, getWeekHours, isOpenNow } from './lib/hours';
import { buildJsonLd, setMetaDescription, setPageTitle } from './lib/seo';
import BranchMapPage from './BranchMapPage';
import OffersPage from './OffersPage';
import GalleryPage from './GalleryPage';
import { BlogListPage, BlogPostPage } from './BlogPages';
import FaqPage from './FaqPage';
import InstallButton from './InstallButton';
import CateringPage from './CateringPage';
import DrinkQuiz from './DrinkQuiz';
import CareersPage from './CareersPage';
import { BrewGuidePage, BrewGuidesPage } from './BrewGuides';
import { Crescent, useRamadan } from './lib/season';
import { AMENITIES, amenityList } from './lib/amenities';

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
  pickup_enabled?: boolean;
  ramadan?: boolean; // the API swapped in Ramadan hours
  amenities?: string[] | null;
}

function Amenities({ list }: { list?: string[] | null }) {
  const keys = amenityList(list);
  if (!keys.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Amenities">
      {keys.map((k) => (
        <li key={k} className="rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-brand-900">
          <span aria-hidden="true">{AMENITIES[k].icon}</span> {AMENITIES[k].label}
        </li>
      ))}
    </ul>
  );
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
      {today && <span className="text-gray-600"> · {branch.ramadan ? 'Ramadan hours' : 'Today'} {today.open}–{today.close}</span>}
    </span>
  );
}

const NAV: [string, string][] = [
  ['/', 'Home'],
  ['/menu', 'Menu'],
  ['/branches', 'Branches'],
  ['/loyalty', 'Rewards'],
  ['/offers', 'Offers'],
];
const MORE: [string, string][] = [
  ['/news', "What's New"],
  ['/find-your-drink', 'Find your drink'],
  ['/brew', 'Brew guides'],
  ['/catering', 'Catering'],
  ['/careers', 'Careers'],
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
      <p className="text-xs font-semibold tracking-[0.14em] uppercase text-copper-300 mb-4">{title}</p>
      <ul className="space-y-3">
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

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Milestones Coffee home">
      <img src="/logo/logo-512.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
      <span className="leading-none">
        <span className={`block font-display text-[22px] font-semibold ${dark ? 'text-white' : 'text-brand-700'}`}>Milestones</span>
        <span className="block mt-1 text-[10px] font-semibold tracking-[0.18em] text-copper-500">COFFEE · ABU DHABI</span>
      </span>
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-brand-900 text-brand-100 text-[15px] pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-10 grid gap-10 grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo dark />
          <p className="mt-4 max-w-xs text-brand-300 leading-relaxed">Specialty coffee and fresh bakes across Abu Dhabi.</p>
          {SOCIAL.length > 0 && (
            <div className="mt-4 flex gap-3">
              {SOCIAL.map(([label, href]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-brand-500 px-3 py-1.5 text-copper-300 hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Explore" links={[['/menu', 'Menu'], ['/offers', 'Offers'], ['/find-your-drink', 'Find your drink'], ['/branches', 'Branches'], ['/brew', 'Brew guides'], ['/gallery', 'Gallery'], ['/news', "What's New"]]} />
        <FooterCol title="Rewards" links={[['/loyalty', 'My card'], ['/scan', 'Scan a QR'], ['/faq', 'FAQ']]} />
        <FooterCol title="Company" links={[['/about', 'About'], ['/catering', 'Catering'], ['/careers', 'Careers'], ['/contact', 'Contact'], ['/feedback', 'Feedback']]} />
      </div>
      <div className="max-w-6xl mx-auto px-4 border-t border-brand-700 py-6 flex justify-between text-[13px] text-brand-300">
        <span>© {new Date().getFullYear()} Milestones Coffee</span>
        <span>coffeesales.ae</span>
      </div>
    </footer>
  );
}

function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMoreOpen(false), [pathname]);
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));
  const isHome = pathname === '/';
  const tabClass = (on: boolean) =>
    `px-4 py-2 rounded-full text-[15px] ${on ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 font-medium hover:text-brand-700'}`;
  const barItems: [string, string, string][] = [
    ['/', 'Home', 'home'],
    ['/menu', 'Menu', 'book'],
    ['/scan', 'Scan', 'qr'],
    ['/branches', 'Branches', 'pin'],
    ['/loyalty', 'Rewards', 'gift'],
  ];

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-white/95 backdrop-blur border-b border-brand-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
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
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-brand-100 bg-white text-brand-800 shadow-lg py-2">
                  {MORE.map(([to, label]) => (
                    <Link key={to} to={to} className="block px-4 py-2 text-sm hover:bg-cream">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="flex items-center gap-2">
            <InstallButton />
            <Link to="/scan" className="hidden sm:inline-flex items-center gap-2 rounded-full bg-copper-700 hover:bg-copper-500 px-5 py-2.5 text-[15px] font-semibold text-white">
              <Icon name="qr" className="h-4 w-4" /> Scan table QR
            </Link>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-label="Open menu"
              className="lg:hidden grid h-10 w-10 place-items-center rounded-full border border-brand-100 text-brand-700"
            >
              <Icon name={moreOpen ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
      </header>

      <main className={isHome ? 'flex-1 w-full' : 'flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8'}>
        <Outlet />
      </main>

      <SiteFooter />

      {moreOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[72px] z-40 bg-white border-b border-brand-100 shadow-lg p-2">
          {[...NAV.slice(4), ...MORE].map(([to, label]) => (
            <Link key={to} to={to} className="block px-4 py-3 text-brand-800 font-medium rounded-xl hover:bg-cream">
              {label}
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[68px] bg-white border-t border-brand-100 grid grid-cols-5 items-center">
        {barItems.map(([to, label, icon]) =>
          to === '/scan' ? (
            <Link key={to} to={to} aria-label="Scan QR" className="justify-self-center -mt-6 grid h-14 w-14 place-items-center rounded-full bg-copper-700 text-white shadow-[0_6px_14px_rgba(138,95,56,0.4)]">
              <Icon name={icon} className="h-6 w-6" />
            </Link>
          ) : (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 text-[11px] ${active(to) ? 'text-brand-700 font-semibold' : 'text-slate-500 font-medium'}`}
            >
              <Icon name={icon} className="h-[22px] w-[22px]" />
              {label}
            </Link>
          ),
        )}
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
  is_seasonal?: boolean;
  category_id?: string;
  display_order?: number;
}

const PHOTO_GRADIENTS = [
  'from-[#d9b88f] to-[#8a5f38]',
  'from-[#e8cfa8] to-[#a87a50]',
  'from-[#caa27a] to-[#5e3b22]',
  'from-[#f0e0c8] to-[#b8864a]',
];

// Fades and lifts a block into view once. Does nothing when reduced motion is on.
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, to, cta }: { eyebrow: string; title: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-copper-700">{eyebrow}</p>
        <h2 className="mt-2 text-3xl md:text-[44px] leading-tight tracking-tight text-brand-900">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-100 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:border-brand-300">
          {cta} <Icon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// Home page product row: bestsellers, or (pick="seasonal") the limited-time items — hidden when there are none.
function FeaturedMenu({ pick = 'popular', categoryIds = [] }: { pick?: 'popular' | 'seasonal' | 'ramadan'; categoryIds?: string[] }) {
  const [items, setItems] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/products`)
      .then((res) => {
        if (cancelled || !Array.isArray(res.data)) return;
        const active = (res.data as FeaturedProduct[]).filter((p) => p.status === 'active');
        const byOrder = (a: FeaturedProduct, b: FeaturedProduct) => (a.display_order ?? 0) - (b.display_order ?? 0);
        if (pick === 'seasonal') return setItems(active.filter((p) => p.is_seasonal).sort(byOrder).slice(0, 4));
        if (pick === 'ramadan') return setItems(active.filter((p) => categoryIds.includes(p.category_id ?? '')).sort(byOrder).slice(0, 4));
        const popular = active.filter((p) => p.is_popular);
        setItems((popular.length ? popular : active).sort(byOrder).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pick, categoryIds.join()]);

  if (items.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4">
        {pick === 'ramadan' ? (
          <SectionHead eyebrow="Ramadan" title="Iftar & Suhoor picks" to="/menu" cta="See full menu" />
        ) : pick === 'seasonal' ? (
          <SectionHead eyebrow="Limited time" title="New this season" to="/menu" cta="See full menu" />
        ) : (
          <SectionHead eyebrow="Customer favourites" title="Loved by our regulars" to="/menu" cta="See full menu" />
        )}
        <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {items.map((p, i) => (
            <li key={p.id} className="h-full">
              <Reveal delay={i * 0.08} className="h-full">
                <Link to="/menu" className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-brand-100 bg-white shadow-[0_8px_24px_rgba(10,26,51,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,26,51,0.12)]">
                  <div className={`relative aspect-[4/3] bg-gradient-to-br ${PHOTO_GRADIENTS[i % 4]}`}>
                    {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col p-3 sm:p-5">
                    {pick === 'ramadan' ? (
                      <span className="self-start rounded-full bg-brand-700 px-2.5 py-1 text-xs font-semibold text-copper-300">Iftar & Suhoor</span>
                    ) : pick === 'seasonal' ? (
                      <span className="self-start rounded-full bg-copper-500 px-2.5 py-1 text-xs font-semibold text-white">Limited time</span>
                    ) : (
                      p.is_popular && <span className="self-start rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500">Bestseller</span>
                    )}
                    <p className="mt-2 font-display text-base sm:text-xl text-brand-900">{p.name}</p>
                    {p.description && <p className="mt-1 text-xs sm:text-sm text-slate-600 line-clamp-2">{p.description}</p>}
                    <p className="mt-auto pt-3 font-semibold text-brand-700">AED {Number(p.base_price).toFixed(2).replace(/\.00$/, '')}</p>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
        <Link to="/menu" className="sm:hidden mt-6 flex items-center justify-center gap-2 rounded-full border border-brand-100 bg-white px-5 py-3 text-sm font-semibold text-brand-700">
          See full menu <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// Ramadan greeting band on the home page (only while Ramadan mode is on).
function RamadanBand() {
  const r = useRamadan();
  if (!r) return null;
  return (
    <>
      <section className="pt-10 md:pt-14">
        <Reveal className="max-w-6xl mx-auto px-4">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-900 to-brand-700 px-7 py-9 text-white md:flex md:items-center md:justify-between md:gap-8 md:px-14">
            <div className="flex items-start gap-4">
              <Crescent className="h-12 w-12 shrink-0 text-copper-300" />
              <div>
                <h2 className="font-display text-3xl tracking-tight md:text-4xl">{r.greeting}</h2>
                <p className="mt-2 text-brand-100 md:text-lg">{r.note || 'Our branches are open on Ramadan hours. Order ahead for iftar and suhoor.'}</p>
              </div>
            </div>
            <Link to="/branches" className="mt-6 inline-flex shrink-0 rounded-full bg-copper-500 px-6 py-3.5 font-semibold hover:bg-copper-700 md:mt-0">
              Ramadan hours & order ahead
            </Link>
          </div>
        </Reveal>
      </section>
      {r.featured_category_ids.length > 0 && <FeaturedMenu pick="ramadan" categoryIds={r.featured_category_ids} />}
    </>
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
    <section className="pb-16 md:pb-24">
      <Reveal className="max-w-6xl mx-auto px-4">
        <div className="rounded-[28px] bg-gradient-to-r from-copper-500 to-[#7a5230] px-7 py-9 md:px-14 md:py-11 text-white md:flex md:items-center md:justify-between gap-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cream/90">Offer{offer.ends_on ? ` · until ${offer.ends_on}` : ''}</p>
            <h2 className="mt-2 text-3xl md:text-4xl tracking-tight">{offer.title}</h2>
            {offer.body && <p className="mt-2 text-cream/90 md:text-lg">{offer.body}</p>}
          </div>
          <Link to="/offers" className="mt-6 md:mt-0 inline-flex shrink-0 rounded-full bg-brand-700 hover:bg-brand-900 px-6 py-3.5 font-semibold">
            All offers
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function StampGrid({ target, filled }: { target: number; filled: number }) {
  const n = Math.min(target, 15);
  return (
    <div className="grid grid-cols-5 gap-3" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const last = i === n - 1;
        return (
          <span
            key={i}
            className={`aspect-square rounded-full grid place-items-center ${
              i < filled ? 'bg-copper-500 text-white' : last ? 'bg-brand-700 text-copper-300' : 'border-2 border-dashed border-brand-100 bg-white'
            }`}
          >
            {i < filled ? <Icon name="coffee" className="h-1/2 w-1/2" /> : last ? <Icon name="gift" className="h-1/2 w-1/2" /> : null}
          </span>
        );
      })}
    </div>
  );
}

function LoyaltyBand() {
  const { stamps_target, reward_name } = useLoyaltyRules();
  const demo = Math.max(0, Math.min(stamps_target - 3, 7));
  const perks = ['Your card lives in your browser — add it to your home screen', 'Bonus stamp in your birthday week', 'Invite a friend and you both get a stamp'];
  return (
    <section className="bg-brand-700 text-white py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 grid gap-12 md:grid-cols-[1fr_440px] md:items-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-copper-300">Milestones Rewards</p>
          <h2 className="mt-4 text-4xl md:text-[46px] leading-[1.1] tracking-tight">
            {stamps_target} stamps. {reward_name}.<br />
            No app needed.
          </h2>
          <ul className="mt-6 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-brand-100 md:text-lg">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-copper-500">
                  <Icon name="check" className="h-3.5 w-3.5 text-white" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/loyalty" className="rounded-full bg-copper-700 hover:bg-copper-500 px-6 py-3.5 font-semibold">
              Join free
            </Link>
            <Link to="/faq" className="rounded-full bg-white px-6 py-3.5 font-semibold text-brand-700 hover:bg-brand-50">
              How it works
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="rounded-[28px] bg-cream p-7 md:p-8 text-brand-900 shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl">Your card</p>
                <p className="text-sm text-slate-600">Reward: {reward_name}</p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-100 bg-white text-brand-700">
                <Icon name="qr" className="h-9 w-9" />
              </span>
            </div>
            <div className="mt-6">
              <StampGrid target={stamps_target} filled={demo} />
            </div>
            <div className="mt-6 h-2 rounded-full bg-brand-100">
              <div className="h-2 rounded-full bg-copper-500" style={{ width: `${(demo / stamps_target) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm font-medium text-brand-700">
              Example: {demo} of {stamps_target} · {stamps_target - demo} more to go
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function BranchCard({ b, km }: { b: SiteBranch; km: number | null }) {
  const open = isOpenNow(b.operating_hours, b.timezone || TZ, new Date());
  const today = getTodayHours(b.operating_hours, b.timezone || TZ, new Date());
  const maps = b.google_maps_url || (typeof b.latitude === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}` : null);
  return (
    <div className="flex h-full flex-col rounded-[20px] border border-brand-100 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/branches/${b.id}`} className="font-display text-xl text-brand-900 hover:underline">
          {b.name}
        </Link>
        {open !== null && (
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${open ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-green-600' : 'bg-slate-400'}`} />
            {open ? 'Open now' : 'Closed'}
          </span>
        )}
      </div>
      <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
        <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-copper-500" />
        <span>
          {b.address}
          {km !== null && ` · ${km.toFixed(1)} km`}
        </span>
      </p>
      {today && (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <Icon name="clock" className="h-4 w-4 shrink-0 text-copper-500" />
          {b.ramadan ? 'Ramadan hours' : 'Today'} {today.open}–{today.close}
        </p>
      )}
      <div className="mt-auto pt-5 flex gap-2.5">
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand-700 hover:bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white">
            Directions
          </a>
        )}
        {b.phone && (
          <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="rounded-full border border-brand-100 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:border-brand-300">
            Call
          </a>
        )}
        {!maps && !b.phone && (
          <Link to={`/branches/${b.id}`} className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white">
            Details
          </Link>
        )}
      </div>
    </div>
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
  const quick: [string, string, string, string, string][] = [
    ['/menu', 'Menu', 'Coffee, bakery & desserts', 'Browse', 'coffee'],
    ['/branches', 'Branches', 'Find the nearest café', 'Get directions', 'pin'],
    ['/loyalty', 'Rewards', `${rules.stamps_target} stamps: ${rules.reward_name}`, 'Join free', 'gift'],
    ['/scan', 'Scan table QR', 'Open your table’s menu', 'Open scanner', 'qr'],
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 to-brand-600 text-white">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-28 grid gap-12 md:grid-cols-[1fr_minmax(0,500px)] md:items-center">
          <div>
            {branches && branches.length > 0 && (
              <motion.p
                className="inline-flex items-center gap-2 rounded-full border border-copper-300/40 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-copper-300"
                {...fade(0)}
              >
                <span className={`h-2 w-2 rounded-full ${openCount ? 'bg-green-400' : 'bg-slate-400'}`} />
                <CountUp to={openCount} /> of {branches.length} branches open now
              </motion.p>
            )}
            <motion.h1 className="mt-6 text-5xl md:text-[76px] leading-[1.02] tracking-tight" {...fade(0.1)}>
              Every cup,
              <br />
              <em className="text-copper-300">a milestone.</em>
            </motion.h1>
            <motion.p className="mt-6 max-w-lg text-lg md:text-xl leading-relaxed text-brand-100" {...fade(0.2)}>
              Specialty coffee, fresh bakes every morning, and a rewards card that lives on your phone.
            </motion.p>
            <motion.div className="mt-8 flex flex-wrap gap-3" {...fade(0.3)}>
              <Link to="/menu" className="rounded-full bg-copper-700 hover:bg-copper-500 px-6 py-3.5 font-semibold">
                Explore the menu
              </Link>
              <Link to="/branches" className="rounded-full bg-white px-6 py-3.5 font-semibold text-brand-700 hover:bg-brand-50">
                Find a branch
              </Link>
            </motion.div>
          </div>
          <motion.div
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            <div className="relative ml-auto aspect-[25/27] w-full max-w-[460px] overflow-hidden rounded-[36px] bg-gradient-to-br from-copper-300 via-copper-500 to-[#4a3020]">
              {HERO_IMAGE ? (
                <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <img src="/logo/logo-512.png" alt="" width={160} height={160} className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 shadow-2xl" />
              )}
            </div>
            <motion.div
              className="absolute -bottom-6 left-0 md:-left-6 rounded-[20px] bg-white p-4 md:p-5 text-brand-900 shadow-[0_24px_48px_rgba(5,15,36,0.35)]"
              animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="gift" className="h-5 w-5 text-copper-500" /> Milestones Rewards
              </p>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {Array.from({ length: Math.min(rules.stamps_target, 10) }, (_, i) => (
                  <span key={i} className={`h-4 w-4 rounded-full border-[1.5px] ${i < 7 ? 'border-copper-500 bg-copper-500' : 'border-brand-100'}`} />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {rules.stamps_target} stamps = {rules.reward_name}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {quick.map(([to, title, sub, cta, icon], i) => (
            <Reveal key={to} delay={i * 0.06}>
              <Link
                to={to}
                className="flex h-full flex-col rounded-[20px] border border-brand-100 bg-white p-4 md:p-6 shadow-[0_8px_24px_rgba(10,26,51,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,26,51,0.12)]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-brand-50 text-brand-700">
                  <Icon name={icon} className="h-[22px] w-[22px]" />
                </span>
                <p className="mt-4 font-display text-lg text-brand-900">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{sub}</p>
                <p className="mt-auto pt-3 flex items-center gap-1.5 text-sm font-semibold text-copper-700">
                  {cta} <Icon name="arrow" className="h-4 w-4" />
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <RamadanBand />
      <FeaturedMenu pick="seasonal" />
      <FeaturedMenu />
      <OfferBand />
      <LoyaltyBand />

      {nearest.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-copper-700">Visit us</p>
                <h2 className="mt-2 text-3xl md:text-[44px] leading-tight tracking-tight text-brand-900">{coords ? 'Nearest to you' : 'Our branches'}</h2>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {!coords && (
                  <button type="button" onClick={locate} className="inline-flex items-center gap-2 rounded-full bg-copper-700 hover:bg-copper-500 px-4 py-2.5 text-sm font-semibold text-white">
                    <Icon name="nav" className="h-4 w-4" /> Near me
                  </button>
                )}
                <Link to="/branches?view=map" className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:border-brand-300">
                  Map <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {nearest.map(({ b, km }, i) => (
                <Reveal key={b.id} delay={i * 0.08} className="h-full">
                  <BranchCard b={b} km={km} />
                </Reveal>
              ))}
            </div>
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
      <Link to="/offers" className="flex items-center justify-between gap-4 rounded-[20px] bg-gradient-to-r from-copper-500 to-[#7a5230] px-6 py-5 text-white">
        <span>
          <span className="block font-display text-2xl">Offers & happy hours</span>
          <span className="text-cream/90">Live deals, the weekly schedule and your rewards.</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand-700 px-5 py-2.5 font-semibold">See offers →</span>
      </Link>
      <BlogListPage />
    </div>
  );
}

function BranchesPage() {
  const { branches, error } = useBranches();
  const [query, setQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [need, setNeed] = useState<string[]>([]);
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'list';
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [waits, setWaits] = useState<Record<string, number>>({});
  setPageTitle('Find a Branch');

  // Order-ahead branches: show the current wait so customers can pick the quickest.
  useEffect(() => {
    (branches ?? [])
      .filter((b) => b.pickup_enabled)
      .forEach((b) =>
        axios
          .get(`${API}/orders/wait`, { params: { branch_id: b.id } })
          .then((r) => setWaits((w) => ({ ...w, [b.id]: Number(r.data?.minutes) })))
          .catch(() => undefined),
      );
  }, [branches]);

  function locate() {
    if (!navigator.geolocation) return setLocating('denied');
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating('idle');
      },
      () => setLocating('denied'),
      { timeout: 8000 },
    );
  }

  const kmTo = (b: SiteBranch) =>
    coords && typeof b.latitude === 'number' && typeof b.longitude === 'number' ? distanceKm(coords.lat, coords.lng, b.latitude, b.longitude) : null;
  const list = (branches ?? [])
    .filter((b) => {
      if (query && !`${b.name} ${b.address}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (onlyOpen && isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) !== true) return false;
      if (need.some((a) => !amenityList(b.amenities).includes(a))) return false;
      return true;
    })
    .sort((a, b) => (kmTo(a) ?? Infinity) - (kmTo(b) ?? Infinity));
  // Only offer filters for amenities at least one branch has.
  const offered = Object.keys(AMENITIES).filter((k) => (branches ?? []).some((b) => amenityList(b.amenities).includes(k)));

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
        <button
          type="button"
          onClick={locate}
          disabled={locating === 'busy'}
          aria-pressed={!!coords}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${coords ? 'bg-brand-700 text-white' : 'border border-brand-100 bg-white text-brand-700'}`}
        >
          <Icon name="nav" className="h-4 w-4" />
          {locating === 'busy' ? 'Finding you…' : coords ? 'Nearest first' : 'Near me'}
        </button>
      </div>
      {offered.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by amenity">
          {offered.map((k) => {
            const on = need.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setNeed(on ? need.filter((x) => x !== k) : [...need, k])}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${on ? 'bg-brand-700 text-white' : 'border border-brand-100 bg-white text-brand-800'}`}
              >
                <span aria-hidden="true">{AMENITIES[k].icon}</span> {AMENITIES[k].label}
              </button>
            );
          })}
        </div>
      )}
      {locating === 'denied' && <p className="text-sm text-slate-500">Location is off, so branches are shown in the usual order.</p>}
      {error && <p className="text-red-600">Could not load branches. Try again later.</p>}
      {!branches && !error && <p className="text-gray-500">Loading…</p>}
      <ul className="grid md:grid-cols-2 gap-4">
        {list.map((b) => (
          <li key={b.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            <Link to={`/branches/${b.id}`} className="text-lg font-bold text-brand-800">{b.name}</Link>
            <p className="text-sm text-gray-600">
              {b.address}
              {kmTo(b) !== null && <span className="font-semibold text-brand-700"> · {kmTo(b)!.toFixed(1)} km</span>}
            </p>
            <HoursLine branch={b} />
            <Amenities list={b.amenities} />
            <ContactButtons branch={b as any} />
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/menu/${b.id}`} className="inline-block text-sm font-semibold text-brand-700">View menu →</Link>
              {b.pickup_enabled && isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) !== false && (
                <Link to={`/menu/${b.id}`} className="rounded-full bg-copper-500 px-3 py-1 text-xs font-semibold text-white hover:bg-copper-700">
                  Order ahead{waits[b.id] ? ` · ready in ~${waits[b.id]} min` : ''}
                </Link>
              )}
            </div>
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
        <Amenities list={branch.amenities} />
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
        <Route path="offers" element={<OffersPage />} />
        <Route path="news" element={<WhatsNewPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="blog" element={<Navigate to="/news" replace />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="catering" element={<CateringPage />} />
        <Route path="find-your-drink" element={<DrinkQuiz />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="brew" element={<BrewGuidesPage />} />
        <Route path="brew/:slug" element={<BrewGuidePage />} />
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
