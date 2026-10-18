import { BadRequestException } from '@nestjs/common';
import { OfferStatsService } from './offer-stats.service';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

function qb(rows: any[]) {
  const q: any = { select: () => q, addSelect: () => q, where: () => q, groupBy: () => q, addGroupBy: () => q, getRawMany: jest.fn(async () => rows) };
  return q;
}

function setup(raw: { counts?: any[]; redeemed?: any[]; orders?: any[] } = {}) {
  const saved: any[] = [];
  const events = { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => saved.push(...x)), createQueryBuilder: jest.fn(() => qb(raw.counts ?? [])) };
  const promos = {
    find: jest.fn(async (opts: any) =>
      opts?.select
        ? [{ id: A }]
        : [
            { id: A, title: 'Happy hour', is_active: true, combo_price: null },
            { id: B, title: 'Coffee & croissant', is_active: true, combo_price: '22.00' },
          ],
    ),
  };
  const coupons = { createQueryBuilder: jest.fn(() => qb(raw.redeemed ?? [])) };
  const orders = { find: jest.fn(async () => raw.orders ?? []) };
  const reminders = { find: jest.fn(async () => [{ promotion_id: A }, { promotion_id: A }]) };
  return { svc: new OfferStatsService(events as any, promos as any, coupons as any, orders as any, reminders as any), saved };
}

describe('OfferStatsService', () => {
  it('records known offers and event types only, at most 30 at a time', async () => {
    const { svc, saved } = setup();
    const res = await svc.record({
      events: [
        { promotion_id: A, type: 'view' },
        { promotion_id: A, type: 'hack' },
        { promotion_id: B, type: 'view' }, // not a known offer in this stand-in
        { promotion_id: 'x', type: 'view' },
      ],
    });
    expect(res).toEqual({ saved: 1 });
    expect(saved).toEqual([{ promotion_id: A, type: 'view' }]);
    expect(await svc.record({ events: 'nope' })).toEqual({ saved: 0 });
  });

  it('adds up actions, redemptions and combo orders per offer', async () => {
    const { svc } = setup({
      counts: [
        { promotion_id: A, type: 'view', n: '40' },
        { promotion_id: A, type: 'order_click', n: '6' },
        { promotion_id: A, type: 'code_copy', n: '3' },
        { promotion_id: B, type: 'view', n: '10' },
        { promotion_id: B, type: 'combo_add', n: '2' },
      ],
      redeemed: [{ promotion_id: A, n: '4' }],
      orders: [
        { discounts: [{ title: 'Coffee & croissant', sets: 1, amount: 12 }], status: 'completed' },
        { discounts: [{ title: 'Coffee & croissant', sets: 2, amount: 24 }], status: 'placed' },
        { discounts: [{ title: 'Coffee & croissant', sets: 1, amount: 12 }], status: 'cancelled' },
      ],
    });
    const { rows } = await svc.stats('30');
    expect(rows[0]).toMatchObject({ title: 'Happy hour', views: 40, order_clicks: 6, code_copies: 3, redemptions: 4, action_rate: 15, combo_orders: 0, reminders: 2 });
    expect(rows[1]).toMatchObject({ title: 'Coffee & croissant', views: 10, combo_adds: 2, combo_orders: 2, combo_saved: 36, action_rate: 20 });
    await expect(svc.stats('5')).rejects.toBeInstanceOf(BadRequestException);
  });
});
