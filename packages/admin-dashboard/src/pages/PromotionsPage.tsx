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
  discount_percent?: number | null;
  category_ids?: string[] | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY = { title: '', body: '', branch_id: '', starts_on: '', ends_on: '', happy: false, discount_percent: '20', start_time: '15:00', end_time: '17:00', days: [] as string[], category_ids: [] as string[] };

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

export default function PromotionsPage({ token }: { token: string }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    api<Promotion[]>('/admin/promotions', token).then(setItems).catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    api<BranchRow[]>('/admin/branches', token).then(setBranches).catch(() => undefined);
    api<{ id: string; name: string }[]>('/categories', token).then(setCategories).catch(() => undefined);
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
          ...(form.happy
            ? { discount_percent: Number(form.discount_percent), start_time: form.start_time || null, end_time: form.end_time || null, days: form.days, category_ids: form.category_ids }
            : {}),
        }),
      });
      setForm(EMPTY);
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

  const toggleIn = (key: 'days' | 'category_ids', v: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 text-gray-700'}`;
  const happyText = (p: Promotion) =>
    p.discount_percent
      ? [
          `−${p.discount_percent}%`,
          p.start_time || p.end_time ? `${p.start_time ?? '00:00'}–${p.end_time ?? '24:00'}` : 'all day',
          p.days?.filter(Boolean).length ? p.days.map((d) => DAYS[Number(d)]).join(', ') : 'every day',
          p.category_ids?.filter(Boolean).length ? p.category_ids.map((c) => categories.find((x) => x.id === c)?.name ?? '?').join(', ') : 'whole menu',
        ].join(' · ')
      : null;

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
        <label className="md:col-span-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={form.happy} onChange={(e) => setForm({ ...form, happy: e.target.checked })} />
          Happy hour price — take a % off the menu prices at set times (applies to table and pickup orders)
        </label>
        {form.happy && (
          <div className="md:col-span-2 grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-3">
            <label className="text-sm text-gray-600">% off<input type="number" min={1} max={90} required value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} className={inputClass} /></label>
            <label className="text-sm text-gray-600">From<input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={inputClass} /></label>
            <label className="text-sm text-gray-600">Until<input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={inputClass} /></label>
            <div className="md:col-span-3">
              <p className="mb-1 text-sm text-gray-600">Days (none = every day)</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" aria-pressed={form.days.includes(String(i))} onClick={() => toggleIn('days', String(i))} className={chip(form.days.includes(String(i)))}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <p className="mb-1 text-sm text-gray-600">Categories (none = whole menu)</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button key={c.id} type="button" aria-pressed={form.category_ids.includes(c.id)} onClick={() => toggleIn('category_ids', c.id)} className={chip(form.category_ids.includes(c.id))}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <button type="submit" disabled={saving} className="md:col-span-2 bg-brand-600 text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Add offer'}
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="bg-white rounded-lg shadow p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{p.title} {!p.is_active && <span className="text-xs text-gray-500">(hidden)</span>}</p>
              {happyText(p) && <p className="text-sm font-semibold text-amber-700">Happy hour {happyText(p)}</p>}
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
