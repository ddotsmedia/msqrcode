import { useEffect, useState, type FormEvent } from 'react';

const TOKEN_KEY = 'msq_admin_token';
const API = '/api';

interface Me {
  id: string;
  email: string;
  role: string;
  assigned_branch_id: string | null;
}

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

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: the session lasts until reload
  }
}

async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Milestones Admin</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 hidden sm:inline">{me.email}</span>
          <button onClick={onLogout} className="text-brand-700 font-semibold">
            Sign out
          </button>
        </div>
      </header>

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
