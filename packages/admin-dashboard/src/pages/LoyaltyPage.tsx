import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
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
  type: 'enroll' | 'stamp' | 'redeem' | 'adjust' | 'bonus';
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
  referrals_this_month: number;
  stamps_target: number;
}

interface Settings {
  stamps_target: number;
  reward_name: string;
  daily_stamp_limit: number;
  birthday_bonus: number;
  referral_bonus: number;
  double_days: number[];
  double_from: string;
  double_to: string;
  self_stamp: boolean;
  double_now?: boolean;
}

type ActionResult = {
  ok: boolean;
  message?: string;
  stamps?: number;
  earned?: number;
  double?: boolean;
  bonuses?: string[];
  name?: string | null;
  phone?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Readable summary of a stamp result, e.g. "2 stamps added (double stamps) + birthday bonus. Now 7."
function stampSummary(res: ActionResult) {
  const extra = (res.bonuses ?? []).map((b) => `${b} bonus`).join(', ');
  return `${res.earned ?? 1} stamp${(res.earned ?? 1) === 1 ? '' : 's'} added${res.double ? ' (double stamps)' : ''}${extra ? ` + ${extra}` : ''}. Now ${res.stamps}.`;
}

const EVENT_LABEL: Record<HistoryRow['type'], string> = {
  enroll: 'Card created',
  stamp: 'Stamp added',
  redeem: 'Reward redeemed',
  adjust: 'Manual adjustment',
  bonus: 'Bonus',
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
    ['Referrals this month', stats?.referrals_this_month],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
  const [form, setForm] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (!form) return null;
  const num = (key: 'stamps_target' | 'daily_stamp_limit' | 'birthday_bonus' | 'referral_bonus') => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: Number(e.target.value) });
  const toggleDay = (d: number) =>
    setForm({ ...form, double_days: form.double_days.includes(d) ? form.double_days.filter((x) => x !== d) : [...form.double_days, d] });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      await api('/admin/loyalty/settings', token, {
        method: 'PUT',
        body: JSON.stringify({
          stamps_target: form.stamps_target,
          reward_name: form.reward_name,
          daily_stamp_limit: form.daily_stamp_limit,
          birthday_bonus: form.birthday_bonus,
          referral_bonus: form.referral_bonus,
          double_days: form.double_days,
          double_from: form.double_from,
          double_to: form.double_to,
          self_stamp: form.self_stamp,
        }),
      });
      setMsg('Saved.');
      onSaved();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  return (
    <form onSubmit={save} className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
      <p className="font-semibold text-gray-800">Programme rules</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={label}>Stamps needed</label>
          <input type="number" min={3} max={30} value={form.stamps_target} onChange={num('stamps_target')} className={`${inputClass} w-24`} />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <label className={label}>Reward</label>
          <input value={form.reward_name} maxLength={80} onChange={(e) => setForm({ ...form, reward_name: e.target.value })} className={`${inputClass} w-full`} />
        </div>
        <div>
          <label className={label}>Max stamps per day</label>
          <input type="number" min={1} max={10} value={form.daily_stamp_limit} onChange={num('daily_stamp_limit')} className={`${inputClass} w-24`} />
        </div>
        <div>
          <label className={label}>Birthday bonus</label>
          <input type="number" min={0} max={5} value={form.birthday_bonus} onChange={num('birthday_bonus')} className={`${inputClass} w-24`} />
        </div>
        <div>
          <label className={label}>Referral bonus (each)</label>
          <input type="number" min={0} max={5} value={form.referral_bonus} onChange={num('referral_bonus')} className={`${inputClass} w-24`} />
        </div>
      </div>
      <div>
        <p className={label}>Double-stamp hours (Dubai time){form.double_days.length === 0 ? ': off' : ''}</p>
        <div className="flex flex-wrap items-center gap-2">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={form.double_days.includes(i)}
              onClick={() => toggleDay(i)}
              className={`rounded px-3 py-1.5 text-sm font-semibold border ${form.double_days.includes(i) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700'}`}
            >
              {d}
            </button>
          ))}
          <input type="time" value={form.double_from} onChange={(e) => setForm({ ...form, double_from: e.target.value })} className={inputClass} aria-label="Double stamps from" />
          <span className="text-sm text-gray-500">to</span>
          <input type="time" value={form.double_to} onChange={(e) => setForm({ ...form, double_to: e.target.value })} className={inputClass} aria-label="Double stamps until" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.self_stamp} onChange={(e) => setForm({ ...form, self_stamp: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="font-semibold">Counter self-stamp.</span> Customers scan a code on the counter screen to stamp their own card. The code
          changes every 30 seconds, so a photo of it stops working within a minute.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save rules'}
        </button>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </div>
    </form>
  );
}

// Staff scan the QR on the customer's card to add a stamp without typing the phone number.
function ScanStamp({ token, onDone }: { token: string; onDone: (msg: string, ok: boolean) => void }) {
  const ref = useRef<Html5QrcodeScanner | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('loyalty-qr-reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    ref.current = scanner;
    scanner.render(
      async (text) => {
        if (busy.current) return;
        const m = text.match(/^MSQ-CARD:([a-f0-9]{16,64})$/i);
        if (!m) {
          onDone('That QR is not a Milestones loyalty card.', false);
          return;
        }
        busy.current = true;
        scanner.clear().catch(() => {});
        try {
          const res = await api<ActionResult>('/admin/loyalty/stamp', token, { method: 'POST', body: JSON.stringify({ token: m[1] }) });
          const who = res.name || res.phone || 'Customer';
          onDone(res.ok ? `${who}: ${stampSummary(res)}` : `${who}: ${res.message ?? 'Could not add a stamp.'}`, res.ok);
        } catch (err) {
          onDone((err as Error).message, false);
        }
      },
      () => {},
    );
    return () => {
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return <div id="loyalty-qr-reader" className="bg-white rounded-xl border shadow-sm p-2 max-w-sm" />;
}

const MENU_URL = ((import.meta.env.VITE_MENU_URL as string | undefined) ?? 'https://coffeesales.ae').replace(/\/$/, '');

// Full-screen QR for a counter tablet. Customers scan it with their phone to stamp their own card.
// The code rotates every 30 seconds so a shared photo soon stops working.
function CounterScreen({ token, branchId, onClose }: { token: string; branchId: string | null; onClose: () => void }) {
  const [branches, setBranches] = useState<{ id: string; name: string; status: string }[]>([]);
  const [branch, setBranch] = useState(branchId ?? '');
  const [qr, setQr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string; status: string }[]>('/branches', token)
      .then((list) => {
        const active = list.filter((b) => b.status === 'active' && (!branchId || b.id === branchId));
        setBranches(active);
        if (!branchId && active.length === 1) setBranch(active[0].id);
      })
      .catch((err) => setError((err as Error).message));
  }, [token, branchId]);

  useEffect(() => {
    if (!branch) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function refresh() {
      try {
        const res = await api<{ code: string; branch_name: string; expires_in_ms: number }>(
          `/admin/loyalty/counter?branch_id=${encodeURIComponent(branch)}`,
          token,
        );
        if (stopped) return;
        setName(res.branch_name);
        setQr(await QRCode.toDataURL(`${MENU_URL}/loyalty?stamp=${encodeURIComponent(res.code)}`, { margin: 1, width: 560, color: { dark: '#0b1a33', light: '#ffffff' } }));
        setError(null);
        setLeft(Math.ceil(res.expires_in_ms / 1000));
        timer = setTimeout(refresh, res.expires_in_ms + 300);
      } catch (err) {
        if (stopped) return;
        setError((err as Error).message);
        timer = setTimeout(refresh, 10_000);
      }
    }
    refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [branch, token]);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1a33] text-white flex flex-col items-center justify-center p-6 text-center">
      <button type="button" onClick={onClose} className="absolute top-4 right-4 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">
        Close
      </button>
      {!branch ? (
        <div className="space-y-3">
          <p className="text-lg font-semibold">Which branch is this screen at?</p>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded px-3 py-2 text-gray-900">
            <option value="">Choose a branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold tracking-widest uppercase text-[#d9b88f]">Milestones Rewards{name ? ` · ${name}` : ''}</p>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold">Scan to collect your stamp</h2>
          <p className="mt-3 text-white/70">Open your phone camera and point it at the code.</p>
          <div className="mt-8 rounded-3xl bg-white p-4">
            {qr ? <img src={qr} alt="Counter stamp code" className="h-72 w-72 md:h-96 md:w-96" /> : <div className="h-72 w-72 md:h-96 md:w-96" />}
          </div>
          <p className="mt-4 text-sm text-white/60">New code in {left}s</p>
        </>
      )}
      {error && <p className="mt-4 rounded bg-red-500/20 px-4 py-2 text-sm">{error}</p>}
    </div>
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

export default function LoyaltyPage({ token, role, branchId }: { token: string; role: string; branchId?: string | null }) {
  const isAdmin = role === 'admin';
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [counter, setCounter] = useState(false);

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
        setNotice(path === 'stamp' ? stampSummary(res) : 'Reward redeemed. Card reset.');
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

      {settings?.double_now && (
        <p className="bg-amber-50 text-amber-800 rounded p-3 text-sm font-semibold">Double-stamp hours are on now: each visit earns 2 stamps.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScanning((v) => !v)}
          className="bg-amber-600 text-white rounded px-4 py-2 text-sm font-semibold"
        >
          {scanning ? 'Close scanner' : 'Scan card to add a stamp'}
        </button>
        {settings?.self_stamp && (
          <button type="button" onClick={() => setCounter(true)} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold">
            Open counter screen
          </button>
        )}
      </div>
      {counter && <CounterScreen token={token} branchId={branchId ?? null} onClose={() => setCounter(false)} />}
      {scanning && (
        <ScanStamp
          token={token}
          onDone={(msg, ok) => {
            setScanning(false);
            if (ok) {
              setNotice(msg);
              setError(null);
            } else {
              setError(msg);
              setNotice(null);
            }
            loadStats();
          }}
        />
      )}

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
