import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { BranchRow } from './BranchesPage';

interface Promotion {
  id: string;
  branch_id: string | null;
  title: string;
  body: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

export default function PromotionsPage({ token }: { token: string }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', branch_id: '', starts_on: '', ends_on: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    api<Promotion[]>('/admin/promotions', token).then(setItems).catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    api<BranchRow[]>('/admin/branches', token).then(setBranches).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/admin/promotions', token, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          branch_id: form.branch_id || null,
          starts_on: form.starts_on || null,
          ends_on: form.ends_on || null,
        }),
      });
      setForm({ title: '', body: '', branch_id: '', starts_on: '', ends_on: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Promotion) {
    try {
      await api(`/admin/promotions/${p.id}`, token, { method: 'PATCH', body: JSON.stringify({ is_active: !p.is_active }) });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? id : 'All branches');

  return (
    <main className="p-4 max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Offers</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={create} className="bg-white rounded-lg shadow p-4 grid gap-3 md:grid-cols-2">
        <input required maxLength={120} placeholder="Title (e.g. Free drink with breakfast)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
        <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className={inputClass}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <textarea maxLength={500} placeholder="Details (optional)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${inputClass} md:col-span-2`} rows={2} />
        <label className="text-sm text-gray-600">Starts on<input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className={inputClass} /></label>
        <label className="text-sm text-gray-600">Ends on<input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className={inputClass} /></label>
        <button type="submit" disabled={saving} className="md:col-span-2 bg-brand-600 text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Add offer'}
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="bg-white rounded-lg shadow p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{p.title} {!p.is_active && <span className="text-xs text-gray-500">(hidden)</span>}</p>
              <p className="text-xs text-gray-500">{branchName(p.branch_id)}{p.starts_on || p.ends_on ? ` · ${p.starts_on ?? ''} → ${p.ends_on ?? ''}` : ''}</p>
            </div>
            <button type="button" onClick={() => toggle(p)} className="text-sm border rounded px-3 py-1">
              {p.is_active ? 'Hide' : 'Show'}
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-gray-500 text-sm">No offers yet.</li>}
      </ul>
    </main>
  );
}
