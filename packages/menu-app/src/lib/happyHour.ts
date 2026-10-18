// Happy hour: an offer with a % discount, live on chosen days between two Dubai times
// (a window past midnight belongs to the day it started). Kept in step with api/src/promotions/happy-hour.ts.
export interface HappyHour {
  title: string;
  discount_percent: number | null;
  category_ids?: string[] | null;
  days?: string[] | null; // '0' = Sunday … '6' = Saturday; empty = every day
  start_time?: string | null; // 'HH:MM'
  end_time?: string | null;
  starts_on?: string | null; // 'YYYY-MM-DD'
  ends_on?: string | null;
  is_active?: boolean;
}

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

function dubaiClock(now: Date) {
  const d = new Date(now.getTime() + 4 * 3600_000); // UAE has no daylight saving
  return { date: d.toISOString().slice(0, 10), day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function isLive(p: HappyHour, now = new Date()) {
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

// The biggest live discount for a product's category, if any.
export function bestDiscount(promos: HappyHour[], categoryId: string | null | undefined, now = new Date()) {
  let best: { percent: number; title: string; until: string | null } | null = null;
  for (const p of promos) {
    const cats = (p.category_ids ?? []).filter(Boolean);
    if (!isLive(p, now) || (cats.length && !cats.includes(String(categoryId)))) continue;
    if (!best || p.discount_percent! > best.percent) best = { percent: p.discount_percent!, title: p.title, until: p.end_time ?? null };
  }
  return best;
}

export const discounted = (price: number, percent: number) => Math.round(price * (100 - percent)) / 100;
