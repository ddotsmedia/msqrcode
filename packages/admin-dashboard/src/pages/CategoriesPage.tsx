import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, jsonBody } from '../api';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export default function CategoriesPage({ token }: { token: string }) {
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<Category[]>('/admin/categories', token)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [token]);

  async function archive(c: Category) {
    if (!window.confirm(`Deactivate category "${c.name}"?`)) return;
    try {
      await api(`/admin/categories/${c.id}`, token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-800">Categories</h2>
        <button onClick={() => setEditing('new')} className="bg-brand-600 text-white rounded px-3 py-1.5 text-sm">
          New category
        </button>
      </div>
      {error && <p className="bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
      <ul className="divide-y">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-500">
                Order {c.display_order} · {c.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setEditing(c)} className="text-brand-700 font-semibold">Edit</button>
              {c.is_active && (
                <button onClick={() => archive(c)} className="text-red-600 font-semibold">Deactivate</button>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-3 text-gray-500">No categories.</li>}
      </ul>

      {editing && (
        <CategoryForm
          token={token}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function CategoryForm({
  token,
  initial,
  onClose,
  onSaved,
}: {
  token: string;
  initial: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [order, setOrder] = useState(String(initial?.display_order ?? 0));
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name, description, display_order: Number(order), is_active: active };
      if (initial) await api(`/admin/categories/${initial.id}`, token, { method: 'PUT', body: jsonBody(body) });
      else await api('/admin/categories', token, { method: 'POST', body: jsonBody(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <Field label="Description"><input value={description ?? ''} onChange={(e) => setDescription(e.target.value)} className="input" /></Field>
        <Field label="Display order"><input type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={busy} className="w-full bg-brand-600 text-white rounded py-2 font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-semibold text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 text-xl leading-none" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
