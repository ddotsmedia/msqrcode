import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';

interface BranchLite {
  id: string;
  name: string;
  whatsapp_number?: string | null;
}

const KINDS = [
  { id: 'office', title: 'Office coffee', icon: 'coffee', text: 'Coffee and pastries for meetings, trainings and team mornings, delivered and set up.' },
  { id: 'event', title: 'Events & weddings', icon: 'gift', text: 'A barista team serving specialty coffee to your guests, from 20 to 2,000 people.' },
  { id: 'cart', title: 'Coffee cart', icon: 'nav', text: 'Our mobile coffee bar at your venue, launch or exhibition stand, fully branded.' },
] as const;

const STEPS = ['Tell us about your event', 'We call you within one working day with a quote', 'We set up, serve and clear away'];

const input = 'w-full rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none';
// '2026-11-01' -> '1 Nov 2026'
const nice = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : d);
const today = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);

// Public page: catering, events and coffee-cart enquiries.
export default function CateringPage() {
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [form, setForm] = useState({ kind: 'office', name: '', phone: '', email: '', company: '', event_date: '', guests: '30', location: '', branch_id: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPageTitle('Catering & coffee cart');
    setMetaDescription('Milestones Coffee catering for offices, events and weddings, and our mobile coffee cart across Abu Dhabi.');
    axios
      .get('/api/branches')
      .then((r) => setBranches(Array.isArray(r.data) ? r.data : []))
      .catch(() => undefined);
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await axios.post('/api/catering', { ...form, guests: Number(form.guests), branch_id: form.branch_id || undefined });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(typeof m === 'string' ? m : 'Could not send your request. Please try again or call us.');
    } finally {
      setBusy(false);
    }
  }

  // WhatsApp follow-up goes to the chosen branch, or the first branch that has WhatsApp.
  const wa = (branches.find((b) => b.id === form.branch_id && b.whatsapp_number) ?? branches.find((b) => b.whatsapp_number))?.whatsapp_number?.replace(/\D/g, '');
  const kindTitle = KINDS.find((k) => k.id === form.kind)?.title ?? 'Catering';
  const waText = `Hello Milestones, I just sent a ${kindTitle.toLowerCase()} request on your website: ${form.guests} guests on ${nice(form.event_date)}${form.location ? ` at ${form.location}` : ''}. My name is ${form.name}.`;

  if (sent) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-50 text-green-700">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-3xl text-brand-900">Thank you, {form.name.split(' ')[0]}!</h1>
        <p className="mt-2 text-slate-600">We have your {kindTitle.toLowerCase()} request for {nice(form.event_date)}. Our team will call you on {form.phone} within one working day.</p>
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-full bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
          >
            Also message us on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white md:px-12 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">Catering & coffee cart</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl tracking-tight md:text-5xl">
          Great coffee, <em className="text-copper-300">wherever you gather.</em>
        </h1>
        <p className="mt-3 max-w-xl text-brand-100 md:text-lg">Offices, weddings, launches and majlis gatherings across the UAE. Tell us what you need and we will send a quote.</p>
        <a href="#request" className="mt-6 inline-flex rounded-full bg-copper-500 px-6 py-3 font-semibold hover:bg-copper-700">
          Request a quote
        </a>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              set('kind', k.id);
              document.getElementById('request')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`rounded-[20px] border bg-white p-6 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(10,26,51,0.10)] ${
              form.kind === k.id ? 'border-copper-500 ring-1 ring-copper-500' : 'border-brand-100'
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={k.icon} />
            </span>
            <h2 className="mt-4 font-display text-xl text-brand-900">{k.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{k.text}</p>
          </button>
        ))}
      </section>

      <section>
        <h2 className="font-display text-2xl text-brand-900">How it works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-start gap-3 rounded-2xl bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-copper-500 text-sm font-bold text-white">{i + 1}</span>
              <span className="pt-1 text-slate-700">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="request" className="scroll-mt-24 rounded-[28px] border border-brand-100 bg-white p-6 md:p-10">
        <h2 className="font-display text-2xl text-brand-900">Request a quote</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-700">What do you need?</span>
            <div className="flex flex-wrap gap-2">
              {[...KINDS, { id: 'other', title: 'Something else' }].map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={form.kind === k.id}
                  onClick={() => set('kind', k.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${form.kind === k.id ? 'border-brand-700 bg-brand-700 text-white' : 'border-brand-100 text-brand-700'}`}
                >
                  {k.title}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Your name</span>
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
            <span className="mb-1 block text-sm font-semibold text-slate-700">Company (optional)</span>
            <input maxLength={120} autoComplete="organization" value={form.company} onChange={(e) => set('company', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Date</span>
            <input required type="date" min={today()} value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Number of guests</span>
            <input required type="number" min={5} max={5000} value={form.guests} onChange={(e) => set('guests', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Location (optional)</span>
            <input maxLength={120} placeholder="e.g. Al Reem Island" value={form.location} onChange={(e) => set('location', e.target.value)} className={input} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Nearest branch (optional)</span>
            <select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)} className={input}>
              <option value="">No preference</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Anything else? (optional)</span>
            <textarea rows={3} maxLength={1000} placeholder="Drinks you have in mind, timings, branding…" value={form.message} onChange={(e) => set('message', e.target.value)} className={input} />
          </label>
          {error && <p className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="md:col-span-2">
            <button type="submit" disabled={busy} className="w-full rounded-full bg-brand-700 px-8 py-3.5 font-semibold text-white hover:bg-brand-900 disabled:opacity-60 md:w-auto">
              {busy ? 'Sending…' : 'Send request'}
            </button>
            <p className="mt-2 text-xs text-slate-500">We only use your details to reply to this request.</p>
          </div>
        </form>
      </section>
    </div>
  );
}
