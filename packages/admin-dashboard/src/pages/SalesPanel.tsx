import { useEffect, useState } from 'react';
import { api } from '../api';
import BranchSelect from './BranchSelect';

interface Kpi {
  revenue: number;
  completed: number;
  cancelled: number;
  open: number;
  average_order_value: number;
}
interface SalesData {
  days: number;
  kpis: { current: Kpi; previous: Kpi };
  daily: { day: string; orders: number; revenue: number }[];
  branches: { id: string; name: string; orders: number; revenue: number }[];
  types: { type: 'pickup' | 'dine_in'; orders: number; revenue: number }[];
}

const TYPE_LABEL: Record<string, string> = { pickup: 'Pickup', dine_in: 'Dine-in' };
const money = (v: number) => `AED ${v.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

// Percent change vs the previous period; null when there is nothing to compare.
function delta(cur: number, prev: number): { text: string; up: boolean } | null {
  if (!prev) return cur ? { text: 'new', up: true } : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, up: pct >= 0 };
}

function Kpi({ label, value, cur, prev }: { label: string; value: string; cur: number; prev: number }) {
  const d = delta(cur, prev);
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {d && <p className={`mt-1 text-xs font-medium ${d.up ? 'text-emerald-600' : 'text-red-600'}`}>{d.text} vs previous period</p>}
    </div>
  );
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadSalesCsv(data: SalesData) {
  const lines: string[] = [];
  const add = (title: string, head: string[], rows: unknown[][]) => {
    lines.push(title, head.join(','), ...rows.map((r) => r.map(csvCell).join(',')), '');
  };
  const k = data.kpis;
  add(`Summary (last ${data.days} days vs previous ${data.days})`, ['Metric', 'This period', 'Previous'], Object.keys(k.current).map((m) => [m, k.current[m as keyof Kpi], k.previous[m as keyof Kpi]]));
  add('Daily', ['Day', 'Orders', 'Revenue'], data.daily.map((d) => [d.day, d.orders, d.revenue]));
  add('Branches', ['Branch', 'Orders', 'Revenue'], data.branches.map((b) => [b.name, b.orders, b.revenue]));
  add('Order types', ['Type', 'Orders', 'Revenue'], data.types.map((t) => [TYPE_LABEL[t.type] ?? t.type, t.orders, t.revenue]));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `milestones-sales-${data.days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function RevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  const width = 600;
  const height = 160;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const bw = data.length ? width / data.length : width;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Daily revenue">
      {data.map((d, i) => {
        const h = (d.revenue / max) * (height - 16);
        return (
          <rect key={d.day} x={i * bw + 1} y={height - h - 16} width={Math.max(bw - 2, 1)} height={h} rx={2} fill="#13284b">
            <title>{`${d.day}: ${money(d.revenue)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function SalesPanel({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<SalesData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    api<SalesData>(`/analytics/sales?days=${days}${branch ? `&branch_id=${branch}` : ''}`, token)
      .then((d) => live && setData(d))
      .catch(() => live && setError('Could not load sales.'));
    return () => {
      live = false;
    };
  }, [days, branch, token]);

  const c = data?.kpis.current;
  const p = data?.kpis.previous;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Sales</h2>
        <div className="flex items-center gap-2">
        <BranchSelect token={token} value={branch} onChange={setBranch} />
        <button
          onClick={() => data && downloadSalesCsv(data)}
          disabled={!data}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          Export CSV
        </button>
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
            <Kpi label="Revenue" value={money(c.revenue)} cur={c.revenue} prev={p.revenue} />
            <Kpi label="Completed orders" value={String(c.completed)} cur={c.completed} prev={p.completed} />
            <Kpi label="Avg order value" value={money(c.average_order_value)} cur={c.average_order_value} prev={p.average_order_value} />
            <Kpi label="Cancelled" value={String(c.cancelled)} cur={c.cancelled} prev={p.cancelled} />
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="mb-2 text-sm font-medium text-gray-700">Daily revenue</p>
            <RevenueChart data={data.daily} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="mb-2 text-sm font-medium text-gray-700">By branch</p>
              {data.branches.length === 0 ? (
                <p className="text-sm text-gray-500">No completed orders in this period.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.branches.map((b) => (
                    <li key={b.id} className="flex justify-between py-2">
                      <span className="text-gray-800">{b.name}</span>
                      <span className="text-gray-600">{b.orders} orders · {money(b.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="mb-2 text-sm font-medium text-gray-700">By order type</p>
              {data.types.length === 0 ? (
                <p className="text-sm text-gray-500">No completed orders in this period.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.types.map((t) => (
                    <li key={t.type} className="flex justify-between py-2">
                      <span className="text-gray-800">{TYPE_LABEL[t.type] ?? t.type}</span>
                      <span className="text-gray-600">{t.orders} orders · {money(t.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
