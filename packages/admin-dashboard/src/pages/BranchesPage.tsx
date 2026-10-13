import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';

export interface BranchRow {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  status: string;
}

interface BranchForm {
  id: string | null;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  status: 'active' | 'inactive';
}

const TIMEZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat'];
const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

const EMPTY: BranchForm = { id: null, name: '', address: '', phone: '', timezone: 'Asia/Dubai', status: 'active' };

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

export default function BranchesPage({ token, onQrCreated }: { token: string; onQrCreated: () => void }) {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api<BranchRow[]>('/admin/branches', token)
      .then((list) => {
        setBranches(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  function openNew() {
    setFormError(null);
    setForm({ ...EMPTY });
  }

  function openEdit(b: BranchRow) {
    setFormError(null);
    setForm({
      id: b.id,
      name: b.name,
      address: b.address ?? '',
      phone: b.phone ?? '',
      timezone: b.timezone || 'Asia/Dubai',
      status: b.status === 'inactive' ? 'inactive' : 'active',
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    const body = JSON.stringify({
      name: form.name,
      address: form.address,
      phone: form.phone,
      timezone: form.timezone,
      status: form.status,
    });
    try {
      if (form.id) {
        await api(`/admin/branches/${form.id}`, token, { method: 'PUT', body });
        setNotice(`${form.name} updated.`);
      } else {
        await api('/admin/branches', token, { method: 'POST', body });
        setNotice(`${form.name} added. Its branch QR code is ready in the QR codes tab.`);
        onQrCreated();
      }
      setForm(null);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Branches</h2>
          <p className="text-sm text-gray-500">Add a branch by name. A QR code is created for it automatically.</p>
        </div>
        <button type="button" onClick={openNew} className="bg-brand-600 text-white rounded px-3 py-2 text-sm font-semibold">
          Add branch
        </button>
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
      {loading && <p className="text-gray-500 text-sm">Loading branches…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {branches.map((b) => (
          <article key={b.id} className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-800">{b.name}</h3>
                <p className="text-xs text-gray-500">{b.code}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  b.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {b.status === 'active' ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{b.address || 'No address yet'}</p>
            <p className="text-sm text-gray-500">{b.phone || 'No phone yet'} · {b.timezone}</p>
            <button type="button" onClick={() => openEdit(b)} className="mt-3 text-brand-700 text-sm font-semibold">
              Edit details
            </button>
          </article>
        ))}
      </div>

      {!loading && branches.length === 0 && (
        <p className="text-gray-500 text-sm bg-white rounded-xl border p-6 text-center">No branches yet. Add your first branch.</p>
      )}

      {form && (
        <Modal title={form.id ? 'Edit branch' : 'Add branch'} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Branch name</label>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. Milestones Marina Walk"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
              <input
                maxLength={255}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  maxLength={20}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Timezone</label>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={inputClass}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                className={inputClass}
              >
                <option value="active">Open (shown to customers)</option>
                <option value="inactive">Closed (hidden from customers)</option>
              </select>
            </div>
            {!form.id && <p className="text-xs text-gray-500">Opening hours default to 08:00–22:00 every day. You can change these later.</p>}

            {formError && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="border rounded px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-brand-600 text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
