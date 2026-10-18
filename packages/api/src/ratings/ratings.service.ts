import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { ProductRating } from '../entities/product-rating.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_WITHIN_MS = 7 * 864e5;
// "Most loved": enough votes in the last 90 days and most of them thumbs up.
const LOVED_DAYS = 90;
const LOVED_MIN_VOTES = 5;
const LOVED_MIN_SHARE = 0.8;
const CACHE_MS = 5 * 60_000;

@Injectable()
export class RatingsService {
  private cache: { at: number; data: { product_id: string; percent: number; votes: number }[] } | null = null;

  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(ProductRating) private ratings: Repository<ProductRating>,
  ) {}

  // Public: rate an item from an order the customer collected. Needs the order's private token; a second vote replaces the first.
  async rate(id: string, body: { token?: unknown; product_id?: unknown; up?: unknown }) {
    if (!UUID.test(id) || typeof body?.token !== 'string' || !body.token) throw new NotFoundException('Order not found');
    const order = await this.orders.findOne({ where: { id }, relations: ['items'] });
    if (!order || order.access_token !== body.token) throw new NotFoundException('Order not found');
    if (order.status !== 'completed') throw new BadRequestException('You can rate your order once you have collected it');
    if (Date.now() - new Date(order.created_at).getTime() > RATE_WITHIN_MS) throw new BadRequestException('This order is too old to rate');
    const productId = typeof body.product_id === 'string' ? body.product_id : '';
    if (!(order.items ?? []).some((i) => i.product_id === productId)) throw new BadRequestException('That item is not in this order');
    if (typeof body.up !== 'boolean') throw new BadRequestException('Choose thumbs up or down');
    const existing = await this.ratings.findOne({ where: { order_id: id, product_id: productId } });
    await this.ratings.save(existing ? { ...existing, up: body.up } : this.ratings.create({ order_id: id, product_id: productId, up: body.up }));
    this.cache = null;
    return { ok: true };
  }

  // Public: items most customers liked recently.
  async loved() {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.data;
    const rows: { product_id: string; votes: string; ups: string }[] = await this.ratings
      .createQueryBuilder('r')
      .select('r.product_id', 'product_id')
      .addSelect('COUNT(*)', 'votes')
      .addSelect('SUM(CASE WHEN r.up THEN 1 ELSE 0 END)', 'ups')
      .where({ created_at: MoreThanOrEqual(new Date(Date.now() - LOVED_DAYS * 864e5)) })
      .groupBy('r.product_id')
      .getRawMany();
    const data = rows
      .map((r) => ({ product_id: r.product_id, votes: Number(r.votes), percent: Math.round((Number(r.ups) / Number(r.votes)) * 100) }))
      .filter((r) => r.votes >= LOVED_MIN_VOTES && r.percent >= LOVED_MIN_SHARE * 100)
      .sort((a, b) => b.percent - a.percent || b.votes - a.votes);
    this.cache = { at: Date.now(), data };
    return data;
  }
}
