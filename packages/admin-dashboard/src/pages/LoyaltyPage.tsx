import { useState, type FormEvent } from 'react';
import { api } from '../api';

interface CardRow {
  phone: string;
  name: string | null;
  stamps: number;
  target: number;
  redeemed_count: number;
  created_at: string;
}

export default function LoyaltyPage({ token }: { token: string }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      const list = await api<CardRow[]>(`/admin/loyalty/cards?q=${encodeURIComponent(query.trim())}`, token);
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(path: 'stamp' | 'redeem', phone: string) {
    setBusy(phone + path);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ ok: boolean; message?: string; stamps?: number }>(`/admin/loyalty/${path}`, token, {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setNotice(path === 'stamp' ? `Stamp added. Now ${res.stamps} stamps.` : 'Reward redeemed. Card reset.');
      } else {
        setError(res.message ?? 'Could not update the card.');
      }
      await search();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Loyalty cards</h2>
        <p className="text-sm text-gray-500">Find a customer by name or phone number, then add a stamp or redeem a full card.</p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or phone"
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <button type="submit" disabled={!query.trim()} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">
          Search
        </button>
      </form>

      {notice && (
        <p className="bg-green-50 text-green-800 rounded p-3 text-sm flex justify-between">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
        </p>
      )}
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      {rows && rows.length === 0 && <p className="text-sm text-gray-500">No cards match that search.</p>}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Stamps</th>
                <th className="px-3 py-2">Redeemed</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const full = r.stamps >= r.target;
                return (
                  <tr key={r.phone} className="border-t">
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.phone}</td>
                    <td className="px-3 py-2">{r.stamps}/{r.target}</td>
                    <td className="px-3 py-2">{r.redeemed_count}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => act('stamp', r.phone)}
                        disabled={full || busy !== null}
                        className="border rounded px-2 py-1 font-semibold disabled:opacity-50"
                      >
                        +1 stamp
                      </button>
                      <button
                        type="button"
                        onClick={() => act('redeem', r.phone)}
                        disabled={!full || busy !== null}
                        className="bg-amber-600 text-white rounded px-2 py-1 font-semibold disabled:opacity-50"
                      >
                        Redeem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
