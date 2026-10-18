import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

export interface ServiceRequestRow {
  id: string;
  table: string;
  type: 'staff' | 'bill';
  status: 'open' | 'done';
  created_at: string;
  done_at: string | null;
}

type Lists = { open: ServiceRequestRow[]; done: ServiceRequestRow[] };

// Short two-tone chime so staff hear a new request from across the counter.
export function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.3);
    });
  } catch {
    /* audio blocked until the page is clicked once */
  }
}

// Polls the branch's table requests every 8 seconds. Used by the app shell so the tab badge updates on every tab.
export function useServiceRequests(token: string, branchId: string | null) {
  const [lists, setLists] = useState<Lists>({ open: [], done: [] });
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);

  async function load() {
    if (!branchId) return;
    try {
      const res = await api<Lists>(`/admin/service-requests?branch_id=${encodeURIComponent(branchId)}`, token);
      const ids = new Set(res.open.map((r) => r.id));
      if (seen.current && res.open.some((r) => !seen.current!.has(r.id))) chime();
      seen.current = ids;
      setLists(res);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    seen.current = null;
    setLists({ open: [], done: [] });
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId]);

  return { ...lists, error, reload: load };
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins === 0 ? 'just now' : `${mins} min ago`;
}

export default function RequestsPage({
  token,
  data,
  branches,
  branchId,
  onBranch,
}: {
  token: string;
  data: ReturnType<typeof useServiceRequests>;
  branches: { id: string; name: string }[];
  branchId: string | null;
  onBranch: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function done(id: string) {
    setBusy(id);
    setFailed(null);
    try {
      await api(`/admin/service-requests/${id}/done`, token, { method: 'PATCH' });
      await data.reload();
    } catch (err) {
      setFailed((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Table requests</h2>
        <p className="text-sm text-gray-500">Customers press Call staff or Ask for bill on the menu from their table QR. New requests chime; keep this tab open on the counter tablet.</p>
      </div>
      {branches.length > 1 && (
        <select value={branchId ?? ''} onChange={(e) => onBranch(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm" aria-label="Branch">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      {(failed || data.error) && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{failed || data.error}</p>}
      {data.open.length === 0 ? (
        <p className="bg-white rounded-xl border p-6 text-center text-gray-500">No open requests.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.open.map((r) => (
            <li key={r.id} className={`rounded-xl border-2 p-4 bg-white flex items-center justify-between gap-3 ${r.type === 'bill' ? 'border-amber-400' : 'border-brand-600'}`}>
              <div>
                <p className="text-2xl font-bold text-gray-900">Table {r.table}</p>
                <p className={`text-sm font-semibold ${r.type === 'bill' ? 'text-amber-700' : 'text-brand-700'}`}>{r.type === 'bill' ? 'Wants the bill' : 'Calling staff'}</p>
                <p className="text-xs text-gray-500">{ago(r.created_at)}</p>
              </div>
              <button type="button" onClick={() => done(r.id)} disabled={busy === r.id} className="bg-green-600 text-white rounded-lg px-4 py-3 font-semibold disabled:opacity-60">
                Done
              </button>
            </li>
          ))}
        </ul>
      )}
      {data.done.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2">Done in the last hour</p>
          <ul className="bg-white rounded-xl border divide-y text-sm">
            {data.done.map((r) => (
              <li key={r.id} className="px-4 py-2 flex justify-between text-gray-600">
                <span>
                  Table {r.table} · {r.type === 'bill' ? 'Bill' : 'Staff'}
                </span>
                <span>{r.done_at ? ago(r.done_at) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
