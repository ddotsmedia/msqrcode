import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';

const ROLES = [
  { id: 'barista', title: 'Barista', text: 'Make great coffee and look after our guests. Full training given, no experience needed.' },
  { id: 'shift_lead', title: 'Shift lead', text: 'Run the floor, guide the team and keep service smooth. Café experience preferred.' },
  { id: 'kitchen', title: 'Kitchen & bakery', text: 'Prepare our pastries, sandwiches and desserts fresh every day.' },
  { id: 'cashier', title: 'Cashier & host', text: 'Welcome guests, take orders and handle payments with a smile.' },
] as const;

const PERKS = ['Full barista training', 'Free coffee on shift', 'Growth to shift lead and manager', 'Branches across Abu Dhabi'];

const input = 'w-full rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none';

// Public page: open roles and a job application form with an optional CV.
export default function CareersPage() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ role: 'barista', name: '', phone: '', email: '', experience_years: '0', branch_id: '', message: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPageTitle('Careers');
    setMetaDescription('Join the Milestones Coffee team in Abu Dhabi: barista, shift lead, kitchen and cashier jobs with full training.');
    axios
      .get('/api/branches')
      .then((r) => setBranches(Array.isArray(r.data) ? r.data.filter((b: any) => b.status === 'active') : []))
      .catch(() => undefined);
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (cv && cv.size > 2 * 1024 * 1024) {
      setError('Your CV must be smaller than 2 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
    if (cv) data.append('cv', cv);
    try {
      await axios.post('/api/careers', data);
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : 'Could not send your application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-50 text-green-700">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-3xl text-brand-900">Thank you, {form.name.split(' ')[0]}!</h1>
        <p className="mt-2 text-slate-600">We have your application. If your profile fits an open role, our team will call you on {form.phone}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white md:px-12 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">Careers</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl tracking-tight md:text-5xl">
          Brew your career <em className="text-copper-300">with us.</em>
        </h1>
        <p className="mt-3 max-w-xl text-brand-100 md:text-lg">We are always looking for friendly people who love coffee and great service.</p>
        <a href="#apply" className="mt-6 inline-flex rounded-full bg-copper-500 px-6 py-3 font-semibold hover:bg-copper-700">
          Apply now
        </a>
      </section>

      <section>
        <h2 className="font-display text-2xl text-brand-900">Roles we hire for</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                set('role', r.id);
                document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`rounded-[20px] border bg-white p-6 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(10,26,51,0.10)] ${
                form.role === r.id ? 'border-copper-500 ring-1 ring-copper-500' : 'border-brand-100'
              }`}
            >
              <h3 className="font-display text-xl text-brand-900">{r.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{r.text}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-copper-700">Apply →</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-brand-900">Why Milestones</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 rounded-2xl bg-white p-4 text-slate-700">
              <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section id="apply" className="scroll-mt-24 rounded-[28px] border border-brand-100 bg-white p-6 md:p-10">
        <h2 className="font-display text-2xl text-brand-900">Apply</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Role</span>
            <select value={form.role} onChange={(e) => set('role', e.target.value)} className={input}>
              {[...ROLES, { id: 'other', title: 'Other' }].map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Preferred branch (optional)</span>
            <select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)} className={input}>
              <option value="">Any branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
            <input required maxLength={80} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Mobile number</span>
            <input required maxLength={20} inputMode="tel" autoComplete="tel" placeholder="05x xxx xxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email (optional)</span>
            <input type="email" maxLength={120} autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Years of café experience</span>
            <input type="number" min={0} max={40} value={form.experience_years} onChange={(e) => set('experience_years', e.target.value)} className={input} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-700">CV (optional, PDF or Word, up to 2 MB)</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setCv(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-semibold file:text-brand-700"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-700">About you (optional)</span>
            <textarea rows={3} maxLength={1000} placeholder="Languages you speak, when you can start, shifts you prefer…" value={form.message} onChange={(e) => set('message', e.target.value)} className={input} />
          </label>
          {error && <p className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="md:col-span-2">
            <button type="submit" disabled={busy} className="w-full rounded-full bg-brand-700 px-8 py-3.5 font-semibold text-white hover:bg-brand-900 disabled:opacity-60 md:w-auto">
              {busy ? 'Sending…' : 'Send application'}
            </button>
            <p className="mt-2 text-xs text-slate-500">We use your details only for hiring and delete CVs after six months.</p>
          </div>
        </form>
      </section>
    </div>
  );
}
