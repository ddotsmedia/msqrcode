import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { CouponRedemption } from '../entities/coupon-redemption.entity';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread
export const COUPON_MINUTES = 10;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());

export interface CouponStaff {
  id?: string;
  role: string;
  assigned_branch_id?: string | null;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(CouponRedemption) private coupons: Repository<CouponRedemption>,
    @InjectRepository(Promotion) private promos: Repository<Promotion>,
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
  ) {}

  private async offer(id: unknown) {
    const p = typeof id === 'string' && UUID.test(id) ? await this.promos.findOne({ where: { id } }) : null;
    const d = today();
    if (!p || !p.is_active || !p.coupon_enabled || (p.starts_on && p.starts_on > d) || (p.ends_on && p.ends_on < d)) {
      throw new NotFoundException('This offer has no coupon right now');
    }
    return p;
  }

  private async newCode() {
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join('');
      if (!(await this.coupons.findOne({ where: { code, expires_at: MoreThan(new Date()) } }))) return code;
    }
    throw new Error('Could not create a coupon code');
  }

  // Customer: show a coupon for this offer. Needs the rewards card on this phone; one use per card.
  async issue(body: { promotion_id?: unknown; token?: unknown }) {
    const p = await this.offer(body?.promotion_id);
    const token = typeof body?.token === 'string' ? body.token.trim().slice(0, 128) : '';
    const card = token ? await this.cards.findOne({ where: { token } }) : null;
    if (!card) throw new BadRequestException('Join our free rewards to use coupons');
    let row = await this.coupons.findOne({ where: { promotion_id: p.id, card_id: card.id } });
    if (row?.redeemed_at) throw new BadRequestException('You have already used this coupon');
    const code = await this.newCode();
    const expires_at = new Date(Date.now() + COUPON_MINUTES * 60_000);
    row = row ? Object.assign(row, { code, expires_at }) : this.coupons.create({ promotion_id: p.id, card_id: card.id, code, expires_at });
    await this.coupons.save(row);
    return { code, expires_at, title: p.title, body: p.body, discount_percent: p.discount_percent, promo_code: p.promo_code };
  }

  // Customer: which offers this card has already used (to show "Used" on the page).
  async used(token: unknown) {
    const card = typeof token === 'string' && token ? await this.cards.findOne({ where: { token: token.slice(0, 128) } }) : null;
    if (!card) return [];
    const rows = await this.coupons.find({ where: { card_id: card.id } });
    return rows.filter((r) => r.redeemed_at).map((r) => r.promotion_id);
  }

  // Staff: scan or type the code at the counter. Each coupon works once, and only while its 10 minutes last.
  async redeem(body: { code?: unknown; branch_id?: unknown }, staff: CouponStaff) {
    const raw = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const code = raw.replace(/^MSQ-COUPON:/, '');
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new BadRequestException('That is not a coupon code');
    const rows = await this.coupons.find({ where: { code }, order: { expires_at: 'DESC' }, take: 1 });
    const row = rows[0];
    if (!row) throw new NotFoundException('Coupon not found');
    if (row.redeemed_at) throw new BadRequestException('This coupon was already used');
    if (row.expires_at.getTime() < Date.now()) throw new BadRequestException('This coupon has expired. Ask the customer to open it again.');
    const p = await this.promos.findOne({ where: { id: row.promotion_id } });
    if (!p || !p.is_active) throw new BadRequestException('This offer has ended');
    // Admins may say which branch; everyone else redeems for their own branch only.
    const branchId =
      staff.role === 'admin' ? (typeof body?.branch_id === 'string' && UUID.test(body.branch_id) ? body.branch_id : null) : (staff.assigned_branch_id ?? null);
    if (staff.role !== 'admin' && !branchId) throw new BadRequestException('Your account has no branch');
    if (p.branch_id && branchId && p.branch_id !== branchId) throw new BadRequestException('This offer is for another branch');
    row.redeemed_at = new Date();
    row.redeemed_branch_id = branchId;
    row.redeemed_by = staff.id && UUID.test(staff.id) ? staff.id : null;
    await this.coupons.save(row);
    const card = await this.cards.findOne({ where: { id: row.card_id } });
    return { ok: true, title: p.title, body: p.body, discount_percent: p.discount_percent, customer: card?.name || card?.phone || 'Customer' };
  }
}
