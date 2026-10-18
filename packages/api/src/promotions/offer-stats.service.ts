import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { OfferEvent } from '../entities/offer-event.entity';
import { Promotion } from '../entities/promotion.entity';
import { CouponRedemption } from '../entities/coupon-redemption.entity';
import { Order } from '../entities/order.entity';
import { OfferReminder } from '../entities/offer-reminder.entity';

export const OFFER_EVENTS = ['view', 'code_copy', 'share', 'calendar', 'order_click', 'coupon_open', 'combo_add'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 30;

@Injectable()
export class OfferStatsService {
  constructor(
    @InjectRepository(OfferEvent) private events: Repository<OfferEvent>,
    @InjectRepository(Promotion) private promos: Repository<Promotion>,
    @InjectRepository(CouponRedemption) private coupons: Repository<CouponRedemption>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OfferReminder) private reminders: Repository<OfferReminder>,
  ) {}

  // Public: the Offers page sends a small batch of counts. Unknown offers and types are dropped.
  async record(body: { events?: unknown }) {
    const list = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : [];
    const wanted = list
      .map((e: any) => ({ promotion_id: String(e?.promotion_id ?? ''), type: String(e?.type ?? '') }))
      .filter((e) => UUID.test(e.promotion_id) && (OFFER_EVENTS as readonly string[]).includes(e.type));
    if (!wanted.length) return { saved: 0 };
    const ids = [...new Set(wanted.map((e) => e.promotion_id))];
    const known = new Set((await this.promos.find({ where: { id: In(ids) }, select: ['id'] })).map((p) => p.id));
    const rows = wanted.filter((e) => known.has(e.promotion_id)).map((e) => this.events.create(e));
    if (rows.length) await this.events.save(rows);
    return { saved: rows.length };
  }

  // Admin: per offer, what visitors did in the last N days, plus coupon redemptions and combo orders.
  async stats(daysRaw: unknown) {
    const days = Number(daysRaw ?? 30);
    if (![7, 30, 90].includes(days)) throw new BadRequestException('Choose 7, 30 or 90 days');
    const since = new Date(Date.now() - days * 864e5);
    const [counts, promos, redeemed, orders, reminders] = await Promise.all([
      this.events
        .createQueryBuilder('e')
        .select('e.promotion_id', 'promotion_id')
        .addSelect('e.type', 'type')
        .addSelect('COUNT(*)', 'n')
        .where({ created_at: MoreThanOrEqual(since) })
        .groupBy('e.promotion_id')
        .addGroupBy('e.type')
        .getRawMany<{ promotion_id: string; type: string; n: string }>(),
      this.promos.find({ order: { created_at: 'DESC' } }),
      this.coupons
        .createQueryBuilder('c')
        .select('c.promotion_id', 'promotion_id')
        .addSelect('COUNT(*)', 'n')
        .where('c.redeemed_at >= :since', { since })
        .groupBy('c.promotion_id')
        .getRawMany<{ promotion_id: string; n: string }>(),
      this.orders.find({ where: { created_at: MoreThanOrEqual(since) }, select: ['id', 'discounts', 'status'] }),
      this.reminders.find({ select: ['promotion_id'] }),
    ]);
    const comboOrders = new Map<string, { orders: number; saved: number }>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      for (const d of o.discounts ?? []) {
        const c = comboOrders.get(d.title) ?? { orders: 0, saved: 0 };
        comboOrders.set(d.title, { orders: c.orders + 1, saved: Math.round((c.saved + Number(d.amount)) * 100) / 100 });
      }
    }
    const rows = promos.map((p) => {
      const of = (t: string) => Number(counts.find((c) => c.promotion_id === p.id && c.type === t)?.n ?? 0);
      const views = of('view');
      const actions = of('order_click') + of('coupon_open') + of('combo_add');
      return {
        id: p.id,
        title: p.title,
        is_active: p.is_active,
        views,
        code_copies: of('code_copy'),
        shares: of('share'),
        calendar: of('calendar'),
        order_clicks: of('order_click'),
        coupon_opens: of('coupon_open'),
        combo_adds: of('combo_add'),
        reminders: reminders.filter((r) => r.promotion_id === p.id).length,
        redemptions: Number(redeemed.find((r) => r.promotion_id === p.id)?.n ?? 0),
        combo_orders: p.combo_price ? (comboOrders.get(p.title)?.orders ?? 0) : 0,
        combo_saved: p.combo_price ? (comboOrders.get(p.title)?.saved ?? 0) : 0,
        // Share of views that led to "Order now", "Use coupon" or "Add combo".
        action_rate: views ? Math.round((actions / views) * 1000) / 10 : 0,
      };
    });
    return { days, rows };
  }
}
