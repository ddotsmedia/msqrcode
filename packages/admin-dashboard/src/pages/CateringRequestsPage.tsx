import { useEffect, useState } from 'react';
import { api } from '../api';

interface Req {
  id: string;
  kind: 'office' | 'event' | 'cart' | 'other';
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  event_date: string;
  guests: number;
  location: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

const KIND: Record<Req['kind'], string> = { office: 'Office coffee', event: 'Event / wedding', cart: 'Coffee cart', other: 'Other' };
const NEXT: Record<Req['status'], { to: Req['status']; label: string } | null> = {
  new: { to: 'contacted', label: 'Mark contacted' },
  contacted: { to: 'closed', label: 'Close' },
  closed: null,
};

// Catering and coffee-cart enquiries sent from the website's Catering page.
export default function CateringRequestsPage({ token }: { token: string }) {
  const [rows, setRows] = useState<Req[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api<{ rows: Req[] }>('/admin/catering', token)
      .then((r) => setRows(r.rows))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function move(r: Req, status: Req['status']) {
    try {
      await api(`/admin/catering/${r.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const shown = rows.filter((r) => filter === 'all' || r.status !== 'closed');
  const digits = (p: string) => p.replace(/\D/g, '');

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Requests from the Catering page on the website. Call the customer, then mark it contacted.</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')} className="border border-gray-300 rounded px-3 py-2 text-sm" aria-label="Show">
          <option value="open">Open</option>
          <option value="all">All</option>
        </select>
      </div>
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}
      {shown.length === 0 && <p className="text-gray-500 text-sm">No requests yet.</p>}
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className={`bg-white rounded-lg shadow-sm p-4 ${r.status === 'new' ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-gray-900">
                {KIND[r.kind]} · {r.guests} guests · {r.event_date}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === 'new' ? 'bg-amber-100 text-amber-800' : r.status === 'contacted' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700">
              {r.name}
              {r.company && ` · ${r.company}`} · <a href={`tel:${r.phone}`} className="text-brand-700 underline">{r.phone}</a>
              {r.email && (
                <>
                  {' · '}
                  <a href={`mailto:${r.email}`} className="text-brand-700 underline">{r.email}</a>
                </>
              )}
            </p>
            {r.location && <p className="text-sm text-gray-500">{r.location}</p>}
            {r.message && <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{r.message}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <a href={`https://wa.me/${digits(r.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white">
                WhatsApp
              </a>
              {NEXT[r.status] && (
                <button type="button" onClick={() => move(r, NEXT[r.status]!.to)} className="rounded bg-brand-700 px-3 py-1.5 font-semibold text-white">
                  {NEXT[r.status]!.label}
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
