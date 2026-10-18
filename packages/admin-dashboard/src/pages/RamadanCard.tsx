import { useEffect, useState } from 'react';
import { api } from '../api';

interface Season {
  ramadan_enabled: boolean;
  ramadan_starts_on: string | null;
  ramadan_ends_on: string | null;
  greeting: string;
  note: string | null;
  featured_category_ids: string[] | null;
  active: boolean;
}

// Ramadan mode: greeting and Iftar & Suhoor picks on the website, and branches switch to their Ramadan hours.
export default function RamadanCard({ token, categories }: { token: string; categories: { id: string; name: string }[] }) {
  const [s, setS] = useState<Season | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Season>('/admin/season', token).then(setS).catch((e: Error) => setError(e.message));
  }, [token]);

  if (!s) return error ? <p className="text-red-600 text-sm">{error}</p> : null;
  const cats = s.featured_category_ids ?? [];

  async function save() {
    if (!s) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setS(await api<Season>('/admin/season', token, { method: 'PUT', body: JSON.stringify(s) }));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';
  return (
    <section className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800">
          🌙 Ramadan mode {s.active ? <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Live now</span> : s.ramadan_enabled ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Scheduled</span> : null}
        </h3>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={s.ramadan_enabled} onChange={(e) => setS({ ...s, ramadan_enabled: e.target.checked })} /> On
        </label>
      </div>
      <p className="text-sm text-gray-500">Between these dates the website shows your greeting and Iftar & Suhoor picks, and every branch with Ramadan hours (Branches → Edit) shows those hours, also for order-ahead pickup times.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-600">First day<input type="date" value={s.ramadan_starts_on ?? ''} onChange={(e) => setS({ ...s, ramadan_starts_on: e.target.value || null })} className={input} /></label>
        <label className="text-sm text-gray-600">Last day<input type="date" value={s.ramadan_ends_on ?? ''} onChange={(e) => setS({ ...s, ramadan_ends_on: e.target.value || null })} className={input} /></label>
        <label className="text-sm text-gray-600">Greeting<input maxLength={120} value={s.greeting} onChange={(e) => setS({ ...s, greeting: e.target.value })} className={input} /></label>
        <label className="text-sm text-gray-600">Note (optional)<input maxLength={300} placeholder="e.g. Pre-order suhoor boxes for pickup until 2am" value={s.note ?? ''} onChange={(e) => setS({ ...s, note: e.target.value || null })} className={input} /></label>
      </div>
      <div>
        <p className="mb-1 text-sm text-gray-600">Iftar & Suhoor picks — categories to feature</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = cats.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setS({ ...s, featured_category_ids: on ? cats.filter((x) => x !== c.id) : [...cats, c.id] })}
                className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 text-gray-700'}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? 'Saving…' : 'Save Ramadan settings'}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </section>
  );
}
