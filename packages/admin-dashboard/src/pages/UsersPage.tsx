import { useEffect, useState, type FormEvent } from 'react';
import { api, type Me } from '../api';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: 'admin' | 'staff';
  permissions: string[];
  branch_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}
interface Branch {
  id: string;
  name: string;
}

// Sections a custom user can be given, grouped like the side menu.
const SECTIONS: { group: string; items: { key: string; label: string; hint: string; branch?: boolean }[] }[] = [
  {
    group: 'Live service',
    items: [
      { key: 'requests', label: 'Table requests', hint: 'See and close table calls', branch: true },
      { key: 'availability', label: 'Availability', hint: 'Mark items sold out', branch: true },
      { key: 'kitchen', label: 'Orders', hint: 'Table and pickup orders', branch: true },
    ],
  },
  {
    group: 'Customers',
    items: [
      { key: 'loyalty', label: 'Loyalty', hint: 'Stamp and redeem cards, coupons', branch: true },
      { key: 'gifts', label: 'Gift cards', hint: 'Activate, spend and sell', branch: true },
      { key: 'promotions', label: 'Offers', hint: 'Offers for their branch', branch: true },
      { key: 'business', label: 'Business accounts', hint: 'Companies and invoices' },
      { key: 'catering', label: 'Catering', hint: 'Catering requests' },
      { key: 'careers', label: 'Careers', hint: 'Job applications and CVs' },
      { key: 'dashboard', label: 'Insights', hint: 'Sales, analytics, feedback (all branches)' },
    ],
  },
  {
    group: 'Menu',
    items: [
      { key: 'products', label: 'Products', hint: 'Add and edit items and prices' },
      { key: 'categories', label: 'Categories', hint: 'Menu sections' },
      { key: 'menu-import', label: 'Menu import', hint: 'Excel / CSV import and export' },
    ],
  },
  {
    group: 'Setup',
    items: [
      { key: 'branches', label: 'Branches', hint: 'Branch details, hours, Ramadan mode' },
      { key: 'qr', label: 'QR codes', hint: 'Create and print QR codes' },
    ],
  },
];
const LABEL = Object.fromEntries(SECTIONS.flatMap((g) => g.items.map((i) => [i.key, i.label])));
const BRANCH_KEYS = SECTIONS.flatMap((g) => g.items.filter((i) => i.branch).map((i) => i.key));
const PRESETS: { name: string; keys: string[] }[] = [
  { name: 'Branch manager', keys: ['requests', 'availability', 'kitchen', 'loyalty', 'gifts', 'promotions'] },
  { name: 'Barista / counter', keys: ['requests', 'availability', 'kitchen', 'loyalty', 'gifts'] },
  { name: 'Kitchen only', keys: ['kitchen', 'availability'] },
  { name: 'Menu editor', keys: ['products', 'categories', 'menu-import', 'availability'] },
  { name: 'Marketing', keys: ['dashboard', 'business', 'catering'] },
];

interface Form {
  id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
  role: 'admin' | 'staff';
  permissions: string[];
  branch_id: string;
  status: 'active' | 'inactive';
}
const empty: Form = { email: '', first_name: '', last_name: '', phone: '', password: '', role: 'staff', permissions: [], branch_id: '', status: 'active' };

// Make a strong, readable password for a new user.
function suggestPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join('');
}

// Full admins: create users and choose exactly what each one can see.
export default function UsersPage({ token, me }: { token: string; me: Me }) {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    api<User[]>('/admin/users', token)
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    api<Branch[]>('/branches', token)
      .then(setBranches)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '';
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggle = (key: string) => setForm((f) => (f ? { ...f, permissions: f.permissions.includes(key) ? f.permissions.filter((x) => x !== key) : [...f.permissions, key] } : f));
  const needsBranch = form?.role === 'staff' && form.permissions.some((p) => BRANCH_KEYS.includes(p));
  const self = form?.id === me.id;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const body = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        ...(self ? {} : { role: form.role, status: form.status }),
        permissions: form.role === 'staff' ? form.permissions : undefined,
        branch_id: form.role === 'staff' ? form.branch_id || null : null,
        ...(form.password ? { password: form.password } : {}),
      };
      if (form.id) await api(`/admin/users/${form.id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/users', token, { method: 'POST', body: JSON.stringify(body) });
      await load();
      setMsg(form.id ? `Saved ${form.email}.` : `Created ${form.email}. Give them the password you set; they can sign in now.`);
      setForm(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(u: User, status: User['status']) {
    setError(null);
    setMsg(null);
    try {
      await api(`/admin/users/${u.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
      setMsg(status === 'active' ? `${u.email} can sign in again.` : `${u.email} is switched off and signed out everywhere.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Users & access</h2>
          <p className="text-sm text-gray-500">Full admins see everything, including this page. Custom users only see the sections you tick.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ ...empty, password: suggestPassword() });
            setMsg(null);
            setError(null);
          }}
          className="rounded bg-brand-600 px-4 py-2 font-semibold text-white"
        >
          + Add user
        </button>
      </div>
      {error && !form && <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {msg && (
        <p role="status" className="rounded bg-green-50 p-3 text-sm font-semibold text-green-800">
          {msg}
        </p>
      )}

      {form && (
        <form onSubmit={save} className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">{form.id ? `Edit ${form.email}` : 'New user'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              First name
              <input value={form.first_name} maxLength={60} onChange={(e) => set('first_name', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-700">
              Last name
              <input value={form.last_name} maxLength={60} onChange={(e) => set('last_name', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-700">
              Email (sign-in)
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-700">
              Mobile
              <input value={form.phone} maxLength={20} onChange={(e) => set('phone', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
            </label>
            <label className="text-sm text-gray-700 sm:col-span-2">
              {form.id ? 'New password (leave empty to keep the current one)' : 'Password (at least 10 characters)'}
              <span className="mt-1 flex gap-2">
                <input
                  value={form.password}
                  required={!form.id}
                  minLength={10}
                  onChange={(e) => set('password', e.target.value)}
                  className="block w-full rounded border border-gray-300 px-3 py-2 font-mono"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => set('password', suggestPassword())} className="whitespace-nowrap rounded border px-3 text-sm">
                  New strong password
                </button>
              </span>
            </label>
          </div>

          <fieldset disabled={self}>
            <legend className="text-sm font-semibold text-gray-800">Access</legend>
            {self && <p className="text-xs text-gray-500">You cannot change your own access.</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.role === 'admin' ? 'border-brand-600 ring-2 ring-brand-600' : ''}`}>
                <input type="radio" name="role" checked={form.role === 'admin'} onChange={() => set('role', 'admin')} />
                <span>
                  <span className="block font-semibold">Full admin</span>
                  <span className="text-sm text-gray-500">Everything, every branch, and can manage users.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.role === 'staff' ? 'border-brand-600 ring-2 ring-brand-600' : ''}`}>
                <input type="radio" name="role" checked={form.role === 'staff'} onChange={() => set('role', 'staff')} />
                <span>
                  <span className="block font-semibold">Custom access</span>
                  <span className="text-sm text-gray-500">Only the sections you choose below.</span>
                </span>
              </label>
            </div>

            {form.role === 'staff' && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-500">Quick start:</span>
                  {PRESETS.map((p) => (
                    <button key={p.name} type="button" onClick={() => set('permissions', p.keys)} className="rounded-full border px-3 py-1 hover:bg-gray-50">
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SECTIONS.map((g) => (
                    <div key={g.group}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{g.group}</p>
                      {g.items.map((i) => (
                        <label key={i.key} className="flex items-start gap-2 py-1 text-sm">
                          <input type="checkbox" checked={form.permissions.includes(i.key)} onChange={() => toggle(i.key)} className="mt-0.5 h-4 w-4" />
                          <span>
                            <span className="font-medium text-gray-800">{i.label}</span>
                            <span className="block text-xs text-gray-500">{i.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <label className="block text-sm text-gray-700">
                  Branch {needsBranch ? <span className="text-red-600">(needed for the live service and customer sections)</span> : <span className="text-gray-400">(optional)</span>}
                  <select required={needsBranch} value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 sm:w-80">
                    <option value="">— No branch —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-gray-500">Some actions stay with full admins even when a section is ticked: loyalty settings and point adjustments, push messages to all customers, cancelling gift cards and offer statistics.</p>
              </div>
            )}
          </fieldset>

          {error && <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create user'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded border px-4 py-2 font-semibold text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Access</th>
              <th className="px-4 py-2">Branch</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t align-top ${u.status !== 'active' ? 'text-gray-400' : ''}`}>
                <td className="px-4 py-2">
                  <span className="block font-semibold text-gray-900">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}</span>
                  <span className="text-xs">{u.email}</span>
                  {u.id === me.id && <span className="ml-1 text-xs text-gray-500">(you)</span>}
                </td>
                <td className="px-4 py-2">
                  {u.role === 'admin' ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">Full admin</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {u.permissions.map((p) => (
                        <span key={p} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {LABEL[p] ?? p}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{u.role === 'admin' ? 'All' : branchName(u.branch_id) || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-bold uppercase ${u.status === 'active' ? 'text-green-700' : 'text-gray-500'}`}>{u.status === 'active' ? 'Active' : 'Off'}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, phone: u.phone, password: '', role: u.role, permissions: u.permissions, branch_id: u.branch_id ?? '', status: u.status });
                      setMsg(null);
                      setError(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="font-semibold text-brand-700 underline"
                  >
                    Edit
                  </button>
                  {u.id !== me.id && (
                    <button type="button" onClick={() => setStatus(u, u.status === 'active' ? 'inactive' : 'active')} className="ml-3 font-semibold text-gray-600 underline">
                      {u.status === 'active' ? 'Switch off' : 'Switch on'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
