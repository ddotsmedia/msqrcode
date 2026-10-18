import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { setMetaDescription, setPageTitle } from './lib/seo';
import { Icon } from './lib/Icon';

// Home brew guides: ratio calculator + step timer. Add a guide by appending to GUIDES.
interface Step {
  text: string;
  seconds?: number; // a timed step
}
interface Guide {
  slug: string;
  name: string;
  tagline: string;
  time: string;
  grind: string;
  water: string;
  ratio: number; // grams of water per gram of coffee
  coffee: number; // default grams of coffee
  unit?: string; // what "water" means for this guide
  extra?: string;
  steps: Step[];
  tip: string;
}

const GUIDES: Guide[] = [
  {
    slug: 'v60',
    name: 'Pour-over (V60)',
    tagline: 'Clean, bright and sweet. Shows off a light or medium roast.',
    time: '3 min',
    grind: 'Medium-fine, like table salt',
    water: '93–96°C, just off the boil',
    ratio: 16.7,
    coffee: 15,
    steps: [
      { text: 'Rinse the paper filter with hot water and pour that water away. Add the coffee and level the bed.' },
      { text: 'Bloom: pour about twice the coffee weight in water, enough to wet all the grounds. Wait.', seconds: 40 },
      { text: 'Pour slowly in circles until you reach 60% of the water.', seconds: 35 },
      { text: 'Pour the rest in slow circles, keeping the level steady.', seconds: 30 },
      { text: 'Let it drain. It should finish around 3 minutes in total.', seconds: 75 },
    ],
    tip: 'If it tastes sour, grind a little finer. If it tastes bitter or dry, grind a little coarser.',
  },
  {
    slug: 'french-press',
    name: 'French press',
    tagline: 'Rich and full-bodied. Hard to get wrong.',
    time: '5 min',
    grind: 'Coarse, like sea salt',
    water: '94°C',
    ratio: 15,
    coffee: 30,
    steps: [
      { text: 'Warm the press with hot water and pour it away. Add the coffee.' },
      { text: 'Pour all the water, make sure every ground is wet, put the lid on with the plunger up. Steep.', seconds: 240 },
      { text: 'Stir the crust gently and scoop off the foam from the top.' },
      { text: 'Press the plunger down slowly, then pour straight away so it does not over-brew.' },
    ],
    tip: 'Pour all of it out once pressed. Coffee left sitting on the grounds turns bitter.',
  },
  {
    slug: 'cold-brew',
    name: 'Cold brew',
    tagline: 'Smooth and low in bitterness. Perfect for UAE summers.',
    time: '12–18 hours',
    grind: 'Coarse',
    water: 'Cold or room temperature',
    ratio: 8,
    coffee: 100,
    unit: 'concentrate',
    extra: 'This makes a concentrate. Mix 1 part concentrate with 1 part water or milk over ice.',
    steps: [
      { text: 'Add coffee and water to a jar and stir until all the grounds are wet.' },
      { text: 'Cover and leave in the fridge for 12 to 18 hours.' },
      { text: 'Strain through a paper filter or a fine cloth.' },
      { text: 'Keep the concentrate in the fridge for up to a week. Dilute 1:1 to serve.' },
    ],
    tip: 'Longer steeping gives a stronger, heavier taste. Start at 14 hours and adjust.',
  },
  {
    slug: 'moka-pot',
    name: 'Moka pot',
    tagline: 'Strong and espresso-like, made on the stove.',
    time: '5 min',
    grind: 'Fine, a little coarser than espresso',
    water: 'Hot water in the base, up to the valve',
    ratio: 10,
    coffee: 18,
    steps: [
      { text: 'Fill the base with hot water up to the valve.' },
      { text: 'Fill the basket with coffee and level it. Do not press it down.' },
      { text: 'Screw it together and put it on medium-low heat with the lid open.', seconds: 180 },
      { text: 'When the coffee starts to gurgle and turns pale, take it off the heat right away.' },
    ],
    tip: 'Starting with hot water means the coffee spends less time on the heat and tastes less burnt.',
  },
  {
    slug: 'arabic-coffee',
    name: 'Arabic coffee (Gahwa)',
    tagline: 'Light roast coffee with cardamom, served with dates.',
    time: '20 min',
    grind: 'Medium, light-roast Arabic coffee',
    water: '1 litre, boiling',
    ratio: 33,
    coffee: 30,
    extra: 'For 1 litre: about 30 g coffee (3 tablespoons), 1 tablespoon ground cardamom and, if you like, a pinch of saffron or 2 cloves.',
    steps: [
      { text: 'Bring the water to the boil in a dallah or small pot. Add the coffee.' },
      { text: 'Boil gently, uncovered.', seconds: 600 },
      { text: 'Turn off the heat and let the grounds settle.', seconds: 120 },
      { text: 'Add the cardamom (and saffron or cloves), stir and simmer on low heat.', seconds: 180 },
      { text: 'Rest so the grounds settle again, then pour into a thermos without the grounds.', seconds: 120 },
      { text: 'Serve a little in each finjan with dates.' },
    ],
    tip: 'Pour only a few sips per cup. Guests shake the cup gently when they have had enough.',
  },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function BrewGuidesPage() {
  useEffect(() => {
    setPageTitle('Brew guides');
    setMetaDescription('How to brew great coffee at home: V60, French press, cold brew, moka pot and Arabic coffee, with ratios and a step timer.');
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-700">At home</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-brand-900">Brew guides</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Make café-quality coffee at home. Each guide has a ratio calculator and a step-by-step timer.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              to={`/brew/${g.slug}`}
              className="flex h-full flex-col rounded-[20px] border border-brand-100 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(10,26,51,0.10)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name="coffee" />
              </span>
              <h2 className="mt-4 font-display text-xl text-brand-900">{g.name}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{g.tagline}</p>
              <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-copper-700">
                <Icon name="clock" className="h-4 w-4" /> {g.time}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrewGuidePage() {
  const { slug = '' } = useParams();
  const g = GUIDES.find((x) => x.slug === slug);
  const [coffee, setCoffee] = useState(g?.coffee ?? 15);
  const [step, setStep] = useState(-1); // -1 = not started
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!g) return;
    setPageTitle(`${g.name} brew guide`);
    setMetaDescription(`${g.name}: ${g.tagline} Ratio, grind, water and step-by-step timer.`);
    setCoffee(g.coffee);
    setStep(-1);
    setRunning(false);
    // HowTo structured data for search engines.
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to brew ${g.name}`,
      description: g.tagline,
      step: g.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s.text })),
    });
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [slug]);

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [running]);

  // Timed step finished: buzz and move on.
  useEffect(() => {
    if (running && left === 0) {
      setRunning(false);
      navigator.vibrate?.(300);
    }
  }, [left, running]);

  if (!g) {
    return (
      <p>
        Guide not found.{' '}
        <Link to="/brew" className="font-semibold text-brand-700 underline">
          See all brew guides
        </Link>
      </p>
    );
  }

  const water = Math.round(coffee * g.ratio);
  const go = (i: number) => {
    setStep(i);
    const s = g.steps[i]?.seconds ?? 0;
    setLeft(s);
    setRunning(s > 0);
  };
  const done = step >= g.steps.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/brew" className="text-sm font-semibold text-brand-700">
        ← All brew guides
      </Link>
      <div>
        <h1 className="font-display text-4xl tracking-tight text-brand-900">{g.name}</h1>
        <p className="mt-2 text-slate-600">{g.tagline}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Time', g.time],
          ['Grind', g.grind],
          ['Water', g.water],
          ['Ratio', `1 : ${g.ratio}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-1 font-medium text-brand-900">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-[20px] border border-brand-100 bg-white p-5">
        <h2 className="font-display text-xl text-brand-900">How much?</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Coffee</span>
            <input
              type="number"
              min={1}
              max={500}
              value={coffee}
              onChange={(e) => setCoffee(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="w-24 rounded-xl border border-brand-100 px-3 py-2 text-lg font-semibold"
              aria-label="Coffee in grams"
            />
            <span className="text-slate-500">g</span>
          </label>
          <span className="text-slate-400">→</span>
          <p className="text-lg">
            <span className="font-semibold text-brand-900">
              {water} {g.slug === 'arabic-coffee' ? 'ml' : 'g'}
            </span>{' '}
            <span className="text-slate-500">water{g.unit ? ` (${g.unit})` : ''}</span>
          </p>
        </div>
        {g.extra && <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-brand-900">{g.extra}</p>}
      </section>

      <section className="rounded-[20px] border border-brand-100 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-brand-900">Steps</h2>
          {step === -1 ? (
            <button type="button" onClick={() => go(0)} className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">
              Start brewing
            </button>
          ) : (
            <button type="button" onClick={() => go(-1)} className="text-sm font-semibold text-slate-500">
              Reset
            </button>
          )}
        </div>
        <ol className="mt-4 space-y-3">
          {g.steps.map((s, i) => {
            const active = i === step;
            const past = step > i;
            return (
              <li
                key={i}
                aria-current={active ? 'step' : undefined}
                className={`flex gap-3 rounded-2xl p-3 ${active ? 'bg-brand-50 ring-2 ring-brand-700' : past ? 'opacity-60' : ''}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${past ? 'bg-green-600 text-white' : active ? 'bg-brand-700 text-white' : 'bg-cream text-brand-900'}`}
                >
                  {past ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </span>
                <div className="flex-1 pt-1">
                  <p className="text-slate-800">{s.text}</p>
                  {s.seconds && !active && <p className="mt-1 text-xs font-semibold text-slate-500">{fmt(s.seconds)}</p>}
                  {active && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {s.seconds ? (
                        <>
                          <span role="timer" aria-live="off" className="font-display text-3xl tabular-nums text-brand-900">
                            {fmt(left)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRunning((r) => !r)}
                            disabled={left === 0}
                            className="rounded-full border border-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 disabled:opacity-40"
                          >
                            {running ? 'Pause' : 'Resume'}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => go(i + 1)}
                        className="rounded-full bg-copper-500 px-4 py-2 text-sm font-semibold text-white hover:bg-copper-700"
                      >
                        {i === g.steps.length - 1 ? 'Finish' : 'Next step'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {done && <p className="mt-4 rounded-2xl bg-green-50 p-4 text-center font-semibold text-green-800">Enjoy your coffee! ☕</p>}
      </section>

      <p className="rounded-2xl bg-cream p-4 text-sm text-brand-900">
        <span className="font-semibold">Tip: </span>
        {g.tip}
      </p>

      <div className="rounded-[20px] bg-brand-900 p-6 text-white">
        <p className="font-display text-xl">Rather we make it?</p>
        <p className="mt-1 text-brand-100">Order ahead and pick it up at your nearest branch.</p>
        <Link to="/branches" className="mt-4 inline-flex rounded-full bg-copper-500 px-5 py-2.5 font-semibold hover:bg-copper-700">
          Find a branch
        </Link>
      </div>
    </div>
  );
}
