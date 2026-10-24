import { useEffect, useState } from 'react';
import { api } from '../api';
import BranchSelect from './BranchSelect';

interface Shape {
  customers: number;
  returning: number;
  repeat_rate: number;
  avg_orders_returning: number;
  card_orders: number;
  completed_orders: number;
  card_share: number;
}
interface CustomersData {
  days: number;
  kpis: { current: Shape; previous: Shape };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Percentage-point change vs the previous period; null when there is nothing to compare.
function change(cur: number, prev: number): { text: string; up: boolean } | null {
  if (!prev && !cur) return null;
  const pts = Math.round((cur - prev) * 100);
  return { text: `${pts >= 0 ? '+' : ''}${pts} pts`, up: pts >= 0 };
}

function Kpi({ label, value, cur, prev, isRate }: { label: string; value: string; cur: number; prev: number; isRate?: boolean }) {
  const d = isRate ? change(cur, prev) : null;
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {d && <p className={`mt-1 text-xs font-medium ${d.up ? 'text-emerald-600' : 'text-red-600'}`}>{d.text} vs previous period</p>}
    </div>
  );
}

export default function CustomersPanel({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<CustomersData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    api<CustomersData>(`/analytics/customers?days=${days}${branch ? `&branch_id=${branch}` : ''}`, token)
      .then((d) => live && setData(d))
      .catch(() => live && setError('Could not load customer stats.'));
    return () => {
      live = false;
    };
  }, [days, branch, token]);

  const c = data?.kpis.current;
  const p = data?.kpis.previous;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Repeat customers</h2>
        <div className="flex items-center gap-2">
        <BranchSelect token={token} value={branch} onChange={setBranch} />
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
            >
              {d}d
            </button>
          ))}
        </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {data && c && p && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Repeat rate" value={pct(c.repeat_rate)} cur={c.repeat_rate} prev={p.repeat_rate} isRate />
            <Kpi label="Returning customers" value={`${c.returning} of ${c.customers}`} cur={c.returning} prev={p.returning} />
            <Kpi label="Avg orders (returning)" value={c.avg_orders_returning.toFixed(1)} cur={c.avg_orders_returning} prev={p.avg_orders_returning} />
            <Kpi label="Card-linked orders" value={pct(c.card_share)} cur={c.card_share} prev={p.card_share} isRate />
          </div>
          <p className="text-xs text-gray-500">
            Counts only loyalty-card orders. Guest orders are excluded because they cannot be matched to a customer.
          </p>
        </>
      )}
    </section>
  );
}
