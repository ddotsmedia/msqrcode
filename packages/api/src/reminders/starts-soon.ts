// When does a happy hour next start (Dubai time), if within the next two days? Used for "Remind me".
export interface Timed {
  discount_percent?: number | null;
  days?: string[] | null;
  start_time?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  is_active?: boolean;
}
const DUBAI = 4 * 3600_000;
const DAY = 864e5;

export function nextStart(p: Timed, now = new Date()): Date | null {
  if (!p.discount_percent || p.is_active === false || !p.start_time) return null; // all-day deals have no start to remind about
  const start = Number(p.start_time.slice(0, 2)) * 60 + Number(p.start_time.slice(3, 5));
  const days = (p.days ?? []).filter(Boolean);
  const local = new Date(now.getTime() + DUBAI);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DUBAI;
  for (let k = 0; k <= 2; k++) {
    const at = midnight + k * DAY + start * 60_000;
    const d = new Date(midnight + k * DAY + DUBAI);
    const date = d.toISOString().slice(0, 10);
    if (at <= now.getTime()) continue;
    if (days.length && !days.includes(String(d.getUTCDay()))) continue;
    if ((p.starts_on && p.starts_on > date) || (p.ends_on && p.ends_on < date)) continue;
    return new Date(at);
  }
  return null;
}
