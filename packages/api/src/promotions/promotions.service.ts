import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Promotion } from '../entities/promotion.entity';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE_RE = /^[A-Z0-9-]{3,20}$/;
export const THEMES = ['national_day', 'ramadan', 'eid', 'new_year'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function today(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
}

@Injectable()
export class PromotionsService {
  constructor(@InjectRepository(Promotion) private promos: Repository<Promotion>) {}

  // Public: active offers that apply to all branches or to the given branch, valid today.
  async listActive(branchId?: string) {
    const d = today();
    const rows = await this.promos.find({
      where: [
        { is_active: true, branch_id: IsNull() },
        ...(branchId ? [{ is_active: true, branch_id: branchId }] : []),
      ],
      order: { created_at: 'DESC' },
    });
    return rows.filter((p) => (!p.starts_on || p.starts_on <= d) && (!p.ends_on || p.ends_on >= d));
  }

  // Admin: all offers, newest first.
  listAll(branchId?: string) {
    return this.promos.find({
      where: branchId ? [{ branch_id: branchId }, { branch_id: IsNull() }] : undefined,
      order: { created_at: 'DESC' },
    });
  }

  async create(body: Record<string, unknown>) {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!title) throw new BadRequestException('Title is required');
    const starts = typeof body.starts_on === 'string' && body.starts_on ? body.starts_on : null;
    const ends = typeof body.ends_on === 'string' && body.ends_on ? body.ends_on : null;
    if ((starts && !DATE_RE.test(starts)) || (ends && !DATE_RE.test(ends))) {
      throw new BadRequestException('Dates must be YYYY-MM-DD');
    }
    if (starts && ends && ends < starts) throw new BadRequestException('End date is before start date');

    // Optional happy-hour pricing.
    let pricing: Partial<Promotion> = {};
    if (body.discount_percent !== undefined && body.discount_percent !== null && body.discount_percent !== '') {
      const pct = Number(body.discount_percent);
      if (!Number.isInteger(pct) || pct < 1 || pct > 90) throw new BadRequestException('Discount must be a whole number from 1 to 90');
      const start = typeof body.start_time === 'string' && body.start_time ? body.start_time : null;
      const end = typeof body.end_time === 'string' && body.end_time ? body.end_time : null;
      if ((start && !TIME_RE.test(start)) || (end && !TIME_RE.test(end))) throw new BadRequestException('Times must be HH:MM');
      if (start && end && start === end) throw new BadRequestException('Start and end time are the same');
      const days = Array.isArray(body.days) ? [...new Set(body.days.map(String).filter((d) => /^[0-6]$/.test(d)))].sort() : [];
      const cats = Array.isArray(body.category_ids) ? [...new Set(body.category_ids.map(String).filter((c) => UUID.test(c)))].slice(0, 50) : [];
      pricing = { discount_percent: pct, start_time: start, end_time: end, days: days.length ? days : null, category_ids: cats.length ? cats : null };
    }
    const image = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    if (image && !/^https:\/\/[^\s"'<>]{4,490}$/.test(image)) throw new BadRequestException('Image must be an https:// link');
    const code = typeof body.promo_code === 'string' ? body.promo_code.trim().toUpperCase() : '';
    if (code && !CODE_RE.test(code)) throw new BadRequestException('Code must be 3 to 20 letters, numbers or dashes');
    // Optional combo: 2 to 4 different products sold together for one price.
    let combo: Partial<Promotion> = {};
    if (Array.isArray(body.combo_product_ids) && body.combo_product_ids.length) {
      const ids = [...new Set(body.combo_product_ids.map(String).filter((c) => UUID.test(c)))];
      const price = Number(body.combo_price);
      if (ids.length < 2 || ids.length > 4) throw new BadRequestException('A combo needs 2 to 4 different items');
      if (!(price > 0 && price < 1000)) throw new BadRequestException('Combo price must be between 1 and 999 AED');
      combo = { combo_product_ids: ids, combo_price: Math.round(price * 100) / 100 };
    }
    const row = this.promos.create({
      ...pricing,
      ...combo,
      image_url: image || null,
      promo_code: code || null,
      featured: body.featured === true,
      theme: THEMES.find((t) => t === body.theme) ?? null,
      title,
      body: typeof body.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 500) : null,
      branch_id: typeof body.branch_id === 'string' && body.branch_id ? body.branch_id : null,
      starts_on: starts,
      ends_on: ends,
      is_active: true,
    });
    return this.promos.save(row);
  }

  async setActive(id: string, body: Record<string, unknown>) {
    const row = await this.promos.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Offer not found');
    row.is_active = body.is_active === true;
    return this.promos.save(row);
  }
}
