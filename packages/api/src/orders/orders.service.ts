import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Branch } from '../entities/branch.entity';
import { BranchProductPrice } from '../entities/branch-product-price.entity';
import { ProductAvailability } from '../entities/product-availability.entity';
import { dubaiNow } from '../loyalty/loyalty.service';
import { Promotion } from '../entities/promotion.entity';
import { LoyaltyCard } from '../entities/loyalty-card.entity';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { bestDiscount, discounted } from '../promotions/happy-hour';

export interface StaffUser {
  id: string;
  role: string;
  assigned_branch_id?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE = /^[\w-]{1,20}$/;
const OPEN = ['placed', 'preparing', 'ready'] as const;
// Staff move an order forward one step at a time (or cancel it).
const NEXT: Record<string, string[]> = {
  placed: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
};
const MAX_LINES = 30;
const MAX_QTY = 20;
// Limits so a script (or a bored child) cannot flood the counter screen.
const MAX_OPEN_PER_TABLE = 3;
const MAX_OPEN_PER_BRANCH = 60;
const MAX_OPEN_PER_PHONE = 3;
// Pickup orders per 15-minute slot, so the bar is not swamped at one time.
const MAX_PER_SLOT = 10;
const SLOT_MS = 15 * 60_000;

type Choice = { name: string; price_adjustment: number };
type Group = { id: string; name: string; options?: { choices?: Choice[] } | null };

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
    @InjectRepository(BranchProductPrice) private prices: Repository<BranchProductPrice>,
    @InjectRepository(ProductAvailability) private availability: Repository<ProductAvailability>,
    @InjectRepository(Promotion) private promotions: Repository<Promotion>,
    @InjectRepository(LoyaltyCard) private cards: Repository<LoyaltyCard>,
    @Optional() private loyalty?: LoyaltyService,
  ) {}

  // Public: a customer sends an order from their table, or orders ahead for pickup. Prices come from the database only.
  async create(body: Record<string, unknown>) {
    const pickup = body.type === 'pickup';
    const branchId = typeof body.branch_id === 'string' ? body.branch_id : '';
    const table = pickup ? '' : clean(body.table, 20);
    const where = pickup ? 'Choose a branch to order from' : 'Scan the QR code on your table to order';
    if (!UUID.test(branchId) || (!pickup && !TABLE.test(table))) throw new BadRequestException(where);
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch || branch.status !== 'active') throw new BadRequestException(where);
    if (pickup ? !branch.pickup_enabled : !branch.ordering_enabled) {
      throw new BadRequestException(`${pickup ? 'Order ahead' : 'Ordering from the table'} is not available at this branch right now`);
    }

    const name = clean(body.customer_name, 60);
    const phone = clean(body.phone, 20).replace(/[^\d+]/g, '');
    if (!name) throw new BadRequestException('Please enter your name');
    if (pickup && phone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter your mobile number so we can reach you');
    const lines = Array.isArray(body.items) ? body.items.slice(0, MAX_LINES + 1) : [];
    if (!lines.length) throw new BadRequestException('Your order is empty');
    if (lines.length > MAX_LINES) throw new BadRequestException('Too many items in one order');

    let pickupAt: Date | null = null;
    if (pickup) {
      const ms = typeof body.pickup_at === 'string' ? Date.parse(body.pickup_at) : NaN;
      if (!(ms >= Date.now() - 5 * 60_000 && ms <= Date.now() + 12 * 3600_000)) throw new BadRequestException('Choose a pickup time today');
      pickupAt = new Date(ms);
      const slot = Math.floor(ms / SLOT_MS) * SLOT_MS;
      const inSlot = await this.orders.count({
        where: { branch_id: branchId, type: 'pickup', status: In([...OPEN]), pickup_at: Between(new Date(slot), new Date(slot + SLOT_MS - 1)) },
      });
      if (inSlot >= MAX_PER_SLOT) throw new BadRequestException('That pickup time is fully booked. Please choose another time.');
    }

    const [openForCustomer, openAtBranch] = await Promise.all([
      this.orders.count({
        where: pickup
          ? { branch_id: branchId, phone, status: In([...OPEN]) }
          : { branch_id: branchId, table_number: table, status: In([...OPEN]) },
      }),
      this.orders.count({ where: { branch_id: branchId, status: In([...OPEN]) } }),
    ]);
    if (openForCustomer >= (pickup ? MAX_OPEN_PER_PHONE : MAX_OPEN_PER_TABLE)) {
      throw new BadRequestException(pickup ? 'You already have orders on the way. Please wait for them first.' : 'This table already has orders on the way. Please wait for them or ask a team member.');
    }
    if (openAtBranch >= MAX_OPEN_PER_BRANCH) throw new BadRequestException('We are very busy right now. Please order at the counter.');

    const ids = [...new Set(lines.map((l: any) => (typeof l?.product_id === 'string' ? l.product_id : '')).filter((id) => UUID.test(id)))];
    const [products, soldOut, branchPrices, happyHours] = await Promise.all([
      ids.length ? this.products.find({ where: { id: In(ids) }, relations: ['variants', 'option_groups'] }) : [],
      ids.length ? this.availability.find({ where: { branch_id: branchId, product_id: In(ids), is_available: false } }) : [],
      ids.length ? this.prices.find({ where: { branch_id: branchId, product_id: In(ids) } }) : [],
      this.promotions.find({
        where: [
          { is_active: true, branch_id: IsNull(), discount_percent: Not(IsNull()) },
          { is_active: true, branch_id: branchId, discount_percent: Not(IsNull()) },
        ],
      }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const unavailable = new Set(soldOut.map((a) => a.product_id));
    const priceOf = new Map(branchPrices.map((p) => [p.product_id, Number(p.price_aed)]));

    let total = 0;
    let full = 0;
    const items: OrderItem[] = [];
    for (const raw of lines as any[]) {
      const product = byId.get(raw?.product_id);
      if (!product || product.status !== 'active') throw new BadRequestException('An item in your order is no longer on the menu');
      if (unavailable.has(product.id)) throw new BadRequestException(`${product.name} is sold out right now`);
      const qty = Math.floor(Number(raw.qty));
      if (!(qty >= 1 && qty <= MAX_QTY)) throw new BadRequestException(`Choose between 1 and ${MAX_QTY} of ${product.name}`);

      // One choice per size/option group; a missing or unknown choice falls back to the group's first one.
      const picked = raw.choices && typeof raw.choices === 'object' ? (raw.choices as Record<string, unknown>) : {};
      const choices: { group: string; choice: string; price_adjustment: number }[] = [];
      for (const g of [...(product.variants ?? []), ...(product.option_groups ?? [])] as Group[]) {
        const list = (g.options?.choices ?? []).filter((c) => c && typeof c.name === 'string');
        if (!list.length) continue;
        const c = list.find((x) => x.name === picked[g.id]) ?? list[0];
        choices.push({ group: g.name, choice: c.name, price_adjustment: Number(c.price_adjustment) || 0 });
      }
      const unit = Math.max(0, (priceOf.get(product.id) ?? Number(product.base_price)) + choices.reduce((s, c) => s + c.price_adjustment, 0));
      const listPrice = Math.round(unit * 100) / 100;
      // Happy hour: the biggest live discount for this product's category.
      const deal = bestDiscount(happyHours, product.category_id);
      const unitPrice = deal ? discounted(listPrice, deal.percent) : listPrice;
      full += listPrice * qty;
      total += unitPrice * qty;
      const note = clean(raw.note, 140);
      const discount = deal ? { title: deal.title, percent: deal.percent, list_price: listPrice } : null;
      items.push(
        this.items.create({ product_id: product.id, name_snapshot: product.name, unit_price: unitPrice, qty, options: { choices, note: note || null, discount } }),
      );
    }
    total = Math.round(total * 100) / 100;
    full = Math.round(full * 100) / 100;

    // Link the customer's rewards card (if the phone has one) so the order earns a stamp when collected.
    const loyaltyToken = typeof body.loyalty_token === 'string' ? body.loyalty_token.trim().slice(0, 128) : '';
    const card = loyaltyToken ? await this.cards.findOne({ where: { token: loyaltyToken } }) : null;

    const today = await this.orders.count({ where: { branch_id: branchId, created_at: MoreThanOrEqual(dubaiNow().dayStart) } });
    const token = randomBytes(24).toString('hex');
    const saved = await this.orders.save(
      this.orders.create({
        branch_id: branchId,
        order_no: String(today + 1).padStart(3, '0'),
        customer_name: name,
        phone,
        type: pickup ? 'pickup' : 'dine_in',
        table_number: pickup ? null : table,
        pickup_at: pickupAt,
        car: pickup ? clean(body.car, 40) || null : null,
        loyalty_card_id: card?.id ?? null,
        subtotal: full,
        total,
        status: 'placed',
        payment_status: 'unpaid',
        payment_provider: 'counter',
        access_token: token,
      }),
    );
    items.forEach((i) => (i.order_id = saved.id));
    await this.items.save(items);
    return { id: saved.id, access_token: token, order_no: saved.order_no, total, earns_stamp: !!card };
  }

  // Public: rough wait for a new order, from how many are queued or being made (5 to 45 minutes).
  async wait(branchRaw: unknown) {
    const branchId = typeof branchRaw === 'string' ? branchRaw : '';
    if (!UUID.test(branchId)) throw new BadRequestException('Choose a branch');
    const queued = await this.orders.count({ where: { branch_id: branchId, status: In(['placed', 'preparing']) } });
    return { queued, minutes: Math.min(45, 5 + queued * 3) };
  }

  private async own(id: string, token: unknown) {
    if (!UUID.test(id) || typeof token !== 'string' || !token) throw new NotFoundException('Order not found');
    const order = await this.orders.findOne({ where: { id }, relations: ['items'] });
    if (!order || order.access_token !== token) throw new NotFoundException('Order not found');
    return order;
  }

  // Public: the customer's phone checks progress. Needs the private token returned when ordering.
  async track(id: string, token: unknown) {
    const o = await this.own(id, token);
    return {
      id: o.id,
      order_no: o.order_no,
      status: o.status,
      type: o.type,
      table: o.table_number,
      pickup_at: o.pickup_at,
      car: o.car,
      arrived_at: o.arrived_at,
      total: Number(o.total),
      created_at: o.created_at,
      loyalty: o.loyalty_card_id ? (o.loyalty_stamped ? 'stamped' : 'linked') : null,
      items: (o.items ?? []).map((i) => ({ name: i.name_snapshot, qty: i.qty, unit_price: Number(i.unit_price), options: i.options })),
    };
  }

  // Public: curbside pickup. The customer is outside; staff bring the order to their car.
  async arrived(id: string, token: unknown, carRaw: unknown) {
    const o = await this.own(id, token);
    if (o.type !== 'pickup') throw new BadRequestException('Only order-ahead orders can be brought to your car');
    if (!(OPEN as readonly string[]).includes(o.status)) throw new BadRequestException('This order is already closed');
    const car = clean(carRaw, 40) || o.car;
    if (!car) throw new BadRequestException('Tell us your car so we can find you, e.g. White Patrol, plate A 12345');
    o.car = car;
    o.arrived_at = o.arrived_at ?? new Date();
    await this.orders.save(o);
    return { ok: true, car: o.car, arrived_at: o.arrived_at };
  }

  // Public: the customer can cancel until staff start making it.
  async cancel(id: string, token: unknown) {
    const o = await this.own(id, token);
    if (o.status !== 'placed') throw new BadRequestException('Your order is already being prepared. Please ask a team member.');
    o.status = 'cancelled';
    await this.orders.save(o);
    return { ok: true };
  }

  private branchFor(raw: unknown, staff: StaffUser) {
    const branchId = typeof raw === 'string' ? raw : '';
    if (!UUID.test(branchId)) throw new BadRequestException('Choose a branch');
    if (staff.role !== 'admin' && staff.assigned_branch_id && staff.assigned_branch_id !== branchId) {
      throw new ForbiddenException('You can only see your own branch');
    }
    return branchId;
  }

  // Staff: open orders (oldest first) plus the last two hours of finished ones.
  async list(branchRaw: unknown, staff: StaffUser) {
    const branchId = this.branchFor(branchRaw, staff);
    const [branch, open, finished] = await Promise.all([
      this.branches.findOne({ where: { id: branchId } }),
      this.orders.find({ where: { branch_id: branchId, status: In([...OPEN]) }, relations: ['items'], order: { created_at: 'ASC' }, take: MAX_OPEN_PER_BRANCH }),
      this.orders.find({
        where: { branch_id: branchId, status: In(['completed', 'cancelled']), created_at: MoreThanOrEqual(new Date(Date.now() - 2 * 3600_000)) },
        relations: ['items'],
        order: { created_at: 'DESC' },
        take: 30,
      }),
    ]);
    const row = (o: Order) => ({
      id: o.id,
      order_no: o.order_no,
      customer_name: o.customer_name,
      phone: o.phone,
      rewards_card: !!o.loyalty_card_id,
      type: o.type,
      table: o.table_number,
      pickup_at: o.pickup_at,
      car: o.car,
      arrived_at: o.arrived_at,
      status: o.status,
      total: Number(o.total),
      created_at: o.created_at,
      items: (o.items ?? []).map((i) => ({ name: i.name_snapshot, qty: i.qty, options: i.options })),
    });
    return { ordering_enabled: !!branch?.ordering_enabled, pickup_enabled: !!branch?.pickup_enabled, open: open.map(row), finished: finished.map(row) };
  }

  async setStatus(id: string, statusRaw: unknown, staff: StaffUser) {
    if (!UUID.test(id)) throw new NotFoundException('Order not found');
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    this.branchFor(order.branch_id, staff);
    const status = String(statusRaw);
    if (!(NEXT[order.status] ?? []).includes(status)) throw new BadRequestException(`Cannot move an order from ${order.status} to ${status}`);
    order.status = status as Order['status'];
    await this.orders.save(order);
    let stamp: string | null = null;
    if (status === 'completed' && order.loyalty_card_id && !order.loyalty_stamped && this.loyalty) {
      // Collected: stamp the linked card with the normal rules (cooldown, daily limit, bonuses).
      try {
        const card = await this.cards.findOne({ where: { id: order.loyalty_card_id } });
        if (card) {
          const res = await this.loyalty.addStamp({ token: card.token }, { id: UUID.test(staff.id ?? '') ? staff.id : null, role: staff.role, assigned_branch_id: order.branch_id }, `Order ${order.order_no}`);
          if (res.ok) {
            order.loyalty_stamped = true;
            await this.orders.save(order);
          }
          stamp = 'message' in res ? res.message : 'added';
        }
      } catch (e) {
        this.logger.warn(`Order ${order.id}: stamp failed: ${(e as Error).message}`);
      }
    }
    return { ok: true, status, stamp };
  }

  // kind 'table' = order from the table QR, 'pickup' = order ahead and collect.
  async setOrdering(branchRaw: unknown, enabled: unknown, staff: StaffUser, kind: unknown = 'table') {
    const branchId = this.branchFor(branchRaw, staff);
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (kind === 'pickup') branch.pickup_enabled = enabled === true;
    else branch.ordering_enabled = enabled === true;
    await this.branches.save(branch);
    return { ordering_enabled: !!branch.ordering_enabled, pickup_enabled: !!branch.pickup_enabled };
  }
}
