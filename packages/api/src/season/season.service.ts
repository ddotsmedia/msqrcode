import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeasonSettings } from '../entities/season-settings.entity';
import { Branch } from '../entities/branch.entity';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dubaiToday = (now = Date.now()) => new Date(now + 4 * 3600_000).toISOString().slice(0, 10);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function ramadanActive(s: Pick<SeasonSettings, 'ramadan_enabled' | 'ramadan_starts_on' | 'ramadan_ends_on'> | null, now = Date.now()) {
  if (!s?.ramadan_enabled) return false;
  const d = dubaiToday(now);
  return (!s.ramadan_starts_on || s.ramadan_starts_on <= d) && (!s.ramadan_ends_on || s.ramadan_ends_on >= d);
}

@Injectable()
export class SeasonService {
  // Branch lists are fetched on every page, so keep the settings for a minute.
  private cache: { at: number; value: SeasonSettings } | null = null;

  constructor(@InjectRepository(SeasonSettings) private settings: Repository<SeasonSettings>) {}

  async get(): Promise<SeasonSettings> {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache.value;
    const row =
      (await this.settings.findOne({ where: { id: 1 } })) ??
      this.settings.create({ id: 1, ramadan_enabled: false, ramadan_starts_on: null, ramadan_ends_on: null, greeting: 'Ramadan Kareem', note: null, featured_category_ids: null });
    this.cache = { at: Date.now(), value: row };
    return row;
  }

  // Public: what the site should show right now.
  async publicSeason() {
    const s = await this.get();
    if (!ramadanActive(s)) return { ramadan: null };
    return {
      ramadan: {
        greeting: s.greeting,
        note: s.note,
        ends_on: s.ramadan_ends_on,
        featured_category_ids: (s.featured_category_ids ?? []).filter(Boolean),
      },
    };
  }

  // While Ramadan is on, branches with Ramadan hours show those as their opening hours.
  async applyToBranch<T extends Branch>(b: T): Promise<T & { ramadan?: boolean }> {
    const s = await this.get();
    if (!ramadanActive(s) || !b.ramadan_hours) return b;
    return { ...b, operating_hours: b.ramadan_hours, ramadan: true };
  }

  async update(body: Record<string, unknown>) {
    const s = await this.get();
    const starts = clean(body.ramadan_starts_on, 10) || null;
    const ends = clean(body.ramadan_ends_on, 10) || null;
    if ((starts && !DATE.test(starts)) || (ends && !DATE.test(ends))) throw new BadRequestException('Dates must be YYYY-MM-DD');
    if (starts && ends && ends < starts) throw new BadRequestException('The end date is before the start date');
    s.ramadan_enabled = body.ramadan_enabled === true;
    if (s.ramadan_enabled && (!starts || !ends)) throw new BadRequestException('Set the first and last day of Ramadan');
    s.ramadan_starts_on = starts;
    s.ramadan_ends_on = ends;
    s.greeting = clean(body.greeting, 120) || 'Ramadan Kareem';
    s.note = clean(body.note, 300) || null;
    const cats = Array.isArray(body.featured_category_ids) ? [...new Set(body.featured_category_ids.map(String).filter((c) => UUID.test(c)))].slice(0, 20) : [];
    s.featured_category_ids = cats.length ? cats : null;
    const saved = await this.settings.save(s);
    this.cache = null;
    return { ...saved, active: ramadanActive(saved) };
  }

  async adminGet() {
    const s = await this.get();
    return { ...s, active: ramadanActive(s) };
  }
}
