import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const B1 = '11111111-1111-1111-1111-111111111111';
const B2 = '22222222-2222-2222-2222-222222222222';
const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const O1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const latte = {
  id: P1,
  name: 'Latte',
  status: 'active',
  base_price: '18.00',
  variants: [{ id: 'g-size', name: 'Size', options: { choices: [{ name: 'Regular', price_adjustment: 0 }, { name: 'Large', price_adjustment: 3 }] } }],
  option_groups: [{ id: 'g-milk', name: 'Milk', options: { choices: [{ name: 'Full fat', price_adjustment: 0 }, { name: 'Oat', price_adjustment: 2.5 }] } }],
};
const cake = { id: P2, name: 'Cake', status: 'active', base_price: 22, variants: [], option_groups: [] };

function setup(opts: { enabled?: boolean; openTable?: number; soldOut?: string[]; branchPrice?: number; order?: any } = {}) {
  const saved: any[] = [];
  const counts = { table: opts.openTable ?? 0 };
  const orders = {
    count: jest.fn(async ({ where }: any) => (where.table_number ? counts.table : where.created_at ? 4 : 0)),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => {
      saved.push(x);
      return { id: O1, ...x };
    }),
    findOne: jest.fn(async () => opts.order ?? null),
    find: jest.fn(async () => []),
  };
  const items = { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
  const products = { find: jest.fn(async () => [latte, cake]) };
  const branch = { id: B1, status: 'active', ordering_enabled: opts.enabled ?? true };
  const branches = { findOne: jest.fn(async ({ where }: any) => (where.id === B1 ? branch : null)), save: jest.fn(async (x: any) => x) };
  const prices = { find: jest.fn(async () => (opts.branchPrice ? [{ product_id: P2, price_aed: opts.branchPrice }] : [])) };
  const availability = { find: jest.fn(async () => (opts.soldOut ?? []).map((product_id) => ({ product_id }))) };
  const svc = new OrdersService(orders as any, items as any, products as any, branches as any, prices as any, availability as any);
  return { svc, saved, items, branch };
}

const body = (extra: Record<string, unknown> = {}) => ({
  branch_id: B1,
  table: '7',
  customer_name: '  Sara  ',
  items: [
    { product_id: P1, qty: 2, choices: { 'g-size': 'Large', 'g-milk': 'Oat' }, note: 'less sugar' },
    { product_id: P2, qty: 1 },
  ],
  ...extra,
});

describe('OrdersService', () => {
  it('prices the order from the database, including size and milk choices', async () => {
    const { svc, saved, items } = setup();
    const res = await svc.create(body({ items: [...body().items.slice(0, 1), { product_id: P2, qty: 1, unit_price: 0.01 }] }));
    // Latte 18 + 3 + 2.5 = 23.5 x 2 = 47, cake 22
    expect(res).toMatchObject({ id: O1, order_no: '005', total: 69 });
    expect(res.access_token).toMatch(/^[0-9a-f]{48}$/);
    expect(saved[0]).toMatchObject({ branch_id: B1, table_number: '7', customer_name: 'Sara', type: 'dine_in', status: 'placed', total: 69, payment_provider: 'counter' });
    const lines = items.save.mock.calls[0][0];
    expect(lines[0]).toMatchObject({ unit_price: 23.5, qty: 2, order_id: O1 });
    expect(lines[0].options).toEqual({
      choices: [
        { group: 'Size', choice: 'Large', price_adjustment: 3 },
        { group: 'Milk', choice: 'Oat', price_adjustment: 2.5 },
      ],
      note: 'less sugar',
    });
  });

  it('falls back to the first choice when a choice is missing or unknown', async () => {
    const { svc, items } = setup();
    await svc.create(body({ items: [{ product_id: P1, qty: 1, choices: { 'g-size': 'Huge' } }] }));
    expect(items.save.mock.calls[0][0][0]).toMatchObject({ unit_price: 18 });
  });

  it('uses a branch price when one is set', async () => {
    const { svc } = setup({ branchPrice: 25 });
    expect((await svc.create(body({ items: [{ product_id: P2, qty: 2 }] }))).total).toBe(50);
  });

  it('refuses when the branch has ordering switched off', async () => {
    await expect(setup({ enabled: false }).svc.create(body())).rejects.toThrow('not available');
  });

  it('refuses sold-out items, bad quantities, empty orders and missing names', async () => {
    await expect(setup({ soldOut: [P2] }).svc.create(body())).rejects.toThrow('Cake is sold out');
    await expect(setup().svc.create(body({ items: [{ product_id: P1, qty: 0 }] }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.create(body({ items: [{ product_id: P1, qty: 21 }] }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.create(body({ items: [] }))).rejects.toThrow('empty');
    await expect(setup().svc.create(body({ customer_name: '  ' }))).rejects.toThrow('name');
    await expect(setup().svc.create(body({ items: [{ product_id: 'nope', qty: 1 }] }))).rejects.toThrow('no longer on the menu');
  });

  it('rejects bad tables and unknown branches', async () => {
    await expect(setup().svc.create(body({ table: '<b>' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().svc.create(body({ branch_id: B2 }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limits open orders per table', async () => {
    await expect(setup({ openTable: 3 }).svc.create(body())).rejects.toThrow('already has orders');
  });

  it('only shows an order to someone holding its token', async () => {
    const order = { id: O1, access_token: 'secret', status: 'placed', order_no: '001', table_number: '7', total: '10', items: [] };
    await expect(setup({ order }).svc.track(O1, 'wrong')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ order }).svc.track(O1, undefined)).rejects.toBeInstanceOf(NotFoundException);
    const res = await setup({ order }).svc.track(O1, 'secret');
    expect(res).toMatchObject({ status: 'placed', total: 10 });
    expect(res).not.toHaveProperty('access_token');
  });

  it('lets the customer cancel only before staff start', async () => {
    const placed = { id: O1, access_token: 't', status: 'placed' };
    expect(await setup({ order: placed }).svc.cancel(O1, 't')).toEqual({ ok: true });
    expect(placed.status).toBe('cancelled');
    await expect(setup({ order: { id: O1, access_token: 't', status: 'preparing' } }).svc.cancel(O1, 't')).rejects.toThrow('already being prepared');
  });

  it('moves orders forward and keeps managers to their branch', async () => {
    const admin = { id: 'u', role: 'admin' };
    const order = { id: O1, branch_id: B1, status: 'placed' };
    expect(await setup({ order }).svc.setStatus(O1, 'preparing', admin)).toEqual({ ok: true, status: 'preparing' });
    await expect(setup({ order: { ...order, status: 'completed' } }).svc.setStatus(O1, 'ready', admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup({ order }).svc.setStatus(O1, 'ready', { id: 'm', role: 'branch_manager', assigned_branch_id: B2 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('switches table ordering on and off', async () => {
    const { svc, branch } = setup({ enabled: false });
    expect(await svc.setOrdering(B1, true, { id: 'u', role: 'admin' })).toEqual({ ordering_enabled: true });
    expect(branch.ordering_enabled).toBe(true);
    await expect(svc.setOrdering(B1, true, { id: 'm', role: 'branch_manager', assigned_branch_id: B2 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
