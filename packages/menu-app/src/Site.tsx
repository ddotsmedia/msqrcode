import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, Navigate, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FeedbackForm, LoyaltyCard, MenuPage, QRScannerPage } from './App';
import { ContactButtons } from './lib/ContactButtons';
import { getTodayHours, getWeekHours, isOpenNow } from './lib/hours';
import { buildJsonLd, setMetaDescription, setPageTitle } from './lib/seo';
import BranchMapPage from './BranchMapPage';
import GalleryPage from './GalleryPage';
import { BlogListPage, BlogPostPage } from './BlogPages';

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

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links: [string, string][] = [
    ['/', 'Home'],
    ['/branches', 'Branches'],
    ['/map', 'Map'],
    ['/gallery', 'Gallery'],
    ['/blog', 'News'],
    ['/menu', 'Menu'],
    ['/loyalty', 'Loyalty'],
    ['/feedback', 'Feedback'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ];
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-brand-800 text-lg">☕ Milestones Coffee</Link>
          <button
            type="button"
            className="md:hidden px-3 py-1 border rounded text-sm"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <nav className={`${menuOpen ? 'block' : 'hidden'} md:flex gap-4 absolute md:static left-0 right-0 top-full bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0`}>
            {links.map(([to, label]) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} className="block py-1 text-sm font-semibold text-gray-700 hover:text-brand-700">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-gray-500 py-6">© Milestones Coffee</footer>
    </div>
  );
}

function HomePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { branches } = useBranches();
  const [nearest, setNearest] = useState<{ branch: SiteBranch; km: number }[] | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Old QR codes point to /?branch=<id>&table=<n>: send them to the branch menu.
  const legacyBranch = params.get('branch');
  if (legacyBranch && /^[a-f0-9-]{8,}$/i.test(legacyBranch)) {
    const table = params.get('table');
    const safeTable = table && /^[\w-]{1,20}$/.test(table) ? `?table=${table}` : '';
    return <Navigate to={`/menu/${legacyBranch}${safeTable}`} replace />;
  }

  const openCount = useMemo(
    () => (branches ?? []).filter((b) => isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) === true).length,
    [branches],
  );

  function findNearest() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const list = (branches ?? [])
          .filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number')
          .map((b) => ({ branch: b, km: distanceKm(latitude, longitude, b.latitude as number, b.longitude as number) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 3);
        setNearest(list);
      },
      () => setNearest([]),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  useEffect(() => {
    setPageTitle('Milestones Coffee');
    setMetaDescription('Milestones Coffee menus, branches, opening hours and loyalty card.');
  }, []);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-brand-800">Milestones Coffee</h1>
        <p className="text-gray-600 mt-2">
          {branches ? `${openCount} of ${branches.length} branches open now` : 'Loading branches…'}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to="/menu" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">View menu</Link>
          <Link to="/branches" className="px-4 py-2 bg-gray-100 rounded-lg font-semibold">Find a branch</Link>
          <button type="button" onClick={findNearest} className="px-4 py-2 bg-gray-100 rounded-lg font-semibold">Nearest branch</button>
          <button type="button" onClick={() => setShowScanner((s) => !s)} className="px-4 py-2 bg-gray-100 rounded-lg font-semibold">
            {showScanner ? 'Close scanner' : 'Scan a branch QR'}
          </button>
        </div>
        {nearest && (
          <ul className="mt-4 space-y-2">
            {nearest.length === 0 && <li className="text-sm text-gray-600">Location not available.</li>}
            {nearest.map(({ branch, km }) => (
              <li key={branch.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                <span>
                  <strong>{branch.name}</strong> · {km.toFixed(1)} km
                </span>
                <Link to={`/branches/${branch.id}`} className="text-brand-700 font-semibold text-sm">Details</Link>
              </li>
            ))}
          </ul>
        )}
        {showScanner && (
          <div className="mt-4">
            <QRScannerPage
              onBranchDetected={(id, table) => navigate(`/menu/${id}${table ? `?table=${table}` : ''}`)}
            />
          </div>
        )}
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        <Link to="/loyalty" className="bg-white rounded-xl p-4 shadow-sm font-semibold">Loyalty card →</Link>
        <Link to="/feedback" className="bg-white rounded-xl p-4 shadow-sm font-semibold">Share feedback →</Link>
        <Link to="/contact" className="bg-white rounded-xl p-4 shadow-sm font-semibold">Contact us →</Link>
      </section>
    </div>
  );
}

function MapRoute() {
  const { branches } = useBranches();
  setPageTitle('Branch map');
  return <BranchMapPage branches={branches} />;
}

function BranchesPage() {
  const { branches, error } = useBranches();
  const [query, setQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  setPageTitle('Branches');

  const list = (branches ?? []).filter((b) => {
    if (query && !`${b.name} ${b.address}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (onlyOpen && isOpenNow(b.operating_hours, b.timezone || TZ, new Date()) !== true) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Our branches</h1>
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
  setPageTitle('Loyalty card');
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Loyalty card</h1>
      <p className="text-sm text-gray-600">Collect 10 stamps and your next drink is on us. Staff add a stamp when you order.</p>
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
        <Route path="map" element={<MapRoute />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="blog" element={<BlogListPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="menu" element={<AllMenuPage />} />
        <Route path="menu/:id" element={<BranchMenuPage />} />
        <Route path="loyalty" element={<LoyaltyPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
