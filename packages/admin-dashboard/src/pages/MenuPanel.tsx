import { useEffect, useState } from 'react';
import { api } from '../api';

interface Item {
  name: string;
  units: number;
  revenue: number;
}
interface MenuData {
  days: number;
  totals: { units: number; revenue: number; items_sold: number };
  top_sellers: Item[];
  bottom_sellers: Item[];
  categories: { name: string; units: number; revenue: number; share: number }[];
}

const money = (v: number) => `AED ${v.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;

function ItemList({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <p className="mb-2 text-sm font-medium text-gray-700">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No sales in this period.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {items.map((i) => (
            <li key={i.name} className="flex justify-between gap-3 py-2">
              <span className="truncate text-gray-800">{i.name}</span>
              <span className="shrink-0 text-gray-600">{i.units} sold · {money(i.revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MenuPanel({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    api<MenuData>(`/analytics/menu?days=${days}`, token)
      .then((d) => live && setData(d))
      .catch(() => live && setError('Could not load menu performance.'));
    return () => {
      live = false;
    };
  }, [days, token]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Menu performance</h2>
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <>
          <p className="text-sm text-gray-600">
            {data.totals.units} items sold across {data.totals.items_sold} menu items · {money(data.totals.revenue)}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <ItemList title="Top sellers" items={data.top_sellers} />
            <ItemList title="Lowest sellers" items={data.bottom_sellers} />
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="mb-2 text-sm font-medium text-gray-700">Category mix</p>
            {data.categories.length === 0 ? (
              <p className="text-sm text-gray-500">No sales in this period.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {data.categories.map((c) => (
                  <li key={c.name}>
                    <div className="flex justify-between">
                      <span className="text-gray-800">{c.name}</span>
                      <span className="text-gray-600">{c.units} sold · {money(c.revenue)} · {Math.round(c.share * 100)}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-[#13284b]" style={{ width: `${Math.max(c.share * 100, 1)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
