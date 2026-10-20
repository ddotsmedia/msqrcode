// Home brew guides (same content as the website). ratio = grams of water per gram of coffee.
export interface Step {
  text: string;
  seconds?: number;
}
export interface Guide {
  slug: string;
  name: string;
  tagline: string;
  time: string;
  grind: string;
  water: string;
  ratio: number;
  coffee: number;
  unit?: string;
  extra?: string;
  steps: Step[];
  tip: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'v60', name: 'Pour-over (V60)', tagline: 'Clean, bright and sweet. Shows off a light or medium roast.', time: '3 min',
    grind: 'Medium-fine, like table salt', water: '93–96°C, just off the boil', ratio: 16.7, coffee: 15,
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
    slug: 'french-press', name: 'French press', tagline: 'Rich and full-bodied. Hard to get wrong.', time: '5 min',
    grind: 'Coarse, like sea salt', water: '94°C', ratio: 15, coffee: 30,
    steps: [
      { text: 'Warm the press with hot water and pour it away. Add the coffee.' },
      { text: 'Pour all the water, make sure every ground is wet, put the lid on with the plunger up. Steep.', seconds: 240 },
      { text: 'Stir the crust gently and scoop off the foam from the top.' },
      { text: 'Press the plunger down slowly, then pour straight away so it does not over-brew.' },
    ],
    tip: 'Pour all of it out once pressed. Coffee left sitting on the grounds turns bitter.',
  },
  {
    slug: 'cold-brew', name: 'Cold brew', tagline: 'Smooth and low in bitterness. Perfect for UAE summers.', time: '12–18 hours',
    grind: 'Coarse', water: 'Cold or room temperature', ratio: 8, coffee: 100, unit: 'concentrate',
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
    slug: 'moka-pot', name: 'Moka pot', tagline: 'Strong and espresso-like, made on the stove.', time: '5 min',
    grind: 'Fine, a little coarser than espresso', water: 'Hot water in the base, up to the valve', ratio: 10, coffee: 18,
    steps: [
      { text: 'Fill the base with hot water up to the valve.' },
      { text: 'Fill the basket with coffee and level it. Do not press it down.' },
      { text: 'Screw it together and put it on medium-low heat with the lid open.', seconds: 180 },
      { text: 'When the coffee starts to gurgle and turns pale, take it off the heat right away.' },
    ],
    tip: 'Starting with hot water means the coffee spends less time on the heat and tastes less burnt.',
  },
  {
    slug: 'arabic-coffee', name: 'Arabic coffee (Gahwa)', tagline: 'Light roast coffee with cardamom, served with dates.', time: '20 min',
    grind: 'Medium, light-roast Arabic coffee', water: '1 litre, boiling', ratio: 33, coffee: 30,
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
