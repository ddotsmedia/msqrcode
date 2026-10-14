import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

interface CardRow {
  phone: string;
  name: string | null;
  stamps: number;
  target: number;
  redeemed_count: number;
  created_at: string;
}

interface HistoryRow {
  type: 'enroll' | 'stamp' | 'redeem' | 'adjust';
  delta: number;
  stamps_after: number;
  note: string | null;
  staff: string | null;
  branch: string | null;
  created_at: string;
}

interface Stats {
  members: number;
  new_this_week: number;
  stamps_this_week: number;
  redemptions_this_month: number;
  ready_to_redeem: number;
  stamps_target: number;
}

interface Settings {
  stamps_target: number;
  reward_name: string;
}

type ActionResult = { ok: boolean; message?: string; stamps?: number };

const EVENT_LABEL: Record<HistoryRow['type'], string> = {
  enroll: 'Card created',
  stamp: 'Stamp added',
  redeem: 'Reward redeemed',
  adjust: 'Manual adjustment',
};

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm';

function when(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatsRow({ stats }: { stats: Stats | null }) {
  const tiles: [string, number | undefined][] = [
    ['Members', stats?.members],
    ['New this week', stats?.new_this_week],
    ['Stamps this week', stats?.stamps_this_week],
    ['Rewards this month', stats?.redemptions_this_month],
    ['Ready to redeem', stats?.ready_to_redeem],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-brand-800 mt-1">{value ?? '–'}</p>
        </div>
      ))}
    </div>
  );
}

function SettingsForm({ token, settings, onSaved }: { token: string; settings: Settings | null; onSaved: () => void }) {
  const [target, setTarget] = useState('');
  const [reward, setReward] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTarget(String(settings.stamps_target));
      setReward(settings.reward_name);
    }
  }, [settings]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api('/admin/loyalty/settings', token, {
        method: 'PUT',
        body: JSON.stringify({ stamps_target: Number(target), reward_name: reward }),
      });
      setMsg('Saved.');
      onSaved();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Stamps needed</label>
        <input type="number" min={3} max={30} value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} w-24`} />
      </div>
      <div className="flex-1 min-w-[12rem]">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Reward</label>
        <input value={reward} maxLength={80} onChange={(e) => setReward(e.target.value)} className={`${inputClass} w-full`} placeholder="Free drink" />
      </div>
      <button type="submit" disabled={saving} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {saving ? 'Saving…' : 'Save rules'}
      </button>
      {msg && <p className="w-full text-sm text-gray-600">{msg}</p>}
    </form>
  );
}

function CardDetails({ token, phone, isAdmin, onChanged }: { token: string; phone: string; isAdmin: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<HistoryRow[]>(`/admin/loyalty/history?phone=${encodeURIComponent(phone)}`, token)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [token, phone]);

  async function adjust(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<ActionResult>('/admin/loyalty/adjust', token, {
        method: 'POST',
        body: JSON.stringify({ phone, delta: Number(delta), note }),
      });
      setMsg(res.ok ? `Done. Card now has ${res.stamps} stamps.` : (res.message ?? 'No change.'));
      if (res.ok) {
        setNote('');
        load();
        onChanged();
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-gray-50 p-4 space-y-4">
      {isAdmin && (
        <form onSubmit={adjust} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Change stamps</label>
            <input type="number" min={-30} max={30} value={delta} onChange={(e) => setDelta(e.target.value)} className={`${inputClass} w-20`} />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (required)</label>
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`${inputClass} w-full`} placeholder="e.g. Missed stamp on Monday" />
          </div>
          <button type="submit" disabled={busy || note.trim().length < 3} className="border rounded px-3 py-2 text-sm font-semibold disabled:opacity-50">
            Apply
          </button>
          {msg && <p className="w-full text-sm text-gray-600">{msg}</p>}
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-gray-500">No history yet. History starts from this update.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y text-sm">
          {rows.map((r, i) => (
            <li key={i} className="py-2 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-gray-500 w-32">{when(r.created_at)}</span>
              <span className="font-semibold text-gray-800">{EVENT_LABEL[r.type]}</span>
              {r.delta !== 0 && <span className={r.delta > 0 ? 'text-green-700' : 'text-red-700'}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>}
              <span className="text-gray-500">→ {r.stamps_after}</span>
              {r.staff && <span className="text-gray-500">by {r.staff}</span>}
              {r.branch && <span className="text-gray-500">at {r.branch}</span>}
              {r.note && <span className="w-full text-gray-600 italic">“{r.note}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LoyaltyPage({ token, role }: { token: string; role: string }) {
  const isAdmin = role === 'admin';
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function loadStats() {
    api<Stats>('/admin/loyalty/stats', token).then(setStats).catch(() => undefined);
  }

  function loadSettings() {
    api<Settings>('/loyalty/settings', token).then(setSettings).catch(() => undefined);
  }

  useEffect(() => {
    loadStats();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setError(null);
    try {
      setRows(await api<CardRow[]>(`/admin/loyalty/cards?q=${encodeURIComponent(query.trim())}`, token));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(path: 'stamp' | 'redeem', phone: string) {
    setBusy(phone + path);
    setError(null);
    setNotice(null);
    try {
      const res = await api<ActionResult>(`/admin/loyalty/${path}`, token, {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setNotice(path === 'stamp' ? `Stamp added. Now ${res.stamps} stamps.` : 'Reward redeemed. Card reset.');
      } else {
        setError(res.message ?? 'Could not update the card.');
      }
      await search();
      loadStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Loyalty</h2>
        <p className="text-sm text-gray-500">
          {settings ? `${settings.stamps_target} stamps earn: ${settings.reward_name}.` : 'Loading rules…'} Find a customer to add a stamp, redeem, or see their history.
        </p>
      </div>

      <StatsRow stats={stats} />
      {isAdmin && <SettingsForm token={token} settings={settings} onSaved={() => { loadSettings(); loadStats(); }} />}

      <form onSubmit={search} className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or phone" className={`flex-1 ${inputClass}`} />
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
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {rows.map((r) => {
            const full = r.stamps >= r.target;
            return (
              <div key={r.phone} className="border-t first:border-t-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1 min-w-[10rem]">
                    <p className="font-semibold text-gray-800">{r.name || '—'}</p>
                    <p className="font-mono text-gray-500">{r.phone}</p>
                  </div>
                  <p className="w-24">
                    <span className="font-semibold">{r.stamps}</span>/{r.target}
                    {full && <span className="ml-1 text-xs font-semibold text-amber-700">ready</span>}
                  </p>
                  <p className="w-24 text-gray-500">{r.redeemed_count} redeemed</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => act('stamp', r.phone)} disabled={full || busy !== null} className="border rounded px-2 py-1 font-semibold disabled:opacity-50">
                      +1 stamp
                    </button>
                    <button type="button" onClick={() => act('redeem', r.phone)} disabled={!full || busy !== null} className="bg-amber-600 text-white rounded px-2 py-1 font-semibold disabled:opacity-50">
                      Redeem
                    </button>
                    <button type="button" onClick={() => setOpen(open === r.phone ? null : r.phone)} aria-expanded={open === r.phone} className="border rounded px-2 py-1 font-semibold">
                      {open === r.phone ? 'Hide' : 'History'}
                    </button>
                  </div>
                </div>
                {open === r.phone && <CardDetails token={token} phone={r.phone} isAdmin={isAdmin} onChanged={() => { search(); loadStats(); }} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
