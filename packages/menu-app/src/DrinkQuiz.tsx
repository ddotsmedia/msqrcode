import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { recommend, type Kick, type QuizItem, type Taste, type Temp } from './lib/drinkQuiz';

type Product = QuizItem & { base_price: number | string; image_url?: string | null; category_id: string };

const QUESTIONS = [
  {
    key: 'temp',
    title: 'Hot or cold?',
    options: [
      ['hot', '☕', 'Hot'],
      ['iced', '🧊', 'Iced'],
      ['any', '🤷', 'Either'],
    ],
  },
  {
    key: 'taste',
    title: 'How do you like it?',
    options: [
      ['bold', '💪', 'Strong & bold'],
      ['milky', '🥛', 'Smooth & milky'],
      ['sweet', '🍯', 'Sweet treat'],
      ['light', '🍃', 'Light, not coffee'],
    ],
  },
  {
    key: 'kick',
    title: 'How much of a kick?',
    options: [
      ['high', '⚡', 'Wake me up'],
      ['some', '🙂', 'A little'],
      ['none', '😴', 'No caffeine'],
    ],
  },
] as const;

type Answers = { temp?: Temp; taste?: Taste; kick?: Kick };

// Public: three quick questions, then up to three drinks from the live menu.
export default function DrinkQuiz() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const step = QUESTIONS.findIndex((q) => !answers[q.key]);

  useEffect(() => {
    setPageTitle('Find your drink');
    setMetaDescription('Not sure what to order? Answer three quick questions and we will suggest a drink from the Milestones Coffee menu.');
    Promise.all([axios.get('/api/products'), axios.get('/api/categories')])
      .then(([p, c]) => {
        const cats = new Map<string, string>((Array.isArray(c.data) ? c.data : []).map((x: any) => [x.id, x.name]));
        setItems((Array.isArray(p.data) ? p.data : []).map((x: any) => ({ ...x, category: cats.get(x.category_id) ?? '' })));
      })
      .catch(() => setItems([]));
  }, []);

  const done = step === -1;
  const picks = done && items ? (recommend(items, answers.temp!, answers.taste!, answers.kick!) as Product[]) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">Not sure what to order?</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-brand-900">Find your drink</h1>
      </div>

      {!done ? (
        <section className="rounded-[20px] border border-brand-100 bg-white p-5 md:p-8">
          <div className="flex gap-1.5" aria-hidden="true">
            {QUESTIONS.map((q, i) => (
              <span key={q.key} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-copper-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <h2 className="mt-1 font-display text-2xl text-brand-900">{QUESTIONS[step].title}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUESTIONS[step].options.map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [QUESTIONS[step].key]: value }))}
                className="flex flex-col items-center gap-2 rounded-2xl border border-brand-100 bg-cream px-3 py-5 text-center font-semibold text-brand-900 transition hover:-translate-y-0.5 hover:border-copper-500"
              >
                <span className="text-3xl" aria-hidden="true">
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button type="button" onClick={() => setAnswers((a) => ({ ...a, [QUESTIONS[step - 1].key]: undefined }))} className="mt-5 text-sm font-semibold text-slate-500">
              ← Back
            </button>
          )}
        </section>
      ) : (
        <section className="space-y-4" aria-live="polite">
          <h2 className="font-display text-2xl text-brand-900">{picks.length ? 'We think you will love…' : 'Hmm, nothing matches exactly'}</h2>
          {items === null && <p className="text-slate-500">Loading the menu…</p>}
          {items && !picks.length && <p className="text-slate-600">Try different answers, or browse the full menu.</p>}
          <ul className="space-y-3">
            {picks.map((p, i) => (
              <li key={p.id}>
                <Link to={`/menu?item=${p.id}`} className={`flex items-center gap-4 rounded-[20px] bg-white p-4 transition hover:shadow-[0_12px_32px_rgba(10,26,51,0.10)] ${i === 0 ? 'ring-2 ring-copper-500' : 'border border-brand-100'}`}>
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-cream text-2xl" aria-hidden="true">
                      ☕
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {i === 0 && <span className="text-xs font-semibold uppercase tracking-wide text-copper-700">Best match</span>}
                    <span className="block font-display text-xl text-brand-900">{p.name}</span>
                    {p.description && <span className="block truncate text-sm text-slate-600">{p.description}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-brand-900">{Number(p.base_price).toFixed(2)} AED</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setAnswers({})} className="rounded-full border border-brand-100 bg-white px-5 py-2.5 font-semibold text-brand-700">
              Start again
            </button>
            <Link to="/menu" className="rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-900">
              See the full menu
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
