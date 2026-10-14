import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Promotion } from '../entities/promotion.entity';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const row = this.promos.create({
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
