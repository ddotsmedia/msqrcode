import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { GiftCard } from '../entities/gift-card.entity';
import { GiftCardUse } from '../entities/gift-card-use.entity';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread
export const DESIGNS = ['classic', 'birthday', 'eid', 'thanks'];
export const MIN_AMOUNT = 25;
export const MAX_AMOUNT = 2000;
const VALID_MONTHS = 12;

export interface GiftStaff {
  id?: string;
  role: string;
  assigned_branch_id?: string | null;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const money = (n: number) => Math.round(n * 100) / 100;
// Codes are shown as GIFT-XXXX-XXXX; QR codes carry MSQ-GIFT:<code>.
export const normCode = (raw: unknown) =>
  (typeof raw === 'string' ? raw : '').toUpperCase().replace(/^MSQ-GIFT:/, '').replace(/^GIFT/, '').replace(/[^A-Z0-9]/g, '');
const dubaiDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(d);

function amountOf(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT) throw new BadRequestException(`Choose an amount from AED ${MIN_AMOUNT} to ${MAX_AMOUNT}`);
  return money(n);
}

@Injectable()
export class GiftCardsService {
  constructor(
    @InjectRepository(GiftCard) private cards: Repository<GiftCard>,
    @InjectRepository(GiftCardUse) private uses: Repository<GiftCardUse>,
    private db: DataSource,
  ) {}

  private async newCode() {
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 8 }, () => CHARS[randomInt(CHARS.length)]).join('');
      if (!(await this.cards.findOne({ where: { code } }))) return code;
    }
    throw new Error('Could not create a gift card code');
  }

  private details(body: Record<string, unknown>) {
    const buyer_name = clean(body?.buyer_name, 60);
    if (!buyer_name) throw new BadRequestException('Please enter your name');
    const phone = clean(body?.buyer_phone, 20).replace(/[^\d+]/g, '');
    const design = DESIGNS.includes(String(body?.design)) ? String(body.design) : 'classic';
    return {
      amount: amountOf(body?.amount),
      buyer_name,
      buyer_phone: phone || null,
      recipient_name: clean(body?.recipient_name, 60) || null,
      message: clean(body?.message, 200) || null,
      design,
    };
  }

  // What anyone holding the code may see: no phone numbers.
  view(c: GiftCard) {
    return {
      code: c.code,
      amount: Number(c.amount),
      balance: Number(c.balance),
      status: c.status === 'active' && c.expires_on && c.expires_on < dubaiDate() ? 'expired' : c.status,
      design: c.design,
      from: c.buyer_name,
      to: c.recipient_name,
      message: c.message,
      expires_on: c.expires_on,
    };
  }

  // Customer: request a gift card online. It works once paid at any branch (staff scan it and take the money).
  async request(body: Record<string, unknown>) {
    const d = this.details(body);
    const buyerPhone = d.buyer_phone ?? '';
    if (buyerPhone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter your mobile number');
    const row = await this.cards.save(this.cards.create({ ...d, code: await this.newCode(), balance: String(d.amount), amount: String(d.amount), status: 'pending' }));
    return this.view(row);
  }

  async get(code: unknown) {
    const c = normCode(code);
    const row = c.length === 8 ? await this.cards.findOne({ where: { code: c } }) : null;
    if (!row) throw new NotFoundException('Gift card not found');
    return row;
  }

  async publicGet(code: unknown) {
    return this.view(await this.get(code));
  }

  private expiry() {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + VALID_MONTHS);
    return dubaiDate(d);
  }

  // Staff: sell a gift card at the counter (paid now, active at once).
  async issue(body: Record<string, unknown>, staff: GiftStaff) {
    const d = this.details(body);
    const row = await this.cards.save(
      this.cards.create({
        ...d,
        code: await this.newCode(),
        amount: String(d.amount),
        balance: String(d.amount),
        status: 'active',
        expires_on: this.expiry(),
        sold_branch_id: staff.assigned_branch_id ?? null,
        activated_by: staff.id ?? null,
        activated_at: new Date(),
      }),
    );
    return this.view(row);
  }

  // Staff: the customer paid for an online request at the counter.
  async activate(code: unknown, staff: GiftStaff) {
    const row = await this.get(code);
    if (row.status !== 'pending') throw new BadRequestException(row.status === 'active' ? 'This gift card is already active' : `This gift card is ${row.status}`);
    Object.assign(row, { status: 'active', expires_on: this.expiry(), sold_branch_id: staff.assigned_branch_id ?? null, activated_by: staff.id ?? null, activated_at: new Date() });
    return this.view(await this.cards.save(row));
  }

  // Staff: spend part or all of the balance. One SQL update, so two tills can never spend the same money twice.
  async redeem(code: unknown, amountRaw: unknown, staff: GiftStaff) {
    const row = await this.get(code);
    const amount = money(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter the amount to take from the card');
    if (row.status === 'pending') throw new BadRequestException('This gift card has not been paid for yet');
    if (row.status !== 'active') throw new BadRequestException(`This gift card is ${row.status}`);
    if (row.expires_on && row.expires_on < dubaiDate()) throw new BadRequestException(`This gift card expired on ${row.expires_on}`);
    if (staff.role !== 'admin' && !staff.assigned_branch_id) throw new ForbiddenException('Your account has no branch');
    return this.db.transaction(async (m) => {
      const res = await m.query(
        `UPDATE gift_cards SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'used' ELSE status END
         WHERE id = $2 AND status = 'active' AND balance >= $1 RETURNING balance`,
        [amount, row.id],
      );
      const updated = Array.isArray(res[0]) ? res[0] : res;
      if (!updated.length) {
        const now = await m.findOne(GiftCard, { where: { id: row.id } });
        throw new BadRequestException(`Only AED ${Number(now?.balance ?? 0).toFixed(2)} is left on this card`);
      }
      await m.save(m.create(GiftCardUse, { card_id: row.id, amount: String(amount), branch_id: staff.assigned_branch_id ?? null, staff_id: staff.id ?? null }));
      return { ok: true, taken: amount, balance: Number(updated[0].balance), to: row.recipient_name ?? row.buyer_name };
    });
  }

  async cancel(code: unknown) {
    const row = await this.get(code);
    if (row.status === 'cancelled') return this.view(row);
    row.status = 'cancelled';
    return this.view(await this.cards.save(row));
  }

  // Staff list: newest first, with how much each card has been spent.
  async list(status?: string) {
    const where = status && ['pending', 'active', 'used', 'cancelled'].includes(status) ? { status } : {};
    const rows = await this.cards.find({ where, order: { created_at: 'DESC' }, take: 200 });
    const uses = rows.length ? await this.uses.find({ where: { card_id: In(rows.map((r) => r.id)) }, order: { created_at: 'DESC' } }) : [];
    return rows.map((r) => ({
      ...this.view(r),
      buyer_phone: r.buyer_phone,
      created_at: r.created_at,
      activated_at: r.activated_at,
      uses: uses.filter((u) => u.card_id === r.id).map((u) => ({ amount: Number(u.amount), at: u.created_at })),
    }));
  }
}
