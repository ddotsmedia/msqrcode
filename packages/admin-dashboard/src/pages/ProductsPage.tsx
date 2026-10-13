import { useEffect, useState, type FormEvent } from 'react';
import { api, jsonBody } from '../api';
import { Field, Modal, type Category } from './CategoriesPage';

interface Choice {
  name: string;
  price_adjustment: number;
}

interface ChoiceGroup {
  id: string;
  name: string;
  display_order: number;
  options: { choices: Choice[] };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string;
  category?: Category;
  base_price: number | string;
  image_url: string | null;
  status: 'active' | 'inactive' | 'archived';
  display_order: number;
  is_new: boolean;
  is_popular: boolean;
  is_seasonal: boolean;
  dietary_tags: string[] | null;
  allergens: string[] | null;
  variants: ChoiceGroup[];
  option_groups: ChoiceGroup[];
}

// "Small:-0.5, Medium:0, Large:0.5" -> [{name, price_adjustment}]
export function parseChoices(text: string): Choice[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, adj] = part.split(':');
      return { name: name.trim(), price_adjustment: Number(adj ?? 0) || 0 };
    });
}

function listToText(values: string[] | null): string {
  return (values ?? []).join(', ');
}

function textToList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function ProductsPage({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([api<Product[]>('/admin/products', token), api<Category[]>('/admin/categories', token)])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [token]);

  async function archive(p: Product) {
    if (!window.confirm(`Archive "${p.name}"? It will be hidden from the menu.`)) return;
    try {
      await api(`/admin/products/${p.id}`, token, { method: 'DELETE' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-800">Products</h2>
        <button onClick={() => setEditing('new')} className="bg-brand-600 text-white rounded px-3 py-1.5 text-sm">
          New product
        </button>
      </div>
      {error && <p className="bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
      <ul className="divide-y">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{p.name}</p>
              <p className="text-xs text-gray-500">
                {p.sku} · {p.category?.name ?? 'No category'} · AED {Number(p.base_price).toFixed(2)} · {p.status}
              </p>
            </div>
            <div className="flex gap-3 text-sm shrink-0">
              <button onClick={() => setEditing(p)} className="text-brand-700 font-semibold">Edit</button>
              {p.status !== 'archived' && (
                <button onClick={() => archive(p)} className="text-red-600 font-semibold">Archive</button>
              )}
            </div>
          </li>
        ))}
        {products.length === 0 && <li className="px-4 py-3 text-gray-500">No products yet.</li>}
      </ul>

      {editing && (
        <ProductForm
          token={token}
          initial={editing === 'new' ? null : editing}
          categories={categories}
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

function ProductForm({
  token,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  token: string;
  initial: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    description: initial?.description ?? '',
    category_id: initial?.category_id ?? categories[0]?.id ?? '',
    base_price: initial ? String(Number(initial.base_price)) : '',
    image_url: initial?.image_url ?? '',
    status: initial?.status ?? 'active',
    display_order: String(initial?.display_order ?? 0),
    is_new: initial?.is_new ?? false,
    is_popular: initial?.is_popular ?? false,
    is_seasonal: initial?.is_seasonal ?? false,
    dietary_tags: listToText(initial?.dietary_tags ?? null),
    allergens: listToText(initial?.allergens ?? null),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        category_id: form.category_id,
        base_price: Number(form.base_price),
        image_url: form.image_url,
        status: form.status,
        display_order: Number(form.display_order),
        is_new: form.is_new,
        is_popular: form.is_popular,
        is_seasonal: form.is_seasonal,
        dietary_tags: textToList(form.dietary_tags),
        allergens: textToList(form.allergens),
      };
      if (initial) await api(`/admin/products/${initial.id}`, token, { method: 'PUT', body: jsonBody(body) });
      else await api('/admin/products', token, { method: 'POST', body: jsonBody(body) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'New product'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU"><input required className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
          <Field label="Base price (AED)">
            <input required type="number" min={0} step="0.01" className="input" value={form.base_price} onChange={(e) => set('base_price', e.target.value)} />
          </Field>
        </div>
        <Field label="Category">
          <select required className="input" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description"><textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Image URL"><input className="input" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as Product['status'])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Display order"><input type="number" min={0} className="input" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_new} onChange={(e) => set('is_new', e.target.checked)} /> New</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_popular} onChange={(e) => set('is_popular', e.target.checked)} /> Popular</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_seasonal} onChange={(e) => set('is_seasonal', e.target.checked)} /> Seasonal</label>
        </div>
        <Field label="Dietary tags (comma separated)">
          <input className="input" placeholder="vegan, gluten-free" value={form.dietary_tags} onChange={(e) => set('dietary_tags', e.target.value)} />
        </Field>
        <Field label="Allergens (comma separated)">
          <input className="input" placeholder="dairy, nuts" value={form.allergens} onChange={(e) => set('allergens', e.target.value)} />
        </Field>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={busy} className="w-full bg-brand-600 text-white rounded py-2 font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </form>

      {initial && (
        <div className="mt-6 space-y-6 border-t pt-4">
          <ChoiceEditor
            title="Sizes (variants)"
            token={token}
            basePath={`/admin/products/${initial.id}/variants`}
            groups={initial.variants}
            hint="Example: Small:-0.5, Medium:0, Large:0.5"
          />
          <ChoiceEditor
            title="Add-ons (options)"
            token={token}
            basePath={`/admin/products/${initial.id}/option-groups`}
            groups={initial.option_groups}
            hint="Example: Hot:0, Iced:0 or Oat milk:3"
          />
        </div>
      )}
    </Modal>
  );
}

function ChoiceEditor({
  title,
  token,
  basePath,
  groups,
  hint,
}: {
  title: string;
  token: string;
  basePath: string;
  groups: ChoiceGroup[];
  hint: string;
}) {
  const [name, setName] = useState('');
  const [choices, setChoices] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChoiceGroup[]>(groups);

  useEffect(() => setRows(groups), [groups]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api<ChoiceGroup>(basePath, token, {
        method: 'POST',
        body: jsonBody({ name, display_order: rows.length + 1, options: parseChoices(choices) }),
      });
      setRows((r) => [...r, created]);
      setName('');
      setChoices('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await api(`${basePath}/${id}`, token, { method: 'DELETE' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-gray-800">{title}</h4>
      <ul className="text-sm divide-y">
        {rows.map((g) => (
          <li key={g.id} className="flex justify-between gap-3 py-2">
            <span>
              <strong>{g.name}</strong>:{' '}
              {g.options.choices.map((c) => `${c.name} (${c.price_adjustment >= 0 ? '+' : ''}${c.price_adjustment})`).join(', ')}
            </span>
            <button onClick={() => remove(g.id)} className="text-red-600 shrink-0">Remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input required placeholder="Name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <input required placeholder={hint} className="input sm:col-span-2" value={choices} onChange={(e) => setChoices(e.target.value)} />
        <button className="bg-gray-800 text-white rounded py-2 text-sm sm:col-span-3">Add</button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
