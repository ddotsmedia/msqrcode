import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';

// ---- data -----------------------------------------------------------------
interface Kpis {
  views: number;
  product_views: number;
  searches: number;
  stamps: number;
  redemptions: number;
  new_members: number;
  table_requests: number;
  reviews: number;
  rating: number | null;
}
interface Insights {
  days: number;
  kpis: { current: Kpis; previous: Kpis };
  daily: { day: string; views: number; stamps: number }[];
  busy: number[][];
  top_products: { name: string; count: number }[];
  top_searches: { term: string; count: number }[];
  branches: { id: string; name: string; views: number; stamps: number; requests: number; rating: number | null }[];
  loyalty_funnel: { members: number; stamped: number; returned: number; regulars: number; rewarded: number; active_in_period: number };
  tiers: { bronze: number; silver: number; gold: number };
  ratings: { rating: number; count: number }[];
  recent_comments: { rating: number; comment: string; branch: string | null; created_at: string }[];
  table_requests: { type: string; count: number; avg_minutes: number | null }[];
}

// ---- palette (single-series marks use brand ink; tiers use the validated categorical trio) ----
const C = {
  views: '#2d4c7e',
  stamps: '#a87a50',
  grid: '#e5e7eb',
  axis: '#6b7280',
  heat: ['#f3f5f9', '#d9e1ee', '#b3c2dc', '#8199c0', '#4f6e9f', '#2d4c7e', '#13284b'],
  tiers: { bronze: '#eb6834', silver: '#2a78d6', gold: '#1baf7a' },
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmt = (v: number) => v.toLocaleString('en-US');
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---- building blocks ----------------------------------------------------------
function Card({ title, sub, children, table }: { title: string; sub?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border shadow-sm p-4 min-w-0">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children}
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-gray-500">View as table</summary>
          <div className="mt-2 max-h-64 overflow-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-500">
          {head.map((h, i) => (
            <th key={h} className={`py-1 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            {r.map((c, j) => (
              <td key={j} className={`py-1 pr-3 ${j > 0 ? 'text-right tabular-nums' : ''}`}>
                {typeof c === 'number' ? fmt(c) : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return <span className="text-xs text-gray-400">no data</span>;
  if (!before) return <span className="text-xs text-gray-500">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const good = invert ? pct < 0 : pct > 0;
  return (
    <span className={`text-xs font-semibold ${pct === 0 ? 'text-gray-500' : good ? 'text-green-700' : 'text-red-700'}`}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {Math.abs(pct)}% <span className="font-normal text-gray-500">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, before, suffix, decimals, idx = 0 }: { label: string; value: number | null; before: number | null; suffix?: string; decimals?: number; idx?: number }) {
  const staggerClass = `stagger-${Math.min(idx + 1, 6)}`;
  return (
    <div className={`animate-fade-slide-up ${staggerClass} bg-white rounded-xl border shadow-sm p-4`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
        {value === null ? '–' : decimals ? value.toFixed(decimals) : fmt(value)}
        {suffix && value !== null && <span className="text-sm font-normal text-gray-500"> {suffix}</span>}
      </p>
      <div className="mt-1">{value !== null && before !== null ? <Delta now={value} before={before} /> : <span className="text-xs text-gray-400">&nbsp;</span>}</div>
    </div>
  );
}

// Area chart with crosshair + tooltip. One measure per chart (no dual axis).
function TrendChart({ data, color, label }: { data: { day: string; value: number }[]; color: string; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 180;
  const P = { l: 36, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max / 4 || 1)))) * Math.pow(10, Math.floor(Math.log10(max / 4 || 1))) * 4 || 4;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / nice) * (H - P.t - P.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nice * f));
  const every = Math.ceil(data.length / 6);

  function move(e: React.PointerEvent) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" role="img" aria-label={`${label} per day`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={C.axis}>
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (i % every === 0 && i < data.length - every / 2) || i === data.length - 1 ? (
            <text key={d.day} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize={10} fill={C.axis}>
              {shortDay(d.day)}
            </text>
          ) : null,
        )}
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={y(0)} stroke={C.axis} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.value)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border bg-white px-2.5 py-1.5 text-xs shadow"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-105%' : '5%'})` }}
        >
          <p className="text-gray-500">{shortDay(h.day)}</p>
          <p className="font-semibold text-gray-900">
            {fmt(h.value)} {label.toLowerCase()}
          </p>
        </div>
      )}
    </div>
  );
}

// Horizontal bars, sorted, value labels at the bar end.
function BarList({ rows, color, unit }: { rows: { label: string; value: number; note?: string }[]; color: string; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-gray-500">No data yet for this period.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm" title={`${r.label}: ${fmt(r.value)} ${unit}`}>
          <div className="flex justify-between gap-3">
            <span className="truncate text-gray-700">{r.label}</span>
            <span className="shrink-0 tabular-nums text-gray-900 font-medium">
              {fmt(r.value)}
              {r.note && <span className="ml-1 font-normal text-gray-500">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Day-of-week x hour heatmap, one sequential hue.
function Heatmap({ grid }: { grid: number[][] }) {
  const [tip, setTip] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v === 0 ? 0 : Math.min(C.heat.length - 1, 1 + Math.floor((v / max) * (C.heat.length - 1.001))));
  const peak = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 };
    grid.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })));
    return best;
  }, [grid]);
  const hr = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `36px repeat(24, minmax(14px, 1fr))` }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-[10px] text-gray-500 text-center">
              {h % 3 === 0 ? hr(h) : ''}
            </span>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="text-[11px] text-gray-500 self-center">{DAYS[d]}</span>
              {row.map((v, h) => (
                <span
                  key={h}
                  className="h-5 rounded-[3px] outline-offset-1 hover:outline hover:outline-2 hover:outline-gray-800"
                  style={{ background: C.heat[step(v)] }}
                  onPointerEnter={() => setTip({ d, h })}
                  onPointerLeave={() => setTip(null)}
                  title={`${DAYS[d]} ${hr(h)}: ${v}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
        <span>
          {tip ? (
            <>
              <b>
                {DAYS[tip.d]} {hr(tip.h)}–{hr((tip.h + 1) % 24)}
              </b>
              : {fmt(grid[tip.d][tip.h])} visits
            </>
          ) : peak.v > 0 ? (
            <>
              Busiest: <b>{DAYS[peak.d]} {hr(peak.h)}</b> ({fmt(peak.v)} visits)
            </>
          ) : (
            'No visits yet'
          )}
        </span>
        <span className="flex items-center gap-1">
          Fewer
          {C.heat.slice(1).map((c) => (
            <span key={c} className="h-3 w-4 rounded-sm" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(data: Insights) {
  const lines: string[] = [];
  const add = (title: string, head: string[], rows: unknown[][]) => {
    lines.push(title, head.join(','), ...rows.map((r) => r.map(csvCell).join(',')), '');
  };
  const k = data.kpis;
  add(`Summary (last ${data.days} days vs previous ${data.days})`, ['Metric', 'This period', 'Previous'], Object.keys(k.current).map((m) => [m, k.current[m as keyof Kpis], k.previous[m as keyof Kpis]]));
  add('Daily', ['Day', 'Menu views', 'Stamps'], data.daily.map((d) => [d.day, d.views, d.stamps]));
  add('Busy hours (Dubai)', ['Day', ...Array.from({ length: 24 }, (_, h) => `${h}:00`)], data.busy.map((r, i) => [DAYS[i], ...r]));
  add('Top products', ['Product', 'Views'], data.top_products.map((p) => [p.name, p.count]));
  add('Top searches', ['Search', 'Count'], data.top_searches.map((s) => [s.term, s.count]));
  add('Branches', ['Branch', 'Menu views', 'Stamps', 'Table requests', 'Rating'], data.branches.map((b) => [b.name, b.views, b.stamps, b.requests, b.rating ?? '']));
  add('Loyalty funnel', ['Step', 'Customers'], Object.entries(data.loyalty_funnel));
  add('Tiers', ['Tier', 'Members'], Object.entries(data.tiers));
  add('Ratings', ['Stars', 'Reviews'], data.ratings.map((r) => [r.rating, r.count]));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `milestones-insights-${data.days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- page -------------------------------------------------------------------
export default function InsightsPage({ token }: { token: string }) {
  const [days, setDays] = useState(30);
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string; status: string }[]>([]);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ id: string; name: string; status: string }[]>('/branches', token)
      .then((b) => setBranches(b.filter((x) => x.status === 'active')))
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    api<Insights>(`/analytics/insights?days=${days}${branch ? `&branch_id=${branch}` : ''}`, token)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, days, branch]);

  const cur = data?.kpis.current;
  const prev = data?.kpis.previous;
  const f = data?.loyalty_funnel;
  const tierTotal = data ? data.tiers.bronze + data.tiers.silver + data.tiers.gold : 0;

  return (
    <div className="space-y-4">
      {/* filters: one row above the charts */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-gray-800 mr-auto">Insights</h2>
        <div className="inline-flex rounded-lg border bg-white p-0.5" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={`px-3 py-1.5 text-sm rounded-md font-semibold ${days === d ? 'bg-brand-600 text-white' : 'text-gray-600'}`}>
              {d} days
            </button>
          ))}
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" aria-label="Branch">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => data && downloadCsv(data)} disabled={!data} className="border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
          Download CSV
        </button>
      </div>

      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}
      {loading && !data && <p className="text-center text-gray-500">Loading…</p>}

      {data && cur && prev && f && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi idx={0} label="Menu views" value={cur.views} before={prev.views} />
            <Kpi idx={1} label="Stamps (visits)" value={cur.stamps} before={prev.stamps} />
            <Kpi idx={2} label="New members" value={branch ? null : cur.new_members} before={branch ? null : prev.new_members} />
            <Kpi idx={3} label="Rewards redeemed" value={cur.redemptions} before={prev.redemptions} />
            <Kpi idx={4} label="Drink views" value={cur.product_views} before={prev.product_views} />
            <Kpi idx={5} label="Table requests" value={cur.table_requests} before={prev.table_requests} />
            <Kpi idx={0} label="Average rating" value={cur.rating} before={prev.rating} suffix="/ 5" decimals={1} />
            <Kpi idx={1} label="Reviews" value={cur.reviews} before={prev.reviews} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Menu views per day"
              sub="Each time someone opens a branch menu (QR scan or link)"
              table={<Table head={['Day', 'Views']} rows={data.daily.map((d) => [shortDay(d.day), d.views])} />}
            >
              <TrendChart data={data.daily.map((d) => ({ day: d.day, value: d.views }))} color={C.views} label="Views" />
            </Card>
            <Card
              title="Stamps per day"
              sub="Loyalty visits, staff and counter self-stamps"
              table={<Table head={['Day', 'Stamps']} rows={data.daily.map((d) => [shortDay(d.day), d.stamps])} />}
            >
              <TrendChart data={data.daily.map((d) => ({ day: d.day, value: d.stamps }))} color={C.stamps} label="Stamps" />
            </Card>
          </div>

          <Card title="Busy hours" sub="Menu views and stamps by day and hour (Dubai time). Use it to plan staff and offers.">
            <Heatmap grid={data.busy} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Most viewed drinks" sub="Opened from the menu" table={<Table head={['Drink', 'Views']} rows={data.top_products.map((p) => [p.name, p.count])} />}>
              <BarList rows={data.top_products.map((p) => ({ label: p.name, value: p.count }))} color={C.views} unit="views" />
            </Card>
            <Card title="What customers search for" sub="Searches that may need a menu item or better names" table={<Table head={['Search', 'Count']} rows={data.top_searches.map((s) => [s.term, s.count])} />}>
              <BarList rows={data.top_searches.map((s) => ({ label: s.term, value: s.count }))} color={C.views} unit="searches" />
            </Card>
            <Card
              title="Branches compared"
              sub="Menu views in this period"
              table={<Table head={['Branch', 'Views', 'Stamps', 'Requests', 'Rating']} rows={data.branches.map((b) => [b.name, b.views, b.stamps, b.requests, b.rating ?? '–'])} />}
            >
              <BarList rows={data.branches.map((b) => ({ label: b.name, value: b.views, note: b.rating ? `★ ${b.rating}` : undefined }))} color={C.views} unit="views" />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              title="Loyalty journey"
              sub="All members so far. Share of members at each step."
              table={<Table head={['Step', 'Customers']} rows={[['Joined', f.members], ['First stamp', f.stamped], ['Came back (2+)', f.returned], ['Regular (5+)', f.regulars], ['Got a reward', f.rewarded]]} />}
            >
              <BarList
                rows={[
                  ['Joined', f.members],
                  ['First stamp', f.stamped],
                  ['Came back (2+ visits)', f.returned],
                  ['Regular (5+ visits)', f.regulars],
                  ['Got a reward', f.rewarded],
                ].map(([label, value]) => ({ label: String(label), value: Number(value), note: f.members ? `${Math.round((Number(value) / f.members) * 100)}%` : undefined }))}
                color={C.stamps}
                unit="customers"
              />
              <p className="mt-3 text-xs text-gray-600">
                <b>{fmt(f.active_in_period)}</b> members visited in the last {data.days} days.
              </p>
            </Card>
            <Card title="Member tiers" sub="Visits in the last 12 months" table={<Table head={['Tier', 'Members']} rows={Object.entries(data.tiers).map(([t, v]) => [t, v])} />}>
              {tierTotal === 0 ? (
                <p className="text-sm text-gray-500">No members yet.</p>
              ) : (
                <>
                  <div className="flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Members by tier">
                    {(['bronze', 'silver', 'gold'] as const).map((t) =>
                      data.tiers[t] ? <div key={t} style={{ width: `${(data.tiers[t] / tierTotal) * 100}%`, background: C.tiers[t] }} title={`${t}: ${data.tiers[t]}`} /> : null,
                    )}
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {(['bronze', 'silver', 'gold'] as const).map((t) => (
                      <li key={t} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 capitalize text-gray-700">
                          <span className="h-3 w-3 rounded-sm" style={{ background: C.tiers[t] }} />
                          {t}
                        </span>
                        <span className="tabular-nums text-gray-900">
                          {fmt(data.tiers[t])} <span className="text-gray-500">({Math.round((data.tiers[t] / tierTotal) * 100)}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
            <Card title="Table service" sub="Call staff and bill requests from the table QR">
              <ul className="space-y-3 text-sm">
                {data.table_requests.map((r) => (
                  <li key={r.type} className="flex items-baseline justify-between gap-3">
                    <span className="text-gray-700">{r.type === 'bill' ? 'Bill requests' : 'Staff calls'}</span>
                    <span className="text-right">
                      <span className="text-lg font-semibold text-gray-900 tabular-nums">{fmt(r.count)}</span>
                      <span className="block text-xs text-gray-500">{r.avg_minutes != null ? `answered in ${r.avg_minutes} min on average` : 'no answered requests'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Ratings" sub="Feedback from the menu page" table={<Table head={['Stars', 'Reviews']} rows={data.ratings.map((r) => [`${r.rating} ★`, r.count])} />}>
              <BarList rows={[...data.ratings].reverse().map((r) => ({ label: `${r.rating} ★`, value: r.count }))} color={C.views} unit="reviews" />
            </Card>
            <Card title="Latest comments">
              {data.recent_comments.length === 0 ? (
                <p className="text-sm text-gray-500">No comments in this period.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.recent_comments.map((c, i) => (
                    <li key={i} className="py-2">
                      <p className="text-gray-800">“{c.comment}”</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {'★'.repeat(c.rating)} · {c.branch ?? 'Branch'} · {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
