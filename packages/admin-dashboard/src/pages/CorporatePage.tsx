import { useEffect, useState } from 'react';
import { api } from '../api';

interface Invoice {
  id: string;
  number: string;
  month: string;
  order_count: number;
  total: number;
  vat: number;
  status: string;
  issued_at: string;
}
interface Account {
  id: string;
  company: string;
  trn: string | null;
  contact_name: string;
  email: string;
  phone: string;
  address: string | null;
  team_size: number | null;
  message: string | null;
  status: 'pending' | 'active' | 'paused' | 'rejected';
  credit_limit: number;
  access_token: string | null;
  notes: string | null;
  unbilled: number;
  created_at: string;
  invoices: Invoice[];
}

const MENU_URL = ((import.meta.env.VITE_MENU_URL as string | undefined) ?? 'https://coffeesales.ae').replace(/\/$/, '');
const aed = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BADGE: Record<Account['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
};
// Last month in Dubai, YYYY-MM: the usual month to invoice.
const lastMonth = () => {
  const d = new Date(Date.now() + 4 * 3600_000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

// Admin: business accounts — approve applications, credit limits, monthly tax invoices.
export default function CorporatePage({ token }: { token: string }) {
  const [rows, setRows] = useState<Account[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(lastMonth());

  const load = () =>
    api<Account[]>('/admin/corporate', token)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg(ok);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (a: Account, body: Record<string, unknown>, ok: string) =>
    act(() => api(`/admin/corporate/${a.id}`, token, { method: 'PATCH', body: JSON.stringify(body) }), ok);

  const pending = rows.filter((r) => r.status === 'pending').length;
  const owed = rows.reduce((s, r) => s + r.invoices.filter((i) => i.status === 'unpaid').reduce((t, i) => t + i.total, 0), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Business accounts</h2>
          <p className="text-sm text-gray-500">
            {pending} waiting for approval · unpaid invoices {aed(owed)}
          </p>
        </div>
        <label className="text-sm text-gray-600">
          Invoice month{' '}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5" />
        </label>
      </div>
      {error && <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {msg && (
        <p role="status" className="rounded bg-green-50 p-3 text-sm font-semibold text-green-800">
          {msg}
        </p>
      )}
      {!rows.length && <p className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">No applications yet. Companies apply at {MENU_URL.replace(/^https?:\/\//, '')}/business.</p>}
      {rows.map((a) => {
        const link = a.access_token ? `${MENU_URL}/business/${a.access_token}` : null;
        const isOpen = open === a.id;
        return (
          <section key={a.id} className="rounded-lg bg-white p-4 shadow-sm">
            <button type="button" onClick={() => setOpen(isOpen ? null : a.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={isOpen}>
              <span>
                <span className="font-semibold text-gray-900">{a.company}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${BADGE[a.status]}`}>{a.status}</span>
                <span className="block text-sm text-gray-500">
                  {a.contact_name} · {a.email} · {a.phone}
                </span>
              </span>
              {a.status !== 'pending' && (
                <span className="text-right text-sm">
                  <span className="block font-semibold tabular-nums">{aed(a.unbilled)} not invoiced</span>
                  <span className="text-gray-500">limit {aed(a.credit_limit)}</span>
                </span>
              )}
            </button>
            {isOpen && (
              <div className="mt-4 space-y-4 border-t pt-4 text-sm">
                <div className="grid gap-1 sm:grid-cols-2">
                  <p>TRN: {a.trn ?? '—'}</p>
                  <p>Team size: {a.team_size ?? '—'}</p>
                  <p className="sm:col-span-2">Address: {a.address ?? '—'}</p>
                  {a.message && <p className="rounded bg-gray-50 p-2 sm:col-span-2">“{a.message}”</p>}
                  <p className="text-gray-500">Applied {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.status !== 'active' && (
                    <button type="button" disabled={busy} onClick={() => patch(a, { status: 'active' }, `${a.company} approved. Send them their link.`)} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                      {a.status === 'paused' ? 'Resume' : 'Approve'}
                    </button>
                  )}
                  {a.status === 'active' && (
                    <button type="button" disabled={busy} onClick={() => patch(a, { status: 'paused' }, `Ordering paused for ${a.company}.`)} className="rounded border px-3 py-1.5 font-semibold disabled:opacity-50">
                      Pause ordering
                    </button>
                  )}
                  {a.status === 'pending' && (
                    <button type="button" disabled={busy} onClick={() => patch(a, { status: 'rejected' }, 'Application declined.')} className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700 disabled:opacity-50">
                      Decline
                    </button>
                  )}
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    patch(a, { credit_limit: Number(f.get('limit')), trn: String(f.get('trn') ?? ''), notes: String(f.get('notes') ?? '') }, 'Saved.');
                  }}
                >
                  <label>
                    Credit limit (AED)
                    <input name="limit" type="number" min={0} step={100} defaultValue={a.credit_limit} className="mt-1 block w-32 rounded border border-gray-300 px-2 py-1.5" />
                  </label>
                  <label>
                    TRN
                    <input name="trn" defaultValue={a.trn ?? ''} maxLength={20} className="mt-1 block w-44 rounded border border-gray-300 px-2 py-1.5" />
                  </label>
                  <label className="flex-1">
                    Notes (staff only)
                    <input name="notes" defaultValue={a.notes ?? ''} maxLength={500} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5" />
                  </label>
                  <button type="submit" disabled={busy} className="rounded bg-brand-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                    Save
                  </button>
                </form>
                {link && (
                  <div className="rounded bg-brand-50 p-3">
                    <p className="font-semibold text-brand-900">Company link (team orders and invoices)</p>
                    <p className="break-all font-mono text-xs">{link}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg('Link copied.'), () => undefined)} className="rounded border bg-white px-3 py-1 text-xs font-semibold">
                        Copy link
                      </button>
                      <a href={`mailto:${a.email}?subject=${encodeURIComponent('Your Milestones Coffee business account')}&body=${encodeURIComponent(`Hello ${a.contact_name},\n\nYour business account is ready. Your team can order ahead for pickup here, and you will find your monthly invoices on the same page:\n${link}\n\nMilestones Coffee`)}`} className="rounded border bg-white px-3 py-1 text-xs font-semibold">
                        Email it
                      </a>
                      <button
                        type="button"
                        onClick={() => window.confirm('Make a new link? The old link stops working on every phone.') && patch(a, { new_link: true }, 'New link created. Send it to the company.')}
                        className="rounded border bg-white px-3 py-1 text-xs font-semibold text-red-700"
                      >
                        New link
                      </button>
                    </div>
                  </div>
                )}
                {a.status !== 'pending' && a.status !== 'rejected' && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-gray-800">Invoices</p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(() => api(`/admin/corporate/${a.id}/invoices`, token, { method: 'POST', body: JSON.stringify({ month }) }), `Invoice for ${month} created.`)}
                        className="rounded bg-brand-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                      >
                        Invoice collected orders up to {month}
                      </button>
                    </div>
                    <table className="mt-2 w-full text-left">
                      <tbody>
                        {a.invoices.map((i) => (
                          <tr key={i.id} className="border-t">
                            <td className="py-1.5">
                              {link ? (
                                <a href={`${link}/invoice/${i.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                                  {i.number}
                                </a>
                              ) : (
                                i.number
                              )}
                            </td>
                            <td>{i.month}</td>
                            <td>{i.order_count} orders</td>
                            <td className="tabular-nums">{aed(i.total)}</td>
                            <td>
                              <span className={`text-xs font-bold uppercase ${i.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>{i.status}</span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  act(
                                    () => api(`/admin/corporate/invoices/${i.id}/paid`, token, { method: 'POST', body: JSON.stringify({ paid: i.status !== 'paid' }) }),
                                    i.status === 'paid' ? `${i.number} marked unpaid.` : `${i.number} marked paid.`,
                                  )
                                }
                                className="text-xs font-semibold text-brand-700 underline"
                              >
                                {i.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!a.invoices.length && (
                          <tr>
                            <td className="py-2 text-gray-500">No invoices yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
