import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

interface Branch {
  id: string;
  code: string;
  name: string;
}

export interface QrRow {
  id: string;
  branch_id: string;
  kind: 'branch' | 'table';
  table_number: string | null;
  label: string;
  caption: string;
  foreground: string;
  background: string;
  is_active: boolean;
  payload: string;
  branch: { id: string; name: string; code: string };
}

interface QrForm {
  id: string | null;
  branch_id: string;
  kind: 'branch' | 'table';
  table_number: string;
  label: string;
  caption: string;
  foreground: string;
  background: string;
}

type KindFilter = 'all' | 'branch' | 'table';

const DEFAULT_CAPTION = 'Scan to view the menu';

// Same format the menu scanner reads: branch:<id>, plus ;table:<n> for table codes.
export function payloadFor(branchId: string, kind: 'branch' | 'table', table: string): string {
  return kind === 'table' && table ? `branch:${branchId};table:${table}` : `branch:${branchId}`;
}

function qrOptions(fg: string, bg: string) {
  return { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: fg, light: bg } };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileBase(row: QrRow): string {
  return `${row.branch.code}-${row.kind === 'table' ? `table-${row.table_number}` : 'branch'}`;
}

function triggerDownload(href: string, name: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

async function downloadPng(row: QrRow): Promise<void> {
  const url = await QRCode.toDataURL(row.payload, { width: 1024, ...qrOptions(row.foreground, row.background) });
  triggerDownload(url, `qr-${fileBase(row)}.png`);
}

async function downloadSvg(row: QrRow): Promise<void> {
  const svg = await QRCode.toString(row.payload, { type: 'svg', ...qrOptions(row.foreground, row.background) });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  triggerDownload(url, `qr-${fileBase(row)}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function printSheet(rows: QrRow[]): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) return;
  const cards = await Promise.all(
    rows.map(async (r) => {
      const svg = await QRCode.toString(r.payload, { type: 'svg', ...qrOptions(r.foreground, r.background) });
      const where = r.kind === 'table' ? `${r.branch.name} · Table ${esc(r.table_number ?? '')}` : esc(r.branch.name);
      return `<div class="card"><div class="qr">${svg}</div><h2>${esc(r.label)}</h2><p>${esc(r.caption)}</p><small>${where}</small></div>`;
    }),
  );
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR codes</title><style>
  @page { size: A4; margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
  .card { border: 1px solid #ddd; border-radius: 4mm; padding: 5mm; text-align: center; break-inside: avoid; }
  .qr svg { width: 100%; height: auto; display: block; }
  h2 { font-size: 13px; margin: 3mm 0 1mm; }
  p { font-size: 11px; color: #444; margin: 0; }
  small { font-size: 10px; color: #888; }
  </style></head><body><div class="grid">${cards.join('')}</div>
  <script>window.onload = function () { window.print(); };<\/script></body></html>`);
  win.document.close();
}

// Renders a QR preview as a PNG data URL for the given colours.
function QrImage({ payload, fg, bg, alt, className }: { payload: string; fg: string; bg: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(payload, { width: 512, ...qrOptions(fg, bg) })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
    };
  }, [payload, fg, bg]);

  if (!src) return <div className={`${className ?? ''} bg-gray-100 rounded animate-pulse`} aria-label={alt} />;
  return <img src={src} alt={alt} className={className} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-500 text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

export default function QrCodesPage({ token }: { token: string }) {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [branchFilter, setBranchFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [showPaused, setShowPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [form, setForm] = useState<QrForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tablesOpen, setTablesOpen] = useState(false);
  const [tableRange, setTableRange] = useState({ branch_id: '', from: '1', to: '10' });
  const [tableError, setTableError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api<QrRow[]>('/admin/qr-codes', token), api<Branch[]>('/branches', token)])
      .then(([qr, br]) => {
        setRows(qr);
        setBranches(br);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!branchFilter || r.branch_id === branchFilter) &&
        (kindFilter === 'all' || r.kind === kindFilter) &&
        (showPaused || r.is_active) &&
        (!q || `${r.label} ${r.branch.name} ${r.table_number ?? ''}`.toLowerCase().includes(q)),
    );
  }, [rows, branchFilter, kindFilter, showPaused, query]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.is_active).length,
      tables: rows.filter((r) => r.kind === 'table').length,
      paused: rows.filter((r) => !r.is_active).length,
    }),
    [rows],
  );

  const branchesWithoutCode = branches.filter((b) => !rows.some((r) => r.branch_id === b.id && r.kind === 'branch'));
  const chosen = visible.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNew(kind: 'branch' | 'table', branchId?: string) {
    setFormError(null);
    setForm({
      id: null,
      branch_id: branchId || branchFilter || branches[0]?.id || '',
      kind,
      table_number: '',
      label: '',
      caption: DEFAULT_CAPTION,
      foreground: '#111111',
      background: '#ffffff',
    });
  }

  function openEdit(r: QrRow) {
    setFormError(null);
    setForm({
      id: r.id,
      branch_id: r.branch_id,
      kind: r.kind,
      table_number: r.table_number ?? '',
      label: r.label,
      caption: r.caption,
      foreground: r.foreground,
      background: r.background,
    });
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) {
        await api(`/admin/qr-codes/${form.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            label: form.label,
            caption: form.caption,
            foreground: form.foreground,
            background: form.background,
          }),
        });
      } else {
        await api('/admin/qr-codes', token, {
          method: 'POST',
          body: JSON.stringify({
            branch_id: form.branch_id,
            kind: form.kind,
            table_number: form.table_number,
            label: form.label,
            caption: form.caption,
            foreground: form.foreground,
            background: form.background,
          }),
        });
      }
      setForm(null);
      setNotice('QR code saved.');
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePaused(r: QrRow) {
    setError(null);
    try {
      if (r.is_active) {
        await api(`/admin/qr-codes/${r.id}`, token, { method: 'DELETE' });
      } else {
        await api(`/admin/qr-codes/${r.id}`, token, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      }
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function generateTables(e: FormEvent) {
    e.preventDefault();
    setTableError(null);
    try {
      const res = await api<{ created: number; skipped: number }>('/admin/qr-codes/tables', token, {
        method: 'POST',
        body: JSON.stringify({
          branch_id: tableRange.branch_id,
          from: Number(tableRange.from),
          to: Number(tableRange.to),
        }),
      });
      setTablesOpen(false);
      setNotice(`Created ${res.created} table code(s). Skipped ${res.skipped} that already exist.`);
      load();
    } catch (err) {
      setTableError((err as Error).message);
    }
  }

  const previewPayload = form ? payloadFor(form.branch_id, form.kind, form.table_number) : '';

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">QR codes</h2>
          <p className="text-sm text-gray-500">
            Each code opens a branch's menu. Use table codes to place one on every table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTableError(null);
              setTableRange({ branch_id: branchFilter || branches[0]?.id || '', from: '1', to: '10' });
              setTablesOpen(true);
            }}
            className="border border-gray-300 bg-white rounded px-3 py-2 text-sm font-semibold text-gray-700"
          >
            Generate table codes
          </button>
          <button
            type="button"
            onClick={() => openNew('branch')}
            className="bg-brand-600 text-white rounded px-3 py-2 text-sm font-semibold"
          >
            New QR code
          </button>
        </div>
      </div>

      {notice && (
        <p className="bg-green-50 text-green-800 rounded p-3 text-sm flex justify-between">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="font-semibold">
            Dismiss
          </button>
        </p>
      )}
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      {branchesWithoutCode.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          <p className="font-semibold">Branches without a branch QR code</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {branchesWithoutCode.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => openNew('branch', b.id)}
                className="bg-white border border-amber-300 rounded px-3 py-1 text-xs font-semibold"
              >
                + {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total codes" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Table codes" value={stats.tables} />
        <Stat label="Paused" value={stats.paused} />
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search label or table…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[10rem] border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-2 text-sm">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded border border-gray-300 overflow-hidden text-sm">
          {(['all', 'branch', 'table'] as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`px-3 py-2 capitalize ${kindFilter === k ? 'bg-brand-600 text-white' : 'bg-white text-gray-700'}`}
            >
              {k === 'all' ? 'All' : k === 'branch' ? 'Branch' : 'Tables'}
            </button>
          ))}
        </div>
        <label className="text-sm text-gray-600 flex items-center gap-1">
          <input type="checkbox" checked={showPaused} onChange={(e) => setShowPaused(e.target.checked)} />
          Show paused
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex gap-3 text-gray-600">
          <span>{visible.length} shown</span>
          <button type="button" onClick={() => setSelected(new Set(visible.map((r) => r.id)))} className="text-brand-700 font-semibold">
            Select all shown
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-gray-500 font-semibold">
              Clear selection
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={visible.length === 0}
          onClick={() => printSheet(chosen.length > 0 ? chosen : visible)}
          className="bg-gray-900 text-white rounded px-3 py-2 font-semibold disabled:opacity-50"
        >
          {chosen.length > 0 ? `Print sheet (${chosen.length})` : 'Print all shown'}
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading QR codes…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-gray-500 text-sm bg-white rounded-xl border p-6 text-center">No QR codes match these filters.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => (
          <article
            key={r.id}
            className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col ${r.is_active ? '' : 'opacity-60'}`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                Select
              </label>
              <div className="flex gap-1 text-xs">
                <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 font-semibold">
                  {r.kind === 'branch' ? 'Branch' : `Table ${r.table_number}`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {r.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>

            <QrImage
              payload={r.payload}
              fg={r.foreground}
              bg={r.background}
              alt={`QR code for ${r.label}`}
              className="mx-auto mt-3 w-44 h-44"
            />

            <h3 className="mt-3 text-center font-semibold text-gray-800">{r.label}</h3>
            <p className="text-center text-xs text-gray-500">
              {r.branch.name} · {r.branch.code}
            </p>
            <p className="text-center text-[11px] text-gray-400 break-all mt-1">{r.payload}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <button type="button" onClick={() => openEdit(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                Edit
              </button>
              <button type="button" onClick={() => togglePaused(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                {r.is_active ? 'Pause' : 'Activate'}
              </button>
              <button type="button" onClick={() => downloadPng(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                PNG
              </button>
              <button type="button" onClick={() => downloadSvg(r)} className="border rounded py-1.5 font-semibold text-gray-700">
                SVG
              </button>
            </div>
          </article>
        ))}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit QR code' : 'New QR code'} onClose={() => setForm(null)}>
          <form onSubmit={saveForm} className="space-y-4">
            {!form.id && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
                  <select
                    required
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Choose a branch
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['branch', 'table'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, kind: k })}
                      className={`rounded border py-2 text-sm font-semibold ${
                        form.kind === k ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {k === 'branch' ? 'Branch menu' : 'Table'}
                    </button>
                  ))}
                </div>
                {form.kind === 'table' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Table number</label>
                    <input
                      required
                      value={form.table_number}
                      onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. 12"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={inputClass}
                placeholder="Defaults to the branch name"
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Caption under the code</label>
              <input
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                className={inputClass}
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-gray-700">
                Code colour
                <input
                  type="color"
                  value={form.foreground}
                  onChange={(e) => setForm({ ...form, foreground: e.target.value })}
                  className="mt-1 block h-10 w-full rounded border border-gray-300"
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Background
                <input
                  type="color"
                  value={form.background}
                  onChange={(e) => setForm({ ...form, background: e.target.value })}
                  className="mt-1 block h-10 w-full rounded border border-gray-300"
                />
              </label>
            </div>

            <div className="flex flex-col items-center bg-gray-50 rounded-lg p-4">
              {form.branch_id ? (
                <QrImage
                  payload={previewPayload}
                  fg={form.foreground}
                  bg={form.background}
                  alt="Preview"
                  className="w-40 h-40"
                />
              ) : (
                <p className="text-sm text-gray-500 py-12">Choose a branch to see the preview.</p>
              )}
              <p className="mt-2 text-sm font-semibold text-gray-800">{form.label || 'Label preview'}</p>
              <p className="text-xs text-gray-500">{form.caption}</p>
            </div>

            {formError && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="border rounded px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {tablesOpen && (
        <Modal title="Generate table codes" onClose={() => setTablesOpen(false)}>
          <form onSubmit={generateTables} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
              <select
                required
                value={tableRange.branch_id}
                onChange={(e) => setTableRange({ ...tableRange, branch_id: e.target.value })}
                className={inputClass}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">From table</label>
                <input type="number" min={1} required value={tableRange.from} onChange={(e) => setTableRange({ ...tableRange, from: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">To table</label>
                <input type="number" min={1} required value={tableRange.to} onChange={(e) => setTableRange({ ...tableRange, to: e.target.value })} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-gray-500">Up to 100 tables per run. Tables that already have a code are skipped.</p>
            {tableError && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{tableError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTablesOpen(false)} className="border rounded px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button type="submit" className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold">
                Generate
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
