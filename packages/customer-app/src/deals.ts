// Offers, happy hour and combo deals, worked out on the phone with the same rules as the website and the order server.
export type Promo = {
  id: string;
  title: string;
  body: string | null;
  discount_percent: number | null;
  category_ids: string[] | null;
  days: string[] | null;
  start_time: string | null;
  end_time: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  combo_product_ids: string[] | null;
  combo_price: number | string | null;
  promo_code: string | null;
};

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

function dubaiClock(now: Date) {
  const d = new Date(now.getTime() + 4 * 3600_000); // UAE has no daylight saving
  return { date: d.toISOString().slice(0, 10), day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function isLive(p: Promo, now = new Date()) {
  if (!p.discount_percent || p.is_active === false) return false;
  const c = dubaiClock(now);
  if ((p.starts_on && p.starts_on > c.date) || (p.ends_on && p.ends_on < c.date)) return false;
  const start = p.start_time ? toMin(p.start_time) : 0;
  const end = p.end_time ? toMin(p.end_time) : 24 * 60;
  const overnight = end <= start;
  if (overnight ? !(c.min >= start || c.min < end) : !(c.min >= start && c.min < end)) return false;
  const day = overnight && c.min < end ? (c.day + 6) % 7 : c.day;
  const days = (p.days ?? []).filter(Boolean);
  return !days.length || days.includes(String(day));
}

// Biggest live discount for a product's category (happy hour), if any.
export function bestDealFor(promos: Promo[], categoryId: string, now = new Date()): Promo | null {
  let best: Promo | null = null;
  for (const p of promos) {
    if (!isLive(p, now)) continue;
    if (p.category_ids?.length && !p.category_ids.includes(categoryId)) continue;
    if (!best || (p.discount_percent ?? 0) > (best.discount_percent ?? 0)) best = p;
  }
  return best;
}

export const discounted = (price: number, percent: number) => Math.round(price * (100 - percent)) / 100;

export const comboPrice = (p: Promo) => (p.combo_price == null ? null : Number(p.combo_price));
