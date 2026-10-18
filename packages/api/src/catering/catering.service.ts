import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { CateringRequest, CateringKind, CateringStatus } from '../entities/catering-request.entity';
import { Branch } from '../entities/branch.entity';

const KINDS: CateringKind[] = ['office', 'event', 'cart', 'other'];
const STATUSES: CateringStatus[] = ['new', 'contacted', 'closed'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Same phone can send at most this many enquiries a day; the whole site at most this many new ones a day.
const PER_PHONE_DAY = 3;
const PER_DAY = 100;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const dubaiToday = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);

@Injectable()
export class CateringService {
  constructor(
    @InjectRepository(CateringRequest) private requests: Repository<CateringRequest>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
  ) {}

  // Public: catering / coffee-cart enquiry from the website.
  async create(body: Record<string, unknown>) {
    const kind = KINDS.find((k) => k === body.kind) ?? 'other';
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 20).replace(/[^\d+]/g, '');
    const email = clean(body.email, 120).toLowerCase();
    const date = clean(body.event_date, 10);
    const guests = Math.floor(Number(body.guests));
    if (!name) throw new BadRequestException('Please enter your name');
    if (phone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter a mobile number we can call');
    if (email && !EMAIL.test(email)) throw new BadRequestException('That email address does not look right');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < dubaiToday()) throw new BadRequestException('Choose the date of your event (today or later)');
    if (!(guests >= 5 && guests <= 5000)) throw new BadRequestException('Guests must be between 5 and 5000');
    const branchId = typeof body.branch_id === 'string' && UUID.test(body.branch_id) ? body.branch_id : null;
    if (branchId && !(await this.branches.findOne({ where: { id: branchId } }))) throw new BadRequestException('Choose a branch from the list');

    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const [byPhone, all] = await Promise.all([
      this.requests.count({ where: { phone, created_at: MoreThanOrEqual(dayAgo) } }),
      this.requests.count({ where: { created_at: MoreThanOrEqual(dayAgo) } }),
    ]);
    if (byPhone >= PER_PHONE_DAY) throw new BadRequestException('We already have your request. Our team will call you soon.');
    if (all >= PER_DAY) throw new BadRequestException('Please call or WhatsApp us to book catering today.');

    const saved = await this.requests.save(
      this.requests.create({
        kind,
        name,
        phone,
        email: email || null,
        company: clean(body.company, 120) || null,
        event_date: date,
        guests,
        location: clean(body.location, 120) || null,
        branch_id: branchId,
        message: clean(body.message, 1000) || null,
      }),
    );
    return { ok: true, id: saved.id };
  }

  // Staff: newest first, open ones before closed.
  async list(statusRaw?: unknown) {
    const status = STATUSES.filter((s) => s === statusRaw);
    const rows = await this.requests.find({
      where: status.length ? { status: In(status) } : undefined,
      order: { created_at: 'DESC' },
      take: 200,
    });
    return { new: rows.filter((r) => r.status === 'new').length, rows };
  }

  async setStatus(id: string, statusRaw: unknown) {
    const status = STATUSES.find((s) => s === statusRaw);
    if (!status) throw new BadRequestException('Unknown status');
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    row.status = status;
    await this.requests.save(row);
    return { ok: true, status };
  }
}
