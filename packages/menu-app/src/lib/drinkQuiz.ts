// "Find your drink": scores menu items against three answers using their names, category and nutrition.
export type Temp = 'hot' | 'iced' | 'any';
export type Taste = 'bold' | 'milky' | 'sweet' | 'light';
export type Kick = 'high' | 'some' | 'none';
export interface QuizItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  status?: string;
  is_popular?: boolean;
  nutritional_info?: { caffeine_mg?: number; sugar_g?: number } | null;
}

const has = (re: RegExp, s: string) => re.test(s);
const FOOD = /pastr|food|bak|dessert|sandwich|croissant|muffin|cake|cookie|biscotti/;
const ICED = /iced|cold|frapp|shake|smoothie|lemonade|mojito|frozen/;
const BOLD = /espresso|americano|ristretto|macchiato|cortado|black|v60|filter|drip|cold brew|turkish|arabic|gahwa/;
const MILKY = /latte|cappuccino|flat white|cortado|milk|karak|piccolo/;
const SWEET = /mocha|caramel|vanilla|hazelnut|chocolate|spanish|frapp|honey|pistachio|saffron|lotus|date/;
const LIGHT = /tea|matcha|chamomile|herbal|juice|lemonade|hot chocolate|smoothie/;
const COFFEE = /coffee|espresso|americano|latte|cappuccino|flat white|macchiato|mocha|cortado|brew|v60/;
const NO_CAFF = /decaf|herbal|chamomile|juice|lemonade|smoothie|hot chocolate|milkshake/;
const STRONG = /double|espresso|americano|cold brew|ristretto|turkish/;

export function score(p: QuizItem, temp: Temp, taste: Taste, kick: Kick) {
  const s = `${p.name} ${p.description ?? ''} ${p.category ?? ''}`.toLowerCase();
  if (has(FOOD, s) && !has(/drink|beverage|coffee|tea/, `${p.name} ${p.category ?? ''}`.toLowerCase())) return -Infinity;
  const caff = p.nutritional_info?.caffeine_mg;
  const sugar = p.nutritional_info?.sugar_g;
  const iced = has(ICED, s);
  let n = 0;
  if (temp === 'hot') n += iced ? -6 : 2;
  if (temp === 'iced') n += iced ? 4 : -6;
  if (taste === 'bold') n += (has(BOLD, s) ? 4 : 0) - (has(SWEET, s) ? 2 : 0) - (has(MILKY, s) ? 1 : 0);
  if (taste === 'milky') n += has(MILKY, s) ? 4 : 0;
  if (taste === 'sweet') n += (has(SWEET, s) ? 4 : 0) + (typeof sugar === 'number' && sugar >= 20 ? 2 : 0);
  if (taste === 'light') n += (has(LIGHT, s) ? 4 : 0) - (has(COFFEE, s) ? 3 : 0);
  if (kick === 'none') n += has(NO_CAFF, s) || caff === 0 ? 5 : has(COFFEE, s) || has(/tea|matcha/, s) ? -8 : 0;
  if (kick === 'high') n += (has(STRONG, s) ? 3 : 0) + (typeof caff === 'number' && caff >= 150 ? 2 : 0) + (has(LIGHT, s) && !has(/matcha/, s) ? -2 : 0);
  if (p.is_popular) n += 1;
  return n;
}

export function recommend(items: QuizItem[], temp: Temp, taste: Taste, kick: Kick, max = 3) {
  return items
    .filter((p) => (p.status ?? 'active') === 'active')
    .map((p) => ({ p, n: score(p, temp, taste, kick) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name))
    .slice(0, max)
    .map((x) => x.p);
}
