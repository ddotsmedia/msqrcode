import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { GroupLine, GroupMember, GroupOrder } from '../entities/group-order.entity';
import { Branch } from '../entities/branch.entity';
import { Order } from '../entities/order.entity';
import { OrdersService } from '../orders/orders.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_MEMBERS = 20;
export const MAX_MEMBER_LINES = 10;
export const MAX_GROUP_LINES = 30; // same as one order
const OPEN_MS = 3 * 3600_000;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const sameKey = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const newKey = () => randomBytes(16).toString('hex');

// Check one person's lines from the browser; prices here are only for showing the running total.
export function cleanLines(raw: unknown): GroupLine[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_MEMBER_LINES) throw new BadRequestException(`Up to ${MAX_MEMBER_LINES} items per person`);
  return raw.map((l: any) => {
    const qty = Math.floor(Number(l?.qty));
    if (typeof l?.product_id !== 'string' || !UUID.test(l.product_id) || !(qty >= 1 && qty <= 20)) throw new BadRequestException('An item in your list is not valid');
    const choices: Record<string, string> = {};
    if (l.choices && typeof l.choices === 'object') {
      for (const [k, v] of Object.entries(l.choices).slice(0, 10)) if (typeof v === 'string') choices[String(k).slice(0, 64)] = v.slice(0, 60);
    }
    return {
      product_id: l.product_id,
      name: clean(l.name, 80) || 'Item',
      qty,
      unit: Math.max(0, Math.min(10000, Number(l.unit) || 0)),
      choices,
      labels: Array.isArray(l.labels) ? l.labels.filter((x: unknown) => typeof x === 'string').slice(0, 10).map((x: string) => x.slice(0, 60)) : [],
      note: clean(l.note, 100),
    };
  });
}

@Injectable()
export class GroupOrdersService {
  constructor(
    @InjectRepository(GroupOrder) private groups: Repository<GroupOrder>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
    @InjectRepository(Order) private orders: Repository<Order>,
    private ordersService: OrdersService,
  ) {}

  private async newCode() {
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join('');
      if (!(await this.groups.findOne({ where: { code } }))) return code;
    }
    throw new Error('Could not create a group code');
  }

  private async find(codeRaw: unknown, withKey = false) {
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{6}$/.test(code)) throw new NotFoundException('Group order not found');
    const g = withKey
      ? await this.groups.createQueryBuilder('g').addSelect('g.host_key').where('g.code = :code', { code }).getOne()
      : await this.groups.findOne({ where: { code } });
    if (!g) throw new NotFoundException('Group order not found');
    return g;
  }

  // Public view of the group: who added what, the running total and, once sent, the order's progress.
  private async view(g: GroupOrder, memberKey?: string) {
    const branch = await this.branches.findOne({ where: { id: g.branch_id } });
    const order = g.order_id ? await this.orders.findOne({ where: { id: g.order_id } }) : null;
    const open = g.status === 'open' && g.closes_at.getTime() > Date.now();
    return {
      code: g.code,
      branch: { id: g.branch_id, name: branch?.name ?? '' },
      host: g.host_name,
      status: g.status === 'open' && !open ? 'closed' : g.status,
      closes_at: g.closes_at,
      members: g.members.map((m) => ({
        name: m.name,
        mine: !!memberKey && sameKey(m.key, memberKey),
        lines: m.lines.map(({ name, qty, unit, labels, note }) => ({ name, qty, unit, labels, note })),
        total: Math.round(m.lines.reduce((s, l) => s + l.unit * l.qty, 0) * 100) / 100,
      })),
      total: Math.round(g.members.reduce((s, m) => s + m.lines.reduce((t, l) => t + l.unit * l.qty, 0), 0) * 100) / 100,
      order: order ? { order_no: order.order_no, status: order.status, total: Number(order.total), pickup_at: order.pickup_at } : null,
    };
  }

  // Host: start a group at a branch that takes order-ahead.
  async create(body: Record<string, unknown>) {
    const branchId = typeof body?.branch_id === 'string' ? body.branch_id : '';
    const host_name = clean(body?.host_name, 60);
    const host_phone = clean(body?.host_phone, 20).replace(/[^\d+]/g, '');
    if (!UUID.test(branchId)) throw new BadRequestException('Choose a branch');
    if (!host_name) throw new BadRequestException('Please enter your name');
    if (host_phone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter your mobile number');
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch || branch.status !== 'active' || !branch.pickup_enabled) throw new BadRequestException('Order ahead is not available at this branch right now');
    const host_key = newKey();
    const g = await this.groups.save(
      this.groups.create({ code: await this.newCode(), branch_id: branchId, host_name, host_phone, host_key, closes_at: new Date(Date.now() + OPEN_MS), members: [] }),
    );
    return { code: g.code, host_key, member_key: host_key };
  }

  async get(code: unknown, memberKey?: unknown) {
    return this.view(await this.find(code), typeof memberKey === 'string' ? memberKey : undefined);
  }

  // Anyone with the link: add or replace their own items. An empty list removes them.
  async setItems(code: unknown, body: Record<string, unknown>) {
    const g = await this.find(code);
    if (g.status !== 'open' || g.closes_at.getTime() <= Date.now()) throw new BadRequestException('This group order is closed');
    const name = clean(body?.name, 40);
    const lines = cleanLines(body?.lines);
    const key = typeof body?.member_key === 'string' && /^[a-f0-9]{32}$/.test(body.member_key) ? body.member_key : '';
    const others = g.members.filter((m) => !key || !sameKey(m.key, key));
    if (lines.length) {
      if (!name) throw new BadRequestException('Please enter your name');
      if (others.length >= MAX_MEMBERS) throw new BadRequestException(`This group is full (${MAX_MEMBERS} people)`);
      const count = others.reduce((s, m) => s + m.lines.length, 0) + lines.length;
      if (count > MAX_GROUP_LINES) throw new BadRequestException(`A group order can have up to ${MAX_GROUP_LINES} items. Ask the host to send this one and start another.`);
    }
    const memberKey = key || newKey();
    const mine = g.members.find((m) => sameKey(m.key, memberKey));
    g.members = lines.length
      ? mine
        ? g.members.map((m) => (m === mine ? { ...m, name, lines, at: new Date().toISOString() } : m))
        : [...g.members, { key: memberKey, name, lines, at: new Date().toISOString() } as GroupMember]
      : others;
    await this.groups.save(g);
    return { member_key: memberKey, group: await this.view(g, memberKey) };
  }

  // Host: send everything as one pickup order. Each item's note starts with the person's name for the barista.
  async submit(code: unknown, body: Record<string, unknown>) {
    const g = await this.find(code, true);
    const key = typeof body?.host_key === 'string' ? body.host_key : '';
    if (!key || !sameKey(g.host_key, key)) throw new ForbiddenException('Only the person who started the group can send it');
    if (g.status === 'sent') throw new BadRequestException('This group order was already sent');
    if (g.status !== 'open') throw new BadRequestException('This group order is closed');
    const items = g.members.flatMap((m) =>
      m.lines.map((l) => ({ product_id: l.product_id, qty: l.qty, choices: l.choices, note: `${m.name}${l.note ? `: ${l.note}` : ''}`.slice(0, 140) })),
    );
    if (!items.length) throw new BadRequestException('Nobody has added anything yet');
    // Mark it sent first so a double tap cannot send two orders; undo if the order is refused.
    const lock = await this.groups.update({ id: g.id, status: 'open' }, { status: 'sent' });
    if (!lock.affected) throw new BadRequestException('This group order was already sent');
    try {
      const order = await this.ordersService.create({
        type: 'pickup',
        branch_id: g.branch_id,
        pickup_at: body?.pickup_at,
        customer_name: `${g.host_name} (group of ${g.members.length})`.slice(0, 60),
        phone: g.host_phone,
        items,
        account_token: typeof body?.account_token === 'string' ? body.account_token : undefined,
        loyalty_token: typeof body?.loyalty_token === 'string' ? body.loyalty_token : undefined,
      });
      await this.groups.update({ id: g.id }, { order_id: order.id });
      return { ...order, group: await this.view({ ...g, status: 'sent', order_id: order.id }) };
    } catch (e) {
      await this.groups.update({ id: g.id }, { status: 'open' });
      throw e;
    }
  }

  async cancel(code: unknown, body: Record<string, unknown>) {
    const g = await this.find(code, true);
    const key = typeof body?.host_key === 'string' ? body.host_key : '';
    if (!key || !sameKey(g.host_key, key)) throw new ForbiddenException('Only the person who started the group can cancel it');
    if (g.status !== 'open') throw new BadRequestException('This group order is closed');
    await this.groups.update({ id: g.id }, { status: 'cancelled' });
    return { ok: true };
  }
}
