import { useEffect, useState } from 'react';
import { api, API } from '../api';

interface Application {
  id: string;
  role: 'barista' | 'shift_lead' | 'kitchen' | 'cashier' | 'other';
  name: string;
  phone: string;
  email: string | null;
  experience_years: number;
  message: string | null;
  cv_name: string | null;
  status: 'new' | 'shortlisted' | 'closed';
  created_at: string;
}

const ROLE: Record<Application['role'], string> = { barista: 'Barista', shift_lead: 'Shift lead', kitchen: 'Kitchen & bakery', cashier: 'Cashier & host', other: 'Other' };

// Job applications sent from the website's Careers page.
export default function CareersPage({ token }: { token: string }) {
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api<{ rows: Application[] }>('/admin/careers', token)
      .then((r) => setRows(r.rows))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function move(r: Application, status: Application['status']) {
    try {
      await api(`/admin/careers/${r.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // The CV needs the login token, so fetch it and hand the browser a temporary link.
  async function download(r: Application) {
    try {
      const res = await fetch(`${API}/admin/careers/${r.id}/cv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Could not download the CV');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = r.cv_name || 'cv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const shown = rows.filter((r) => filter === 'all' || r.status !== 'closed');
  const digits = (p: string) => p.replace(/\D/g, '');

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Applications from the Careers page. CVs are deleted automatically after six months.</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')} className="border border-gray-300 rounded px-3 py-2 text-sm" aria-label="Show">
          <option value="open">Open</option>
          <option value="all">All</option>
        </select>
      </div>
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}
      {shown.length === 0 && <p className="text-gray-500 text-sm">No applications yet.</p>}
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className={`bg-white rounded-lg shadow-sm p-4 ${r.status === 'new' ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-gray-900">
                {r.name} · {ROLE[r.role]} · {r.experience_years} yr{r.experience_years === 1 ? '' : 's'}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  r.status === 'new' ? 'bg-amber-100 text-amber-800' : r.status === 'shortlisted' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700">
              <a href={`tel:${r.phone}`} className="text-brand-700 underline">{r.phone}</a>
              {r.email && (
                <>
                  {' · '}
                  <a href={`mailto:${r.email}`} className="text-brand-700 underline">{r.email}</a>
                </>
              )}
            </p>
            {r.message && <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{r.message}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {r.cv_name && (
                <button type="button" onClick={() => download(r)} className="rounded border border-gray-300 px-3 py-1.5 font-semibold text-gray-700">
                  Download CV
                </button>
              )}
              <a href={`https://wa.me/${digits(r.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white">
                WhatsApp
              </a>
              {r.status === 'new' && (
                <button type="button" onClick={() => move(r, 'shortlisted')} className="rounded bg-brand-700 px-3 py-1.5 font-semibold text-white">
                  Shortlist
                </button>
              )}
              {r.status !== 'closed' && (
                <button type="button" onClick={() => move(r, 'closed')} className="rounded border border-gray-300 px-3 py-1.5 text-gray-600">
                  Close
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">Received {new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}</span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
