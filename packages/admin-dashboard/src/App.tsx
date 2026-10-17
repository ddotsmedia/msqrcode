import { useEffect, useState, type FormEvent } from 'react';
import { api, readToken, saveToken, type Me } from './api';
import CategoriesPage from './pages/CategoriesPage';
import ProductsPage from './pages/ProductsPage';
import QrCodesPage from './pages/QrCodesPage';
import BranchesPage from './pages/BranchesPage';
import MenuImportPage from './pages/MenuImportPage';
import DashboardPage from './pages/DashboardPage';
import InsightsPage from './pages/InsightsPage';
import KitchenPage from './pages/KitchenPage';
import PromotionsPage from './pages/PromotionsPage';
import LoyaltyPage from './pages/LoyaltyPage';
import RequestsPage, { useServiceRequests } from './pages/RequestsPage';

type Tab = 'requests' | 'availability' | 'products' | 'categories' | 'qr' | 'branches' | 'menu-import' | 'dashboard' | 'kitchen' | 'promotions' | 'loyalty';

const TAB_LABELS: Record<Tab, string> = {
  requests: 'Table requests',
  availability: 'Availability',
  products: 'Products',
  categories: 'Categories',
  qr: 'QR codes',
  branches: 'Branches',
  'menu-import': 'Menu import',
  dashboard: 'Insights',
  kitchen: 'Kitchen',
  promotions: 'Offers',
  loyalty: 'Loyalty',
};

const ADMIN_ONLY: Tab[] = ['dashboard', 'promotions', 'menu-import', 'products', 'categories', 'qr', 'branches'];

const NAV: { group: string; tabs: Tab[] }[] = [
  { group: 'Overview', tabs: ['dashboard'] },
  { group: 'Live service', tabs: ['requests', 'availability', 'kitchen'] },
  { group: 'Customers', tabs: ['loyalty', 'promotions'] },
  { group: 'Menu', tabs: ['products', 'categories', 'menu-import'] },
  { group: 'Setup', tabs: ['branches', 'qr'] },
];

// Lucide icon paths
const TAB_ICONS: Record<Tab, string> = {
  dashboard: 'M3 3v18h18M7 16l4-4 3 3 5-6',
  requests: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  availability: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  kitchen: 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2',
  loyalty: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  promotions: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01',
  products: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
  categories: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  'menu-import': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  branches: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  qr: 'M4 3h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1M17 3h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1M4 16h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1M21 16h-3a2 2 0 0 0-2 2v3M12 7v3a2 2 0 0 1-2 2H7M16 12h1M12 21v-1',
};

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  base_price: number | string;
  status: string;
}

interface Availability {
  product_id: string;
  is_available: boolean;
  last_updated_at: string;
}

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ access_token: string }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLogin(res.access_token);
    } catch {
      setError('Email or password is incorrect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Milestones Admin</h1>
        <input
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-600 text-white rounded py-2 font-semibold disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ token, me, onLogout }: { token: string; me: Me; onLogout: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const requests = useServiceRequests(token, branchId);
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>('availability');
  const [menuOpen, setMenuOpen] = useState(false);

  const canEdit = me.role === 'admin' || me.role === 'branch_manager';

  useEffect(() => {
    api<Branch[]>('/branches', token)
      .then((list) => {
        const visible =
          me.role === 'branch_manager' && me.assigned_branch_id
            ? list.filter((b) => b.id === me.assigned_branch_id)
            : list;
        setBranches(visible);
        if (visible.length > 0) setBranchId(visible[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, [token, me]);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api<Product[]>('/products', token),
      api<Availability[]>(`/branches/${branchId}/products/availability`, token),
    ])
      .then(([prods, avail]) => {
        setProducts(prods);
        setAvailability(Object.fromEntries(avail.map((a) => [a.product_id, a.is_available])));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [branchId, token]);

  async function toggle(product: Product) {
    if (!branchId) return;
    const next = !(availability[product.id] ?? true);
    setPending((p) => ({ ...p, [product.id]: true }));
    setError(null);
    try {
      await api(`/branches/${branchId}/products/${product.id}/availability`, token, {
        method: 'PUT',
        body: JSON.stringify({ is_available: next }),
      });
      setAvailability((a) => ({ ...a, [product.id]: next }));
    } catch (e) {
      setError(`Could not update ${product.name}: ${(e as Error).message}`);
    } finally {
      setPending((p) => ({ ...p, [product.id]: false }));
    }
  }

  const isAdmin = me.role === 'admin';
  const go = (t: Tab) => {
    setTab(t);
    setMenuOpen(false);
  };
  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {NAV.map((g) => {
        const tabs = g.tabs.filter((t) => isAdmin || !ADMIN_ONLY.includes(t));
        if (!tabs.length) return null;
        return (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{g.group}</p>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => go(t)}
                aria-current={tab === t ? 'page' : undefined}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white/10 text-white' : 'text-brand-100 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-[18px] w-[18px] ${tab === t ? 'text-[#d9b88f]' : ''}`} aria-hidden="true">
                  <path d={TAB_ICONS[t]} />
                </svg>
                <span className="flex-1 text-left">{TAB_LABELS[t]}</span>
                {t === 'requests' && requests.open.length > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{requests.open.length}</span>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#a87a50] font-bold text-white">M</span>
          <div>
            <p className="font-semibold text-white leading-tight">Milestones</p>
            <p className="text-xs text-brand-300">Admin</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/10 px-6 py-4">
          <p className="truncate text-xs text-brand-300" title={me.email}>{me.email}</p>
          <button onClick={onLogout} className="mt-1 text-sm font-semibold text-white hover:text-[#d9b88f]">
            Sign out
          </button>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="lg:pl-64">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => setMenuOpen(true)} className="lg:hidden -ml-1 rounded-lg p-1.5 text-gray-700 hover:bg-gray-100" aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <h1 className="flex-1 text-lg font-semibold text-gray-800">{TAB_LABELS[tab]}</h1>
        {tab !== 'requests' && requests.open.length > 0 && (
          <button onClick={() => go('requests')} className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
            {requests.open.length} table request{requests.open.length === 1 ? '' : 's'}
          </button>
        )}
      </header>

      {tab === 'dashboard' && me.role === 'admin' && (
        <main className="max-w-6xl mx-auto p-4 space-y-6">
          <InsightsPage token={token} />
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Branch status</h2>
            <DashboardPage token={token} />
          </div>
        </main>
      )}
      {tab === 'promotions' && (
        <PromotionsPage token={token} />
      )}
      {tab === 'loyalty' && (
        <LoyaltyPage token={token} role={me.role} branchId={me.assigned_branch_id} />
      )}
      {tab === 'menu-import' && me.role === 'admin' && (
        <main className="max-w-3xl mx-auto p-4"><MenuImportPage token={token} /></main>
      )}
      {tab === 'products' && me.role === 'admin' && (
        <main className="max-w-3xl mx-auto p-4"><ProductsPage token={token} /></main>
      )}
      {tab === 'categories' && me.role === 'admin' && (
        <main className="max-w-3xl mx-auto p-4"><CategoriesPage token={token} /></main>
      )}
      {tab === 'qr' && me.role === 'admin' && (
        <main className="max-w-3xl mx-auto p-4"><QrCodesPage token={token} /></main>
      )}
      {tab === 'branches' && me.role === 'admin' && (
        <main className="max-w-3xl mx-auto p-4">
          <BranchesPage token={token} onQrCreated={() => undefined} />
        </main>
      )}

      {tab === 'requests' && (
        <main className="max-w-3xl mx-auto p-4"><RequestsPage token={token} data={requests} branches={branches} branchId={branchId} onBranch={setBranchId} /></main>
      )}

      {tab === 'kitchen' && branchId && (
        <main className="max-w-full p-0"><KitchenPage token={token} branchId={branchId} /></main>
      )}

      {tab === 'availability' && (
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <section className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="branch">
            Branch
          </label>
          <select
            id="branch"
            value={branchId ?? ''}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
          {!canEdit && <p className="text-sm text-gray-500 mt-2">Read-only access.</p>}
        </section>

        {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

        <section className="bg-white rounded-lg shadow-sm divide-y">
          <h2 className="px-4 py-3 font-semibold text-gray-800">Availability</h2>
          {loading && <p className="px-4 py-3 text-gray-500">Loading…</p>}
          {!loading && products.length === 0 && <p className="px-4 py-3 text-gray-500">No products.</p>}
          {products.map((p) => {
            const available = availability[p.id] ?? true;
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div>
                  <p className="font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.sku} · AED {Number(p.base_price).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit || pending[p.id]}
                  onClick={() => toggle(p)}
                  aria-pressed={available}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold min-w-[7rem] disabled:opacity-60 ${
                    available ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {pending[p.id] ? 'Saving…' : available ? 'Available' : 'Sold out'}
                </button>
              </div>
            );
          })}
        </section>
      </main>
      )}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(readToken());
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    setChecking(true);
    api<Me>('/auth/me', token)
      .then(setMe)
      .catch(() => {
        saveToken(null);
        setToken(null);
      })
      .finally(() => setChecking(false));
  }, [token]);

  function handleLogin(newToken: string) {
    saveToken(newToken);
    setToken(newToken);
  }

  function handleLogout() {
    saveToken(null);
    setToken(null);
    setMe(null);
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;
  if (checking || !me) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  return <Dashboard token={token} me={me} onLogout={handleLogout} />;
}
