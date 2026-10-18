// Offers page helpers: when a timed offer is live or next starts, the weekly schedule, and calendar files.
// Times are Asia/Dubai (UTC+4, no daylight saving). Kept in step with lib/happyHour.ts.
import { isLive, type HappyHour } from './happyHour.ts';

export interface Offer extends HappyHour {
  id: string;
  body?: string | null;
  branch_id?: string | null;
  image_url?: string | null;
  promo_code?: string | null;
  featured?: boolean;
  theme?: string | null; // national_day | ramadan | eid | new_year
  combo_product_ids?: string[] | null; // combo deal: these items together…
  combo_price?: number | string | null; // …for this price (AED)
  coupon_enabled?: boolean; // redeemed with a one-time QR coupon
  created_at?: string;
}

const DUBAI = 4 * 3600_000;
const DAY = 864e5;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const isTimed = (o: Offer) => !!o.discount_percent;

// Today's date in Dubai, YYYY-MM-DD.
export const dubaiDate = (now = new Date()) => new Date(now.getTime() + DUBAI).toISOString().slice(0, 10);

function windowOf(o: Offer) {
  const start = o.start_time ? toMin(o.start_time) : 0;
  let end = o.end_time ? toMin(o.end_time) : 24 * 60;
  if (end <= start) end += 24 * 60; // past midnight
  return { start, end };
}

// For a timed offer: live until `until`, or next starts at `next` (within a week). Dated offers: neither.
export function timing(o: Offer, now = new Date()): { live: boolean; until: Date | null; next: Date | null } {
  if (!isTimed(o)) return { live: false, until: null, next: null };
  const { start, end } = windowOf(o);
  const days = (o.days ?? []).filter(Boolean);
  const local = new Date(now.getTime() + DUBAI);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DUBAI; // today 00:00 Dubai, as UTC ms
  for (let k = -1; k <= 8; k++) {
    const dayStart = midnight + k * DAY;
    const d = new Date(dayStart + DUBAI);
    const date = d.toISOString().slice(0, 10);
    if (days.length && !days.includes(String(d.getUTCDay()))) continue;
    if ((o.starts_on && o.starts_on > date) || (o.ends_on && o.ends_on < date)) continue;
    const from = dayStart + start * 60_000;
    const to = dayStart + end * 60_000;
    if (now.getTime() >= from && now.getTime() < to) return { live: true, until: new Date(to), next: null };
    if (from > now.getTime()) return { live: false, until: null, next: new Date(from) };
  }
  return { live: false, until: null, next: null };
}

// Live now: timed offers inside their window, plain offers valid today.
export function liveNow(o: Offer, now = new Date()) {
  if (isTimed(o)) return isLive(o, now);
  const d = dubaiDate(now);
  return (!o.starts_on || o.starts_on <= d) && (!o.ends_on || o.ends_on >= d);
}

// Whole days left until the end date (0 = ends today), or null.
export function daysLeft(o: Offer, now = new Date()) {
  if (!o.ends_on) return null;
  return Math.round((Date.parse(`${o.ends_on}T00:00:00Z`) - Date.parse(`${dubaiDate(now)}T00:00:00Z`)) / DAY);
}

// "1:05:09" / "12:09" countdown text.
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// "Today 15:00", "Tomorrow 15:00" or "Tue 15:00", in Dubai time.
export function whenLabel(at: Date, now = new Date()) {
  const a = new Date(at.getTime() + DUBAI);
  const diff = Math.round((Date.parse(a.toISOString().slice(0, 10)) - Date.parse(dubaiDate(now))) / DAY);
  const hm = a.toISOString().slice(11, 16);
  return `${diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : DAY_NAMES[a.getUTCDay()]} ${hm}`;
}

export interface Segment {
  offer: Offer;
  from: number; // minutes 0..1440
  to: number;
}

// Weekly schedule: for each weekday (0 = Sunday) the time segments of timed offers, overnight windows split.
export function weekGrid(offers: Offer[]): Segment[][] {
  const grid: Segment[][] = Array.from({ length: 7 }, () => []);
  for (const o of offers.filter(isTimed)) {
    const { start, end } = windowOf(o);
    const days = (o.days ?? []).filter(Boolean);
    for (let d = 0; d < 7; d++) {
      if (days.length && !days.includes(String(d))) continue;
      grid[d].push({ offer: o, from: start, to: Math.min(end, 1440) });
      if (end > 1440) grid[(d + 1) % 7].push({ offer: o, from: 0, to: end - 1440 });
    }
  }
  grid.forEach((row) => row.sort((a, b) => a.from - b.from));
  return grid;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

// An .ics calendar file: a weekly repeating event for happy hours, an all-day event span for dated offers.
export function icsFor(o: Offer, url: string, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Milestones Coffee//Offers//EN', 'BEGIN:VEVENT', `UID:${o.id}@coffeesales.ae`, `DTSTAMP:${icsDate(now)}`];
  const t = timing(o, now);
  if (isTimed(o) && (t.next || t.until)) {
    const { start, end } = windowOf(o);
    const first = t.next ?? new Date(t.until!.getTime() - (end - start) * 60_000);
    lines.push(`DTSTART:${icsDate(first)}`, `DTEND:${icsDate(new Date(first.getTime() + (end - start) * 60_000))}`);
    const days = (o.days ?? []).filter(Boolean);
    const by = days.length ? `;BYDAY=${days.map((d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][Number(d)]).join(',')}` : '';
    lines.push(`RRULE:FREQ=${days.length ? 'WEEKLY' : 'DAILY'}${by}${o.ends_on ? `;UNTIL=${o.ends_on.replace(/-/g, '')}T235959Z` : ''}`);
  } else {
    const from = (o.starts_on ?? dubaiDate(now)).replace(/-/g, '');
    const to = new Date(Date.parse(`${o.ends_on ?? o.starts_on ?? dubaiDate(now)}T00:00:00Z`) + DAY).toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${from}`, `DTEND;VALUE=DATE:${to}`);
  }
  lines.push(`SUMMARY:${icsText(`Milestones: ${o.title}`)}`, `DESCRIPTION:${icsText(`${o.body ?? ''}${o.promo_code ? `\nCode: ${o.promo_code}` : ''}\n${url}`)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
