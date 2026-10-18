import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { CorporateAccount } from '../entities/corporate-account.entity';
import { CorporateInvoice } from '../entities/corporate-invoice.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Branch } from '../entities/branch.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const VAT_RATE = 5; // UAE VAT, prices on the menu include it
const DUBAI_MS = 4 * 3600_000;
const STATUSES = ['pending', 'active', 'paused', 'rejected'];

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const r2 = (n: number) => Math.round(n * 100) / 100;
// VAT inside a VAT-inclusive amount: 5/105 of it.
export const vatOf = (total: number) => r2((total * VAT_RATE) / (100 + VAT_RATE));
export const validTrn = (v: string) => /^\d{15}$/.test(v);
// Start and end of a Dubai calendar month, as instants.
export function monthRange(month: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new BadRequestException('Choose a month');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return { from: new Date(Date.UTC(y, mo - 1, 1) - DUBAI_MS), to: new Date(Date.UTC(y, mo, 1) - DUBAI_MS) };
}

@Injectable()
export class CorporateService {
  constructor(
    @InjectRepository(CorporateAccount) private accounts: Repository<CorporateAccount>,
    @InjectRepository(CorporateInvoice) private invoices: Repository<CorporateInvoice>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(Branch) private branches: Repository<Branch>,
    private db: DataSource,
  ) {}

  // Public: a company asks for an account.
  async apply(body: Record<string, unknown>) {
    const company = clean(body?.company, 120);
    const contact_name = clean(body?.contact_name, 60);
    const email = clean(body?.email, 120).toLowerCase();
    const phone = clean(body?.phone, 20).replace(/[^\d+]/g, '');
    const trn = clean(body?.trn, 20).replace(/\D/g, '');
    if (!company) throw new BadRequestException('Please enter the company name');
    if (!contact_name) throw new BadRequestException('Please enter your name');
    if (!EMAIL.test(email)) throw new BadRequestException('Please enter a valid email');
    if (phone.replace(/\D/g, '').length < 7) throw new BadRequestException('Please enter your mobile number');
    if (trn && !validTrn(trn)) throw new BadRequestException('A UAE TRN has 15 digits');
    const size = Math.floor(Number(body?.team_size));
    await this.accounts.save(
      this.accounts.create({
        company,
        contact_name,
        email,
        phone,
        trn: trn || null,
        address: clean(body?.address, 200) || null,
        team_size: size > 0 && size < 100000 ? size : null,
        message: clean(body?.message, 500) || null,
        status: 'pending',
      }),
    );
    return { ok: true };
  }

  // Not yet invoiced, not cancelled: what counts against the credit limit.
  async unbilled(accountId: string) {
    const row = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .where('o.corporate_account_id = :id AND o.invoice_id IS NULL AND o.status <> :c', { id: accountId, c: 'cancelled' })
      .getRawOne();
    return r2(Number(row?.sum ?? 0));
  }

  // Used by orders: the account behind a token, if it may order now for this amount.
  async forOrder(token: unknown, total: number) {
    const t = typeof token === 'string' ? token.trim() : '';
    const acc = /^[a-f0-9]{48}$/.test(t) ? await this.accounts.findOne({ where: { access_token: t } }) : null;
    if (!acc) throw new BadRequestException('This company account link is not valid');
    if (acc.status !== 'active') throw new BadRequestException('This company account is paused. Please contact us.');
    const used = await this.unbilled(acc.id);
    if (used + total > Number(acc.credit_limit)) {
      throw new BadRequestException(`This order is over your company's credit limit (AED ${Math.max(0, Number(acc.credit_limit) - used).toFixed(2)} left)`);
    }
    return acc;
  }

  private async byToken(token: unknown) {
    const t = typeof token === 'string' ? token.trim() : '';
    const acc = /^[a-f0-9]{48}$/.test(t) ? await this.accounts.findOne({ where: { access_token: t } }) : null;
    if (!acc || acc.status === 'rejected') throw new NotFoundException('Company account not found');
    return acc;
  }

  private async orderRows(where: Record<string, unknown>, take = 100) {
    const rows = await this.orders.find({ where, order: { created_at: 'DESC' }, take });
    const [items, branches] = rows.length
      ? await Promise.all([
          this.items.find({ where: { order_id: In(rows.map((o) => o.id)) } }),
          this.branches.find({ where: { id: In([...new Set(rows.map((o) => o.branch_id))]) } }),
        ])
      : [[], []];
    const name = new Map(branches.map((b) => [b.id, b.name]));
    return rows.map((o) => ({
      id: o.id,
      order_no: o.order_no,
      at: o.created_at,
      branch: name.get(o.branch_id) ?? '',
      person: o.customer_name,
      status: o.status,
      total: Number(o.total),
      items: items.filter((i) => i.order_id === o.id).map((i) => `${i.qty}× ${i.name_snapshot}`),
    }));
  }

  // The company's own page: credit, recent orders and invoices.
  async portal(token: unknown) {
    const acc = await this.byToken(token);
    const [used, recent, invoices] = await Promise.all([
      this.unbilled(acc.id),
      this.orderRows({ corporate_account_id: acc.id }, 50),
      this.invoices.find({ where: { account_id: acc.id }, order: { issued_at: 'DESC' } }),
    ]);
    return {
      company: acc.company,
      contact_name: acc.contact_name,
      status: acc.status,
      credit_limit: Number(acc.credit_limit),
      unbilled: used,
      orders: recent,
      invoices: invoices.map((i) => this.invoiceRow(i)),
    };
  }

  private invoiceRow(i: CorporateInvoice) {
    return { id: i.id, number: i.number, month: i.month, order_count: i.order_count, total: Number(i.total), vat: Number(i.vat), status: i.status, issued_at: i.issued_at, paid_at: i.paid_at };
  }

  private seller() {
    return {
      name: process.env.COMPANY_NAME || 'Milestones Coffee',
      trn: process.env.COMPANY_TRN || null,
      address: process.env.COMPANY_ADDRESS || 'Abu Dhabi, United Arab Emirates',
    };
  }

  // A full tax invoice: seller, buyer, every order, VAT.
  async invoiceDetail(accountId: string, invoiceId: string) {
    if (!UUID.test(invoiceId)) throw new NotFoundException('Invoice not found');
    const inv = await this.invoices.findOne({ where: { id: invoiceId, account_id: accountId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const acc = await this.accounts.findOne({ where: { id: accountId } });
    const lines = (await this.orderRows({ invoice_id: inv.id }, 2000)).reverse();
    return {
      ...this.invoiceRow(inv),
      vat_rate: VAT_RATE,
      net: r2(Number(inv.total) - Number(inv.vat)),
      seller: this.seller(),
      buyer: { company: acc?.company, trn: acc?.trn, address: acc?.address, contact_name: acc?.contact_name, email: acc?.email },
      lines,
    };
  }

  async portalInvoice(token: unknown, invoiceId: string) {
    const acc = await this.byToken(token);
    return this.invoiceDetail(acc.id, invoiceId);
  }

  // Admin: every account, newest first, with what it owes and has not been billed for yet.
  async list() {
    const rows = await this.accounts.find({ order: { created_at: 'DESC' } });
    const invoices = rows.length ? await this.invoices.find({ where: { account_id: In(rows.map((r) => r.id)) }, order: { issued_at: 'DESC' } }) : [];
    return Promise.all(
      rows.map(async (a) => ({
        ...a,
        credit_limit: Number(a.credit_limit),
        unbilled: a.status === 'pending' ? 0 : await this.unbilled(a.id),
        invoices: invoices.filter((i) => i.account_id === a.id).map((i) => this.invoiceRow(i)),
      })),
    );
  }

  async update(id: string, body: Record<string, unknown>) {
    const acc = UUID.test(id) ? await this.accounts.findOne({ where: { id } }) : null;
    if (!acc) throw new NotFoundException('Company not found');
    if (body.status !== undefined) {
      if (!STATUSES.includes(String(body.status))) throw new BadRequestException('Unknown status');
      acc.status = String(body.status);
      if (acc.status === 'active') {
        acc.access_token ??= randomBytes(24).toString('hex');
        acc.approved_at ??= new Date();
      }
    }
    if (body.credit_limit !== undefined) {
      const n = Number(body.credit_limit);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new BadRequestException('Credit limit must be between 0 and 1,000,000');
      acc.credit_limit = String(r2(n));
    }
    if (body.trn !== undefined) {
      const trn = clean(body.trn, 20).replace(/\D/g, '');
      if (trn && !validTrn(trn)) throw new BadRequestException('A UAE TRN has 15 digits');
      acc.trn = trn || null;
    }
    if (body.notes !== undefined) acc.notes = clean(body.notes, 500) || null;
    if (body.address !== undefined) acc.address = clean(body.address, 200) || null;
    if (body.new_link === true && acc.access_token) acc.access_token = randomBytes(24).toString('hex'); // old link stops working
    return this.accounts.save(acc);
  }

  // Admin: bill every collected, not yet invoiced order up to the end of the month on one tax invoice.
  async issue(id: string, monthRaw: unknown) {
    const acc = UUID.test(id) ? await this.accounts.findOne({ where: { id } }) : null;
    if (!acc) throw new NotFoundException('Company not found');
    const month = typeof monthRaw === 'string' ? monthRaw : '';
    const { to } = monthRange(month);
    return this.db.transaction(async (m) => {
      const orders = await m.find(Order, {
        where: { corporate_account_id: acc.id, invoice_id: IsNull(), status: 'completed', created_at: LessThan(to) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!orders.length) throw new BadRequestException(`No collected orders to bill up to the end of ${month}`);
      const total = r2(orders.reduce((s, o) => s + Number(o.total), 0));
      const year = month.slice(0, 4);
      const count = await m.count(CorporateInvoice, { where: { number: Not(IsNull()) } });
      const inv = await m.save(
        m.create(CorporateInvoice, {
          account_id: acc.id,
          number: `MSQ-${year}-${String(count + 1).padStart(4, '0')}`,
          month,
          order_count: orders.length,
          total: String(total),
          vat: String(vatOf(total)),
          status: 'unpaid',
        }),
      );
      await m.update(Order, { id: In(orders.map((o) => o.id)) }, { invoice_id: inv.id, payment_status: 'invoiced' });
      return this.invoiceRow(inv);
    });
  }

  async setPaid(invoiceId: string, paid: boolean) {
    const inv = UUID.test(invoiceId) ? await this.invoices.findOne({ where: { id: invoiceId } }) : null;
    if (!inv) throw new NotFoundException('Invoice not found');
    inv.status = paid ? 'paid' : 'unpaid';
    inv.paid_at = paid ? new Date() : null;
    await this.invoices.save(inv);
    await this.orders.update({ invoice_id: inv.id }, { payment_status: paid ? 'paid' : 'invoiced' });
    return this.invoiceRow(inv);
  }
}
