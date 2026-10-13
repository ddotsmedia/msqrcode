import { useEffect, useState } from 'react';
import { api } from '../api';

interface BranchAnalytics {
  branch_id: string;
  branch_name: string;
  scans: number;
  page_views: number;
  last_menu_update: string | null;
  paused: boolean;
  zero_scans_7d: boolean;
  daily_scans: number[];
}

interface AnalyticsResponse {
  total: number;
  active: number;
  paused: number;
  scans_today: number;
  branches: BranchAnalytics[];
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return <svg width="60" height="24" />;
  const max = Math.max(...data, 1);
  const width = 60;
  const height = 24;
  const barWidth = width / data.length;

  return (
    <svg width={width} height={height} className="inline-block">
      {data.map((val, i) => {
        const barHeight = (val / max) * height;
        return (
          <rect
            key={i}
            x={i * barWidth}
            y={height - barHeight}
            width={barWidth - 1}
            height={barHeight}
            fill="#3b82f6"
          />
        );
      })}
    </svg>
  );
}

export default function DashboardPage({ token }: { token: string }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'scans' | 'views'>('name');

  useEffect(() => {
    setLoading(true);
    api<AnalyticsResponse>('/analytics/branches', token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const sorted = data?.branches.sort((a, b) => {
    if (sortBy === 'name') return a.branch_name.localeCompare(b.branch_name);
    if (sortBy === 'scans') return b.scans - a.scans;
    return b.page_views - a.page_views;
  });

  return (
    <div className="space-y-4">
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Total branches</p>
              <p className="text-2xl font-bold text-gray-800">{data.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{data.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Paused</p>
              <p className="text-2xl font-bold text-yellow-600">{data.paused}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Scans today</p>
              <p className="text-2xl font-bold text-blue-600">{data.scans_today}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Branches</h2>
              <div className="flex gap-2 text-sm">
                {(['name', 'scans', 'views'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className={`px-2 py-1 rounded ${
                      sortBy === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-700">Branch</th>
                    <th className="px-4 py-2 text-right text-gray-700">Scans</th>
                    <th className="px-4 py-2 text-right text-gray-700">Views</th>
                    <th className="px-4 py-2 text-left text-gray-700">7d scans</th>
                    <th className="px-4 py-2 text-left text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted?.map((branch) => (
                    <tr key={branch.branch_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{branch.branch_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{branch.scans}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{branch.page_views}</td>
                      <td className="px-4 py-3">
                        <Sparkline data={branch.daily_scans} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {branch.paused && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">paused</span>}
                          {branch.zero_scans_7d && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">no scans</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && <p className="text-center text-gray-500">Loading…</p>}
    </div>
  );
}
