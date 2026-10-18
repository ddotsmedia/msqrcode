import { useEffect, useState } from 'react';
import { api } from '../api';

interface Row {
  id: string;
  title: string;
  is_active: boolean;
  views: number;
  code_copies: number;
  shares: number;
  calendar: number;
  order_clicks: number;
  coupon_opens: number;
  combo_adds: number;
  redemptions: number;
  reminders: number;
  combo_orders: number;
  combo_saved: number;
  action_rate: number;
}

// How each offer performs on the website: views, what visitors did, coupons redeemed and combo orders.
export default function OfferStats({ token }: { token: string }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    api<{ rows: Row[] }>(`/admin/offers/stats?days=${days}`, token)
      .then((r) => setRows(r.rows.filter((x) => x.is_active || x.views).sort((a, b) => b.views - a.views)))
      .catch((e: Error) => setError(e.message));
  }, [days, token]);

  const top = Math.max(1, ...(rows ?? []).map((r) => r.views));
  const totals = (rows ?? []).reduce(
    (t, r) => ({ views: t.views + r.views, actions: t.actions + r.order_clicks + r.coupon_opens + r.combo_adds, redeemed: t.redeemed + r.redemptions + r.combo_orders }),
    { views: 0, actions: 0, redeemed: 0 },
  );

  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Offer performance</h3>
          <p className="text-sm text-gray-500">What visitors did on the website's Offers page.</p>
        </div>
        <div className="inline-flex rounded border border-gray-300 text-sm" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-3 py-1.5 ${days === d ? 'bg-brand-600 font-semibold text-white' : 'text-gray-700'}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!rows && !error && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
      {rows && (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ['Offer views', totals.views],
              ['Taps (order, coupon, combo)', totals.actions],
              ['Coupons used + combo orders', totals.redeemed],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="text-2xl font-bold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No offer activity yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Offer</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3" title="Order now taps">Order taps</th>
                    <th className="py-2 pr-3">Coupons opened / used</th>
                    <th className="py-2 pr-3">Combo adds / orders</th>
                    <th className="py-2 pr-3">Code copies</th>
                    <th className="py-2 pr-3">Shares</th>
                    <th className="py-2 pr-3">Calendar</th>
                    <th className="py-2 pr-3" title="Customers waiting for a reminder before it starts">Reminders</th>
                    <th className="py-2 pr-3" title="Share of views that led to an order tap, coupon or combo">Action rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">
                          {r.title} {!r.is_active && <span className="text-xs text-gray-400">(hidden)</span>}
                        </p>
                        <span className="mt-1 block h-1.5 rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(r.views / top) * 100}%` }} />
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{r.views}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.order_clicks}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.coupon_opens} / <span className="font-semibold text-green-700">{r.redemptions}</span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.combo_adds} / <span className="font-semibold text-green-700">{r.combo_orders}</span>
                        {r.combo_saved > 0 && <span className="block text-xs text-gray-500">AED {r.combo_saved.toFixed(2)} off</span>}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{r.code_copies}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.shares}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.calendar}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.reminders}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.action_rate >= 10 ? 'bg-green-50 text-green-700' : r.action_rate > 0 ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                          {r.action_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
